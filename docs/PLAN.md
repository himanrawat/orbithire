# OrbitHire v2 – Implementation Plan

Status: **proposed** · Date: 2026-10-20 · Deployment (Oracle Cloud) is out of scope for this plan.

## 1. Goal

Turn OrbitHire into the single hub for the job search:

1. **Every morning** new jobs are fetched automatically (no AI cost), deduplicated and ranked
   against the user's profile.
2. The user reviews a **Job Inbox**, shortlists jobs, and gets a tailored **resume + cover letter**,
   either in the portal or from **Claude / ChatGPT through an MCP server**.
3. Documents are rendered to PDF with **Typst templates** (form fields → template), in a
   **background worker**, and filed against the application.

Decisions already made:

| Topic | Decision |
|---|---|
| Database | Self-hosted Supabase (done – see [DATABASE.md](DATABASE.md)) |
| File storage | Keep Cloudflare R2 |
| Document engine | **Typst**, template mode only (users fill fields, never edit markup) |
| Existing 9 HTML templates | Keep until Typst is complete, then retire (Phase 7) |
| Job sources | **JobSpy** (LinkedIn, Indeed, Naukri, Glassdoor, Google) + **Greenhouse / Lever / Ashby** public APIs |
| Seed watchlist | Import `career-ops/portals.yml` (companies + keyword filters) |
| `ai-job-search` / `career-ops` | Not used at runtime; mined for templates, scoring rubric, watchlist, and history import |

## 2. Target architecture

```
                    ┌──────────────────────── Next.js app (existing) ────────────────────────┐
 Browser ─────────► │ UI: Job Inbox · Applications · Document editor · Templates · Settings  │
                    │ API routes (existing + new)          /api/mcp  ◄──── Claude / ChatGPT  │
                    └──────────────┬───────────────────────────┬─────────────────────────────┘
                                   │ supabase-js (RLS)          │ enqueue tasks
                                   ▼                            ▼
                    ┌──────────── Self-hosted Supabase (Postgres) ────────────┐
                    │ profiles · companies(applications) · resumes · cover_…  │
                    │ job_postings · job_matches · job_searches · tasks queue │
                    │ pg_cron (07:00 IST → enqueue fetch)  ·  pgvector        │
                    └──────────────┬──────────────────────────────────────────┘
                                   │ LISTEN/NOTIFY + poll (FOR UPDATE SKIP LOCKED)
                                   ▼
                    ┌──────────── worker/ (Python, new) ─────────────┐
                    │ fetch_jobs   → JobSpy + ATS APIs               │
                    │ rank_jobs    → filters → embeddings → LLM      │
                    │ render_pdf   → Typst → R2                      │──► Cloudflare R2
                    │ thumbnails · digest email                      │──► Resend
                    │ internal HTTP: POST /preview (fast Typst)      │
                    └────────────────────────────────────────────────┘
```

Why a **Python worker**: JobSpy and the `typst` package (Rust compiler with Python bindings)
are both Python, so one small service covers fetching, ranking and rendering. Next.js stays the
UI/API/MCP layer. The worker talks to Postgres with the service role and to R2 with the existing
credentials.

Why a **Postgres task queue** (not Redis/BullMQ): one less service, transactional with the data,
visible in Studio, retries and dead-letters are just columns.

## 3. Data model (new migrations)

All new tables get RLS keyed on `user_id` where user-owned. Worker uses the service role.

**`tasks`** – the queue
`id, type (fetch_jobs|rank_jobs|render_pdf|thumbnail|digest), payload jsonb, status (queued|running|done|failed), priority int, attempts, max_attempts, run_after, locked_at, locked_by, last_error, result jsonb, created_at`
Index on `(status, priority desc, run_after)`. `NOTIFY tasks_new` trigger on insert.

**`job_searches`** – per-user search settings
`user_id, name, keywords text[], locations text[], sites text[], remote_ok, hours_old (default 24), results_wanted, enabled`

**`watched_companies`** – per-user ATS watchlist
`user_id, company, ats (greenhouse|lever|ashby), board_token, careers_url, enabled`

