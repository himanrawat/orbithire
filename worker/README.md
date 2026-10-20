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
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | – | later phases |
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

## Internal HTTP

Not exposed publicly (binds 127.0.0.1; in compose only published on the host's
loopback).

- `GET /health` → `{"ok", "db", "worker_id", "slots": {"render_pdf": {"in_use", "max"}, …}, "processed", "failed"}`; 503 if the database is unreachable.
- `POST /preview` → 501 until Phase 1 (fast Typst preview).

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

DB tests start a throwaway Postgres container (`docker run postgres:16-alpine`
on a random port; override with `TEST_PG_IMAGE`) and load
`tests/fixtures/tasks.sql`, a copy of the queue contract. Set
`TEST_DATABASE_URL` to use an existing scratch database instead (its `tasks`
table is dropped and recreated).
