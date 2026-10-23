# OrbitHire worker

Python 3.12 background service that runs the jobs the Next.js app puts in the
Postgres `tasks` queue: `fetch_jobs`, `rank_jobs`, `render_pdf`, `thumbnail`,
`digest` (and `noop` for smoke tests). See `docs/PLAN.md` §4.1.

## How it works

- **Queue**: the `tasks` table (created by a Supabase migration). Inserting a row
  fires `pg_notify('tasks_new', type)`.
- **Claim loop**: `LISTEN tasks_new` wakes the worker immediately; it also polls
  every `WORKER_POLL_INTERVAL` seconds (default 10) to pick up delayed retries.
  A task is claimed with
  `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *`, so any
  number of workers can share the queue without double-processing.
- **Slots**: each task type has its own concurrency limit (default 2 `render_pdf`,
  1 `fetch_jobs`, 1 for the rest). A task is only claimed when its type has a
  free slot.
- **Timeouts**: hard per-type timeout (render 30 s, fetch 5 min).
  Sync handlers run in a thread; on timeout the task is marked failed, but the
  thread itself cannot be killed, so sync handlers should also use their own
  library timeouts.
- **Retries**: `attempts` is incremented on claim. On failure the task goes back
  to `queued` with `run_after = now() + base * 2^(attempts-1)` (base 30 s, max 1 h).
  When `attempts >= max_attempts` (default 3) it ends `failed` with `last_error`.
- **Stale locks**: every minute, `running` tasks whose `locked_at` is older than
  2x their type's timeout (worker crashed) are requeued, or failed if out of
  attempts.
- **Shutdown**: on SIGTERM/SIGINT the worker stops claiming, waits up to
  `WORKER_SHUTDOWN_GRACE` seconds for running tasks, then cancels them and
  puts them back in the queue without counting the attempt.

## Run locally

```bash
supabase start                 # from the repo root; Postgres on 127.0.0.1:54322
cd worker
cp ../.env.example .env        # or export DATABASE_URL etc.
uv sync
uv run worker                  # or: uv run python -m orbithire_worker
```

With Docker (worker reaches the local Supabase db via `host.docker.internal`):

```bash
cd worker
docker compose up --build
```

`DATABASE_URL` must be a **direct / session-mode** connection; `LISTEN` does not
work through a transaction-mode pooler (Supavisor port 6543).

## Configuration