**`job_postings`** – global, deduplicated
`id, dedupe_key unique (normalized company + title + location), source, external_id, url, title, company, location, is_remote, salary_min, salary_max, currency, description, posted_at, first_seen_at, last_seen_at, is_active, raw jsonb, embedding vector(1536)`

**`job_matches`** – a posting as seen by one user
`user_id, job_posting_id, search_id, prefilter_pass, similarity, llm_score, llm_reasons jsonb, deal_breakers jsonb, status (new|shortlisted|skipped|applied|expired), company_id (set when it becomes an application), seen_at`

**Changes to existing tables**
- `resumes`, `cover_letters`: add `engine ('html'|'typst') default 'html'`, `pdf_status (none|queued|rendering|ready|failed)`, `pdf_error`, `source ('portal'|'mcp'|'import')`, `source_client` (e.g. `claude`, `chatgpt`), `job_posting_id`.
- `cover_letters`: add `content_json` (`{recipient, salutation, paragraphs[], closing}`); keep `content` text for old rows.
- `document_versions`: `document_type, document_id, version, content_json, source, created_at` – every save from the portal or MCP creates a version.
- `mcp_tokens`: `user_id, name, token_hash, scopes, last_used_at, revoked_at` (personal access tokens, Phase 4).

Existing `companies` stays the "application" record (it already has job title/url/status/history).

## 4. Components

### 4.1 Worker service (`worker/`)

- Python 3.12, managed with `uv`; deps: `python-jobspy`, `typst`, `psycopg`, `boto3` (R2), `httpx`, `openai`/`anthropic`, `pydantic`.
- Loop: `LISTEN tasks_new` + poll every 10 s → claim with `FOR UPDATE SKIP LOCKED` → run handler →
  mark done/failed; exponential backoff; `max_attempts` then `failed` (shown in UI).
- Concurrency: 2 render + 1 fetch slot (configurable). Hard timeout per task (render 30 s, fetch 5 min).
- Internal-only HTTP (`/preview`, `/health`) for live previews; not exposed publicly.
- Runs locally via `docker compose` next to `supabase start`, or `uv run worker` for development.

### 4.2 Typst document engine

- Templates live in `templates/typst/<id>/` → `main.typ`, `meta.json` (name, kind `resume|cover_letter`, regions, photo slot), `thumbnail.png`.
- **Input = the existing JSON Resume** (`resumes.content_json`) passed via `sys.inputs`. Values are
  data, not markup, so user text cannot inject commands – no escaping layer needed.
- First set (Phase 1): `ats-classic` (Jake-style single column), `modern` (accent header), `compact`
  (one-page dense), `eu-photo` (photo slot for DE/EU), plus `cover-classic` and `cover-modern`.
  Port the look of the moderncv CV + `cover.cls` from `ai-job-search` as one of them.
- Fonts bundled in the repo (no network at compile time). Typst packages vendored, not fetched.
- Output checks after each render: page count, embedded text extract (ATS parse check), size.
- Preview: editor calls `POST /api/documents/:id/preview` → worker `/preview` → PNG/SVG of page 1
  in ~100–300 ms. (Later option: compile in the browser with typst.ts/WASM.)
- Persisted PDFs always go through the queue → R2 → `pdf_status = ready`.

### 4.3 Job ingestion (morning cron)

- `pg_cron` at **07:00 IST (01:30 UTC)** inserts one `fetch_jobs` task per enabled `job_search`
  and one per user watchlist. User can also press "Fetch now".
- `fetch_jobs` handler:
  - JobSpy: `scrape_jobs(site_name=sites, search_term, location, hours_old, results_wanted, country_indeed="india")`.
  - ATS: Greenhouse `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`, Lever
    `api.lever.co/v0/postings/{company}?mode=json`, Ashby `api.ashbyhq.com/posting-api/job-board/{name}`.
  - Normalize → `dedupe_key` → upsert `job_postings` (update `last_seen_at`) → create `job_matches`.
  - Mark postings not seen for 14 days as `is_active = false` (→ match `expired`).
  - Then enqueue `rank_jobs` for the user.
- Politeness: low volume, randomized delays, respect `robots.txt` for career pages, LinkedIn guest
  endpoints only (no login). Optional proxy setting if LinkedIn rate-limits.
