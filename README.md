# OrbitHire

A personal job-search hub: every morning new jobs are fetched and ranked against your
profile, you review them in a **Job Inbox**, and you get a tailored **resume + cover
letter** (in the portal, or from Claude / ChatGPT over MCP) rendered to PDF and filed
against the application. Applications, follow-ups and documents live in one place.

- How to use it: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- Database (self-hosted Supabase): [docs/DATABASE.md](docs/DATABASE.md)
- Background worker: [worker/README.md](worker/README.md)
- Roadmap / design: `docs/PLAN.md` (local planning document)

## Architecture

```
 Browser ──► Next.js 14 app (UI + API routes + /api/mcp) ◄── Claude / ChatGPT (MCP)
                 │ supabase-js (RLS)          │ enqueue_task()
                 ▼                            ▼
        Self-hosted Supabase (Postgres 17, pgvector, pg_cron)
        profiles · companies (applications) · resumes · cover_letters · document_versions
        job_searches · watched_companies · job_postings · job_matches · tasks (queue)
                 │ LISTEN/NOTIFY + poll (FOR UPDATE SKIP LOCKED)
                 ▼
        worker/ (Python 3.12)
        fetch_jobs  → JobSpy boards, Greenhouse / Lever / Ashby, job APIs
        rank_jobs   → pre-filter → embeddings → LLM top-N with reasons
        render_pdf  → Typst templates → PDF ──────────────────► Cloudflare R2
        digest      → morning email (Resend)
        internal HTTP: /health, /preview (live editor preview)
```

- **Next.js** (`app/`, `components/`, `lib/`): UI, API routes, auth via Supabase cookies.
  Files are served through the authenticated proxy `/api/files/<key>`.
- **Supabase** (`supabase/migrations/`): all data, Row Level Security on every user table,
  the `tasks` queue, and pg_cron (daily fetch at 07:00 IST).
- **Worker** (`worker/`): everything slow or scheduled. The app never waits for it: it
  enqueues a task and the UI polls status (e.g. the PDF badge).
- **Storage**: Cloudflare R2 (S3 API) for PDFs and photos. Locally and in tests you can
  point the `R2_*` variables at MinIO instead.

## Local development