| Env | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | service role (bypasses RLS) |
| `R2_ENDPOINT` / `R2_ACCOUNT_ID` | – | endpoint wins; otherwise built from account id |
| `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | – | same names as the Next app |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | – | embeddings / LLM scoring / digest |
| `ENCRYPTION_KEY`, `SUPABASE_JWT_SECRET` | – | decrypt users' own API keys (same as the app) |
| `RANKING_PLATFORM_LLM`, `RANKING_PLATFORM_DAILY_LIMIT` | `quota` / `15` | platform-key policy for LLM scoring |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `REED_API_KEY`, `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` | – | optional job APIs; skipped when unset |
| `WORKER_ID` | `hostname:pid` | stored in `tasks.locked_by` |
| `WORKER_POLL_INTERVAL` | `10` | seconds |
| `WORKER_CONCURRENCY` | `render_pdf=2,fetch_jobs=1` | `type=n,…` or JSON; merged with defaults |
| `WORKER_TIMEOUTS` | `render_pdf=30,fetch_jobs=300` | seconds; same format |
| `WORKER_DEFAULT_TIMEOUT` / `WORKER_DEFAULT_CONCURRENCY` | `60` / `1` | types not listed above |
| `WORKER_BACKOFF_BASE` / `WORKER_BACKOFF_MAX` | `30` / `3600` | seconds |
| `WORKER_SHUTDOWN_GRACE` | `30` | seconds |
| `WORKER_RECLAIM_INTERVAL` | `60` | seconds |
| `WORKER_HTTP_ENABLED` / `WORKER_HTTP_HOST` / `WORKER_HTTP_PORT` | `true` / `127.0.0.1` / `8787` | internal only |
| `LOG_LEVEL` | `INFO` | |
| `TYPST_TEMPLATES_DIR` | repo `templates/typst` | Docker: `/app/templates/typst` |
| `RENDER_MAX_PDF_BYTES` / `RENDER_MAX_PAGES` / `RENDER_PHOTO_MAX_BYTES` | `2000000` / `6` / `5000000` | output checks |
| `PREVIEW_CONCURRENCY` / `PREVIEW_WIDTH` | `2` / `900` | `/preview` |

## Internal HTTP

Not exposed publicly (binds 127.0.0.1; in compose only published on the host's
loopback).

- `GET /health` → `{"ok", "db", "worker_id", "slots": {"render_pdf": {"in_use", "max"}, …}, "processed", "failed"}`; 503 if the database is unreachable.
- `POST /preview` → page 1 of a Typst template as PNG (or SVG) for the live
  editor preview. Body `{template_id, data, accent?, paper?, format?: "png"|"svg", width?, photo?}`;
  response headers `X-Page-Count`, `X-Render-Ms`. 400 on bad input / unknown
  template, 422 on a Typst compile error. Compilers are pooled and warmed at
  startup (warm render ≈ 20–40 ms). The Next app proxies it via
  `POST /api/documents/:id/preview` (`WORKER_URL`).

## Rendering (`render_pdf`, Phase 1)

`handlers/render_pdf.py` + `rendering/` + `r2.py`:

- payload `{document_type: "resume"|"cover_letter", document_id, template_id?, accent?, paper?}`
  (defaults: the row's `template`, `content_json.meta.accent/paper`).
- Row lifecycle: `pdf_status` queued (set by the app) → `rendering` → `ready`
  (`pdf_key`, `pdf_url = /api/files/<key>`, `pdf_error` cleared). A failure
  with attempts left puts the row back to `queued` with `pdf_error`; the last
  attempt sets `failed`. Deterministic errors (unknown template, Typst error,
  failed output checks) fail at once without retries.
- Templates from `TYPST_TEMPLATES_DIR` (default repo `templates/typst`, image
  `/app/templates/typst`), bundled fonts only. Photo templates get the photo
  from `basics.image` (data:/http(s)/R2 key) or `profiles.avatar_url`.
- Output checks: page count (≤ `RENDER_MAX_PAGES`, 6), size
  (≤ `RENDER_MAX_PDF_BYTES`, 2 MB), pypdf text contains the name and the
  headings of every non-empty, non-hidden core section (cover letters: name +
  first words).
- R2 key scheme matches `lib/r2.ts`: `{userId}/{resumes|cover-letters}/{company}-{ms}.pdf`;
  the previous object is deleted after a successful re-render.
- The handler has its own deadline (render timeout − 3 s) so it can mark the
  row before the worker's hard timeout.

Docker: the image needs the templates as an extra build context
(`docker compose` sets `additional_contexts: templates: ../templates/typst`;
by hand: `docker build --build-context templates=../templates/typst .`).

## Adding a handler

```python
# orbithire_worker/handlers/render_pdf.py
from ..registry import Task, TaskContext, handler

@handler("render_pdf")
async def render_pdf(task: Task, ctx: TaskContext) -> dict | None:
    ...  # raise to fail/retry; return a JSON-able dict -> tasks.result