- Seeding: one-time import of `career-ops/portals.yml` → `watched_companies` + keyword filters into
  the user's default `job_search`.

### 4.4 Ranking (cheap first, AI last)

1. **Pre-filter (free):** title include/exclude keywords, location/remote rules, deal-breakers
   (e.g. salary below ₹12 LPA when disclosed, mandatory languages, no visa sponsorship abroad).
2. **Similarity (≈free):** embed posting + profile (`text-embedding-3-small`), store in `pgvector`,
   cosine similarity.
3. **LLM score (top 15/day):** structured JSON score 0–100 with reasons: skills fit, seniority fit,
   compensation evidence, freshness, location/eligibility; rubric adapted from `ai-job-search`
   (`/rank`). Uses the user's own API key from settings when present (existing encrypted key
   storage), else platform key subject to the existing generation quota.

### 4.5 Portal UI

- **Job Inbox** (`/jobs`): today's matches sorted by score; filters (source, remote, salary, score);
  card shows title, company, location, salary, posted date, score + reasons; actions **Shortlist /
  Skip / Open posting / Create application**.
- **Job detail:** full description, score breakdown, "Generate documents" (portal AI) or "Copy MCP
  prompt" (for Claude/ChatGPT).
- **Create application:** creates the `companies` row from the posting (title, url, salary, JD),
  links the match, and starts follow-up tracking (existing logic).
- **Document editor:** existing form fields on the left, live Typst preview on the right, template
  picker, version history, PDF status badge (queued/rendering/ready/failed + retry).
- **Templates gallery:** Typst and (temporarily) HTML templates with thumbnails, labeled.
- **Settings → Job search:** searches, sites, locations, watchlist companies, fetch time.
- **Settings → AI connections:** create/revoke MCP tokens, copy-paste setup for Claude Desktop,
  Claude.ai, ChatGPT.
- **Morning digest email** (Resend): top 5 new matches with links (opt-out in settings).

### 4.6 MCP server

- Next.js route **`/api/mcp`**, `@modelcontextprotocol/sdk`, Streamable HTTP transport (required
  by ChatGPT; works with Claude).
- **Tools**
  | Tool | Kind | Purpose |
  |---|---|---|
  | `get_profile` | read | Candidate profile + master resume (JSON Resume) |
  | `search_jobs` | read | Query Job Inbox (status, min score, text) |
  | `get_job` | read | Full posting + score reasons |
  | `list_applications` / `get_application` | read | Existing applications and their documents |
  | `list_templates` | read | Typst templates with ids and descriptions |
  | `get_resume_schema` | read | JSON schema the AI must fill (validated server-side) |
  | `save_resume` | write | Validate JSON Resume → new resume + version, link to job/application, enqueue PDF |
  | `save_cover_letter` | write | Same for cover letter `content_json` |
  | `create_application` | write | From a job id |
  | `update_application_status` | write | Applied / interview / offer / rejected |
  | `get_document` | read | Status + PDF link once ready |
- **Prompts:** `tailor_resume(job_id)` and `write_cover_letter(job_id)` carrying the guidelines
  (truthful – no invented experience, ATS keywords only when supported, honest gaps), adapted from
  the `ai-job-search` drafter/reviewer instructions.
- Generation happens in the user's Claude/ChatGPT subscription → no AI cost to OrbitHire for MCP use;
  only rendering runs on our side.
- **Auth – two steps**
  1. **Phase 4: personal access tokens** (`Authorization: Bearer orb_…`, stored hashed). Works with
     Claude Desktop / Claude Code and for testing.
  2. **Phase 5: OAuth 2.1** (authorization code + PKCE + dynamic client registration), required for
     claude.ai and ChatGPT custom connectors. Preferred: Supabase Auth's OAuth 2.1 server (users
     log in with their OrbitHire account, consent page in our app). Fallback if it isn't usable on
     self-hosted yet: a small OAuth server inside Next.js backed by Supabase sessions.
- Every write tool is scoped to the token's user; rate-limited; logged in `user_activities`.

### 4.7 Imports from the old workflow (one-time)