Prerequisites: Node 20, Docker Desktop, Supabase CLI (`brew install supabase`), and
[uv](https://docs.astral.sh/uv/) for the worker.

```bash
cp .env.example .env.local            # fill in values (see below)
npm install
npm run db:start                      # Supabase in Docker; first run downloads images
npm run db:migrate                    # apply new migrations (never needed after db:reset)
npm run dev                           # app on http://localhost:3000

# second terminal: the worker (PDF rendering, job fetch, ranking, digest)
cd worker
cp ../.env.local .env                 # or export DATABASE_URL, R2_*, ...
uv sync
uv run worker
```

Studio (database UI) is at http://127.0.0.1:54323. Without the worker the app still works,
but PDFs stay "Queued", the live Typst preview is unavailable, and no jobs are fetched.

Checks:

```bash
npx tsc --noEmit
npm run build
npx ts-node -T --project tsconfig.scripts.json scripts/test-import.ts   # import helpers
cd worker && uv run pytest -q                                           # worker
```

### Using MinIO instead of R2 (tests, offline dev)

```bash
docker run -d --name orbithire-minio -p 127.0.0.1:9000:9000 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data
# create a bucket (e.g. with the MinIO console on :9001 or boto3), then:
R2_ENDPOINT=http://127.0.0.1:9000 R2_BUCKET=orbithire-dev \
R2_ACCESS_KEY_ID=minioadmin R2_SECRET_ACCESS_KEY=minioadmin npm run dev
```

## Environment variables

`.env.example` lists them all; the app reads `.env.local`, the worker reads `worker/.env`
(same names, so one file can serve both).

| Group | Variables | Notes |
|---|---|---|
| App | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `AUTH_COOKIE_DOMAIN` (prod) | links in emails, cookie domain |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` | `supabase status -o env` locally |
| Storage (R2) | `R2_ENDPOINT` or `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | MinIO works for dev/tests |
| AI | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY` | platform keys; users can add their own in Settings |
| Secrets | `ENCRYPTION_KEY` (≥ 32 chars) | encrypts users' own API keys (app + worker) |
| Email | `RESEND_API_KEY`, `FOLLOW_UP_FROM_EMAIL`, `DIGEST_FROM_EMAIL` | follow-ups and morning digest |
| Worker | `DATABASE_URL` (direct/session connection), `WORKER_URL` (app → worker preview), `WORKER_CONCURRENCY`, `WORKER_TIMEOUTS`, `WORKER_POLL_INTERVAL`, `WORKER_BACKOFF_BASE`, `WORKER_HTTP_HOST`, `WORKER_HTTP_PORT`, `TYPST_TEMPLATES_DIR` | see [worker/README.md](worker/README.md) |
| Ranking | `RANKING_PLATFORM_LLM` (`quota`/`always`/`never`), `RANKING_PLATFORM_DAILY_LIMIT`, optional `RANKING_ANTHROPIC_MODEL`, `RANKING_OPENAI_MODEL`, `EMBEDDING_MODEL` | when the platform key may be used for LLM scoring |
| Job sources | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `REED_API_KEY`, `USAJOBS_API_KEY`, `USAJOBS_USER_AGENT` | optional extra job APIs; a source without keys is skipped |
| MCP | `MCP_RATE_LIMIT_PER_MIN` (60, in-memory per process), `MCP_WRITE_LIMIT_PER_HOUR` (20) | `/api/mcp` limits per token |
| Analytics | `POSTHOG_API_KEY`, `POSTHOG_HOST` | optional |

Never commit `.env.local` / `worker/.env`. The service role key and `DATABASE_URL` bypass
RLS: server and worker only.

## Main features and where they live

| Feature | UI | API / worker |
|---|---|---|
| Job Inbox, shortlist, create application | `/jobs` | `app/api/jobs/**`, `fetch_jobs`, `rank_jobs` |
| Applications + follow-ups | `/companies` | `app/api/companies/**` |
| Resume / cover letter editor, live preview, version history | `/documents/[id]` | `app/api/documents/**`, `render_pdf`, worker `/preview` |
| Templates (Typst: modern, ats-classic, compact, eu-photo, moderncv + cover letters; default `modern`) | `/templates` | `templates/typst/`, `lib/templateCatalog.ts` |
| Failed PDFs + "Retry all" | dashboard, `/companies` | `GET/POST /api/documents/failed` |
| Import from ai-job-search (tracker CSV, PDFs, profile) | Settings → Import (`/import`) | `app/api/import/**`, `worker/orbithire_worker/import_legacy.py` |
| AI connections (MCP for Claude / ChatGPT) | Settings → AI connections | `/api/mcp`, `mcp_tokens` |
| Admin: users, credits, background tasks | `/admin` | service role |

## MCP server

`/api/mcp` is a stateless Streamable HTTP MCP endpoint. Auth: personal access token
`Authorization: Bearer orb_…`, created in Settings → AI connections (scope read or
read+write, shown once, revocable; only a hash is stored in `mcp_tokens`, which also
records `last_client`). Tools: `get_profile`, `search_jobs`, `get_job`,
`list_applications`, `get_application`, `list_templates`, `get_resume_schema`,
`get_document` (read); `save_resume`, `save_cover_letter`, `create_application`,
`update_application_status` (write). Prompts: `tailor_resume(job_id)`,
`write_cover_letter(job_id)`. Every MCP save creates a new resume / cover letter + version
and queues its PDF. Client setup (Claude Desktop via `mcp-remote`, Claude Code) is in
[docs/USER_GUIDE.md](docs/USER_GUIDE.md#7-using-claude-or-chatgpt-mcp); claude.ai and
ChatGPT connectors need OAuth (Phase 5, not built yet). Smoke test: `npm run mcp:smoke`.

## Security notes

- RLS on every user-owned table (`user_id = auth.uid()`); admin pages use the service role.
- Files are private in R2 and served only through `/api/files/<key>` after an auth check.
- `document_versions` are immutable (insert/read/delete only); restoring creates a new version.
- Imports never overwrite silently: tracker rows only fill empty fields, PDFs are deduplicated
  by storage key, profile fields are applied one by one after a side-by-side review.