```

Then add the module name to `_MODULES` in `orbithire_worker/handlers/__init__.py`.
Sync functions are fine too; they run in a thread.

## Job ingestion (`fetch_jobs`)

`handlers/fetch_jobs.py` + `jobs_db.py`. Payload `{"user_id", "search_id"}` (JobSpy
boards of one `job_searches` row) or `{"user_id", "watchlist": true}` (all enabled
`watched_companies`, fetched 4 at a time). Postings are upserted into `job_postings`
by `dedupe_key` (existing rows: `last_seen_at`, `is_active`, and description / salary
only if they were empty), `job_matches` are created as `new` (an `expired` match seen
again is revived), postings unseen for 14 days become inactive and their
new/shortlisted matches `expired`. Finally one `rank_jobs` task with payload
`{"user_id"}` is enqueued (skipped if one is already queued for the user). Per-source
counts and errors are in `tasks.result`; the task fails (and retries) only when every
source failed.

Scheduling (migration `20250101000020_job_fetch_cron.sql`): pg_cron runs
`enqueue_daily_job_fetches()` at 01:30 UTC (07:00 IST); the app's "Fetch now" calls
`request_job_fetch()` (own user only; refused while a fetch is queued/running or
within 10 minutes of the last one).

Sources (migration `20250101000025_job_sources.sql`): each `job_searches` row has a
`country` (ISO-2, default `IN`) and `sources` (API boards) next to the JobSpy `sites`.
JobSpy uses the country for Indeed/Glassdoor; Naukri runs only for `IN`.

| Source | Regions | Key |
|---|---|---|
| Adzuna | GB, US, CA, AU, NZ, SG, IN, DE, FR, NL, BE, AT, CH, ES, IT, PL | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` |
| Jooble | most countries | `JOOBLE_API_KEY` |
| Reed | GB | `REED_API_KEY` |
| USAJOBS | US | `USAJOBS_API_KEY` + `USAJOBS_USER_AGENT` (your registered email) |
| Bundesagentur für Arbeit | DE | none |
| Arbeitnow | DE, GB | none |
| MyCareersFuture | SG | none |
| Remotive, Remote OK, Himalayas, Jobicy | remote | none |
| Wellfound (scraper, may break) | any (startups; India/US/EU, remote) | none, opt-in |
| Instahyre (scraper, may break) | IN | none, opt-in |
| Cutshort (scraper, may break) | IN | none, opt-in |
| SEEK (scraper, **blocked**) | AU (seek.com.au), NZ (seek.co.nz) | always skipped: needs a browser |

Tier 3 scrapers (migration `20250101000028_scraper_sources.sql`, `fetchers/sources/_scraper.py`)
read public, logged-out pages or the JSON the site's own frontend uses (Wellfound and
Cutshort: `__NEXT_DATA__` on SEO listing pages, Instahyre: `/api/v1/job_search`). They
are never selected by default. They check robots.txt for every exact path (a disallowed
path is listed under `skipped`, nothing is requested), send an honest User-Agent, no
cookies or login, make at most 2 queries per source per run (≤ 30 results each, no
detail pages) with a random 2–5 s pause between requests and no retries. HTTP 403 / 429
or a bot challenge stops that source for the run (`errors[source] = "stopped: ..."` /
`"blocked: requires browser ..."`). `JOB_SCRAPERS_ENABLED=false` turns all of them off,
`SCRAPER_DISABLE=seek,wellfound` single ones (both listed under `skipped`). Instahyre has no
description, salary or date in its listing. SEEK answers plain HTTP with a Cloudflare
challenge and disallows its search API in robots.txt, so it ships blocked. Re-check with
`uv run python tests/fetchers/live_smoke_scrapers.py`.

A keyed source without its key is recorded as `errors[source] = "missing API key"` and
makes no request; a source that doesn't serve the search's country is listed under
`skipped`. Neither fails the task. Per run each API source makes at most 4 queries of up
to 50 results, with a 90 s budget, 4 sources in parallel.

Watchlist ATS boards: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee,
Personio and Teamtailor (`<slug>.teamtailor.com` only).

Each user can have at most 3 job searches (trigger `enforce_job_search_limit()`; the API
returns 409 `search_limit`).

Seed from career-ops:

```bash
uv run python -m orbithire_worker.import_portals --user-email you@example.com \
    --path ~/Desktop/Projects/career-ops/portals.yml [--keyword "Frontend Developer"] \
    [--location Bangalore] [--site linkedin --site naukri] [--results-wanted 20] [--dry-run]
```

## One-time import from ai-job-search (`import_legacy`)

CLI twin of the portal's **Settings → Import** (same rules as `lib/import/*.ts`; keep both
in sync, tests in `tests/test_import_legacy.py` and `scripts/test-import.ts`). Run the
tracker first so the PDFs can be matched to the applications it creates. Both commands
print JSON and accept `--dry-run` (writes nothing).

```bash
# job_search_tracker.csv -> companies (applications)
uv run python -m orbithire_worker.import_legacy tracker \
    --user-email you@example.com --path ~/Desktop/ai-job-search/job_search_tracker.csv --dry-run

# cv/*.pdf -> resumes, cover_letters/*.pdf -> cover letters (source = 'import', pdf_status = 'ready')
uv run python -m orbithire_worker.import_legacy pdfs \
    --user-email you@example.com --path ~/Desktop/ai-job-search --dry-run [--include-examples]
```