- `ai-job-search/job_search_tracker.csv` → `companies` (applications) with status + fit.
- Existing PDFs in `cv/` and `cover_letters/` → R2, attached as `source = 'import'` documents.
- Candidate profile in `ai-job-search/CLAUDE.md` → review and merge into the OrbitHire profile.
- `career-ops/portals.yml` → watchlist + filters (see 4.3).

## 5. Phases

Each phase ends with something usable. Sizes: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks.

| # | Phase | Delivers | Size |
|---|---|---|---|
| 0 | **Foundations** | `tasks` table + `NOTIFY`, `worker/` skeleton (claim/retry/timeout), local compose, health check, task list in admin | S |
| 1 | **Typst rendering** | 4 resume + 2 cover templates, `render_pdf` → R2, `pdf_status` everywhere, editor live preview, template gallery; HTML path unchanged; company-create flow moved to the queue (fixes silent PDF failures) | L |
| 2 | **Job ingestion** | `job_searches`, `watched_companies`, `job_postings`, `job_matches`; JobSpy + ATS fetchers; pg_cron 07:00 IST; "Fetch now"; Job Inbox UI; portals.yml import | L |
| 3 | **Ranking** | pre-filter, pgvector similarity, LLM top-N scoring with reasons; score UI; morning digest email | M |
| 4 | **MCP server (tokens)** | `/api/mcp` with all tools + prompts, token management UI, verified end-to-end in Claude Desktop | M |
| 5 | **MCP OAuth** | OAuth 2.1 + consent page; connect from claude.ai and ChatGPT; setup guide in Settings | M |
| 6 | **Imports & polish** | tracker CSV + PDF import, profile merge, version history UI, failure retries, docs | M |
| 7 | **Retire HTML** | migrate remaining users/templates to Typst defaults, remove Puppeteer + `@sparticuz/chromium` + `/api/resume/render` | S |

Order rationale: rendering (1) is needed before MCP can save documents with PDFs; jobs (2–3) are the
other half of the morning flow; MCP (4–5) builds on both.

### Acceptance checks per phase

- **0:** a dummy task enqueued from the app is processed, retried on failure, visible as failed after max attempts.
- **1:** create an application with a resume → API returns immediately → PDF appears within ~5 s; 10 parallel saves don't exceed 2 renders at once; extracted PDF text contains all section headings.
- **2:** at 07:00 IST new postings appear in the Inbox; rerunning the fetch creates no duplicates; LinkedIn + Naukri + one Greenhouse company verified.
- **3:** Inbox order matches LLM scores; deal-breaker jobs are hidden by default with the reason shown; daily LLM calls ≤ configured N.
- **4:** in Claude Desktop: "tailor my resume for the top job in my inbox" → resume appears in the portal under that application with a ready PDF.
- **5:** same flow from claude.ai and from ChatGPT (developer mode connector) after OAuth login.

## 6. Risks and open points

| Risk | Mitigation |
|---|---|
| LinkedIn/Naukri change or block scraping | Multiple sources; ATS APIs as reliable base; per-source health in admin; JobSpy updates pinned + monitored |
| Scraping terms of service | Personal-scale volume, guest endpoints only, no login automation, store links not full republishing |
| Supabase OAuth 2.1 server maturity on self-hosted | Token auth first (Phase 4); fallback OAuth implementation planned |
| ChatGPT connector rules change (plan tiers, developer mode) | Keep MCP standards-compliant; Claude path doesn't depend on it |
| AI writing untrue resume content | Server-side schema validation; prompts enforce truthfulness; every MCP save is a new version the user reviews before applying |
| Typst template quality vs. current HTML | Keep HTML until Typst parity (Phase 7 is gated on your sign-off) |

**Questions to settle during Phase 1–2 (not blocking the start):**
1. Is the portal multi-user from day one for jobs, or just you first? (Schema supports both.)
2. Extra job sources beyond JobSpy + ATS (Wellfound, Instahyre, Cutshort)?
3. Default fetch time – 07:00 IST OK?

## 7. Out of scope here

- Oracle Cloud deployment, HTTPS, backups (separate plan).
- Auto-applying to jobs – OrbitHire prepares, the user submits.
- Raw Typst/LaTeX editing by users.