- **Tracker**: status mapping `drafted→saved`, `applied→applied`, `interview→interviewing`,
  `offer/hired→offered`, `rejected/no_response→rejected`, `offer_declined/withdrawn→withdrawn`
  (unknown → saved, noted). `date` becomes `applied_at` once a row is past `drafted`. Fit
  rating, sector, role type, channel, deadline, file names and notes go into `notes`.
  Dedupe on (company, job title), case-insensitive: an existing application only gets empty
  fields filled and its status moved forward (never backwards).
- **PDFs**: matched to applications via the tracker's `cv_file` / `cover_letter_file`
  columns, else by filename (`main_<company>_<role>.pdf`: exact role, likely role, company
  only); unmatched files are imported unattached, `*example*` files are skipped. Stored in
  R2 as `{user}/{resumes|cover-letters}/import-<file>.pdf`, which also makes re-runs skip
  files already imported. Text is extracted with pypdf into `resumes.content_text` /
  `cover_letters.content`.
- **Profile** (CLAUDE.md) is portal-only, because each field is reviewed against the
  current value before it is applied.

Use the `R2_*` env of the target environment. For tests, point them at MinIO
(`R2_ENDPOINT=http://127.0.0.1:9000 …`); never import test data into the real bucket.

## Web push (`push_reminders`, morning plan)

PRD area 8. Pushes are signed with VAPID and sent with `pywebpush`; with no keys set every
push path is a no-op.

- **Morning plan**: after `generate_daily_plan` creates a plan, `push/morning.py` pushes it to
  every device (switch: `notification_preferences.morning_plan`). If no device got it and
  `email_fallback` is on, the plan is emailed through Resend instead (R9).
- **Follow-ups and interviews**: pg_cron runs `enqueue_push_reminders()` every 15 minutes;
  the `push_reminders` task finds follow-ups that just came due and interviews within 24 hours,
  claims each in `notification_deliveries` (sent once), and sends one push per person, only
  between 8 AM and 9 PM local time.
- Endpoints answering 404/410 are deleted; other failures bump `failed_count` (dropped at 10).

Keys (same values in the app's env, see `.env.example`):

```bash
npx web-push generate-vapid-keys
# or, without Node:
uv run python -c "from py_vapid import Vapid01 as V; from py_vapid.utils import b64urlencode; \
from cryptography.hazmat.primitives import serialization as s; v=V(); v.generate_keys(); \
print('VAPID_PUBLIC_KEY=' + b64urlencode(v.public_key.public_bytes(s.Encoding.X962, s.PublicFormat.UncompressedPoint))); \
print('VAPID_PRIVATE_KEY=' + b64urlencode(v.private_key.private_numbers().private_value.to_bytes(32, 'big')))"
```

Set `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same value), `VAPID_PRIVATE_KEY` and
`VAPID_SUBJECT=mailto:info@…`. Rotating the private key invalidates existing subscriptions.

## Enqueue a test task

```sql
select enqueue_task('noop', '{"fail": false}'::jsonb, 0, null);
select enqueue_task('noop', '{"fail": true}'::jsonb, 0, null);  -- retried, then failed
```

Or from the admin panel: **Admin → Tasks → Enqueue test task**.

## Tests

```bash
uv run pytest -q
```

Rendering tests (`tests/render/`) start a `supabase/postgres` container with
**all real migrations** applied (override image with `TEST_SUPABASE_PG_IMAGE`,
or point `TEST_SUPABASE_DB_URL` at a scratch DB) and a MinIO container as R2
(`TEST_MINIO_IMAGE`, default `minio/minio:latest`); the real R2 bucket is
never used.

Queue DB tests start a throwaway Postgres container (`docker run postgres:16-alpine`
on a random port; override with `TEST_PG_IMAGE`) and load
`tests/fixtures/tasks.sql`, a copy of the queue contract. `tests/test_fetch_jobs.py`
starts `public.ecr.aws/supabase/postgres:17.11.0.004` and applies the real
`supabase/migrations` (override: `TEST_SUPABASE_PG_IMAGE` / `TEST_SUPABASE_DATABASE_URL`). Set
`TEST_DATABASE_URL` to use an existing scratch database instead (its `tasks`
table is dropped and recreated).
