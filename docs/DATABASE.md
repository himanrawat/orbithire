# Database Guide (self-hosted Supabase)

OrbitHire uses **self-hosted Supabase** running in Docker. Nothing is billed by Supabase:
you only pay for the machine it runs on. File storage stays on Cloudflare R2.

- [What runs where](#what-runs-where)
- [Daily commands](#daily-commands)
- [Looking at data and running queries](#looking-at-data-and-running-queries)
- [Changing the schema (migrations)](#changing-the-schema-migrations)
- [Backups and restore](#backups-and-restore)
- [Troubleshooting](#troubleshooting)
- [Moving to your own server](#moving-to-your-own-server)

---

## What runs where

`supabase start` launches these Docker containers (all named `supabase_*_orbithire`):

| Container | Purpose | Local URL / port |
|---|---|---|
| `db` | Postgres 17 – all app data | `127.0.0.1:54322` |
| `kong` | API gateway the app talks to | `http://127.0.0.1:54321` |
| `auth` | Signup / login / JWT (GoTrue) | via gateway |
| `rest` | Auto REST API over tables (PostgREST) | via gateway |
| `studio` | Web dashboard | `http://127.0.0.1:54323` |
| `inbucket` | Catches auth emails locally (Mailpit) | `http://127.0.0.1:54324` |
| `realtime`, `storage`, `edge_runtime`, `pg_meta`, `analytics`, `vector` | Supporting services | – |

Data lives in a Docker volume, so it survives `supabase stop` and reboots.

Project config: [`supabase/config.toml`](../supabase/config.toml).
Schema history: [`supabase/migrations/`](../supabase/migrations/).

## Prerequisites

- Docker Desktop running (give it at least 4 GB RAM)
- Supabase CLI: `brew install supabase` (check with `supabase --version`)

## Daily commands

```bash
npm run db:start     # start Supabase (first run downloads images, a few minutes)
npm run dev          # start the app on http://localhost:3000
npm run db:status    # show URLs and keys
npm run db:stop      # stop Supabase, keeps data
```

The app reads these from `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API_URL` from `supabase status -o env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` (server only, never in browser code) |
| `SUPABASE_JWT_SECRET` | `JWT_SECRET` |

Local keys are the public Supabase demo keys – fine for your laptop, **never** for a server.

## Looking at data and running queries

### Option 1 – Supabase Studio (easiest)

Open <http://127.0.0.1:54323>.

- **Table Editor** – browse, filter, and edit rows like a spreadsheet
- **SQL Editor** – write and run any SQL
- **Authentication** – registered users, reset passwords, delete users
- **Database → Policies** – Row Level Security rules per table

### Option 2 – Desktop client (TablePlus, DBeaver, pgAdmin, Postico, VS Code)

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `54322` |
| User | `postgres` |
| Password | `postgres` |
| Database | `postgres` |

Or as one URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Option 3 – Terminal (psql)

No install needed – use the psql inside the database container:

```bash
docker exec -it supabase_db_orbithire psql -U postgres
```

Run a single query without opening a shell:

```bash
docker exec supabase_db_orbithire psql -U postgres -c "select email, created_at from auth.users;"
```

(Optional: `brew install libpq` gives you `psql` on your Mac directly.)

### Useful psql commands and queries

```sql
\dt public.*                 -- list app tables
\d companies                 -- columns of a table
\q                           -- quit

-- Users and their profiles
select u.email, u.created_at, p.full_name, p.onboarding_completed
from auth.users u join public.profiles p on p.id = u.id
order by u.created_at desc;

-- Applications per status
select status, count(*) from companies group by status;

-- Latest generated resumes
select user_id, title, created_at from resumes order by created_at desc limit 10;

-- Admins
select * from admin_users;
```

**Note:** the `postgres` user bypasses Row Level Security, so you see every user's data.
The app itself goes through RLS with the logged-in user's token.

## Changing the schema (migrations)

Never change tables by hand in Studio for anything you want to keep – it won't reach your
server. Always use a migration file:

```bash
supabase migration new add_jobs_table        # creates supabase/migrations/<timestamp>_add_jobs_table.sql
# write your SQL in that file
npm run db:migrate                           # apply new migrations to the local DB
```

Commit the migration file. On the server, the same files are applied (see below).

`supabase/schema.sql` is the original baseline, kept for reference. The real source of truth
is `supabase/migrations/` (its first file is a copy of `schema.sql`).

Functions marked `SECURITY DEFINER` must pin `search_path` (see migration
`20250101000015_pin_function_search_path.sql`), otherwise triggers on `auth.users` fail with
"Database error saving new user".

## Backups and restore

**Back up data** (users + app tables):

```bash
mkdir -p backups
supabase db dump --local --data-only -s public,auth -f backups/data-$(date +%F).sql
```

**Back up schema only:**

```bash
supabase db dump --local -f backups/schema-$(date +%F).sql
```

**Restore** into a fresh database:

```bash
npm run db:reset                                                       # rebuild schema from migrations
docker exec -i supabase_db_orbithire psql -U postgres < backups/data-2026-10-20.sql
```

⚠️ `npm run db:reset` **deletes all data** and re-runs migrations. Back up first.

Keep `backups/` out of git – it contains personal data.

## Troubleshooting

| Problem | Fix |
|---|---|
| `supabase` exits instantly / "killed" (exit 137) | Broken binary signature: `brew reinstall supabase` |
| `Cannot connect to the Docker daemon` | Start Docker Desktop |
| Port 54321/54322 already in use | `supabase stop --all`, or change ports in `supabase/config.toml` |
| Signup returns "Database error saving new user" | `docker logs supabase_auth_orbithire` – usually a trigger error; see migrations note above |
| Confirmation / reset emails never arrive locally | They are caught by Mailpit: <http://127.0.0.1:54324> |
| Need a clean slate | `npm run db:reset` (wipes data) |

## Moving to your own server

`supabase start` is a **development** setup. On a server, use Supabase's official
Docker Compose stack instead.

1. **Server**: Linux VPS with 2–4 GB RAM, Docker + Docker Compose, a domain
   (e.g. `db.himanshurawat.in`) pointing at it.
2. **Install**: follow <https://supabase.com/docs/guides/self-hosting/docker> – clone
   `supabase/supabase`, copy `docker/` to the server, `cp .env.example .env`.
3. **Secrets** – in that `docker/.env`, replace every default:
   `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` (generate keys from
   the new `JWT_SECRET`), `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`.
4. **Auth settings**: `SITE_URL` = your app URL, `ADDITIONAL_REDIRECT_URLS`, and real SMTP
   (e.g. Resend SMTP) so confirmation and reset emails are delivered.
5. **HTTPS**: put Caddy or Nginx in front of the Kong port (8000) with a TLS certificate.
6. **Apply schema** from your laptop:
   ```bash
   supabase db push --db-url "postgresql://postgres:<password>@<server>:5432/postgres"
   ```
   (or through an SSH tunnel, see step 8).
7. **Point the app at it** – set in the app's production environment:
   `NEXT_PUBLIC_SUPABASE_URL=https://db.himanshurawat.in`, plus the new anon key,
   service role key, and JWT secret.
8. **Lock down Postgres**: don't open port 5432 to the internet. Connect from your laptop
   with an SSH tunnel and use the same tools as above:
   ```bash
   ssh -L 54322:localhost:5432 user@your-server
   # now connect TablePlus/psql to 127.0.0.1:54322 with the server's POSTGRES_PASSWORD
   ```
   Studio on the server is protected by `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` – keep
   it behind HTTPS or the tunnel too.
9. **Backups**: schedule a nightly `pg_dump` (cron) and copy it off the server
   (e.g. to R2).
10. **First admin**: the migrations create an admin access code but no admin user –
    sign up through the admin signup flow, or insert into `admin_users` from psql.

### Leaving Supabase Cloud

If an old supabase.com project holds data you need:

```bash
supabase db dump --db-url "<cloud connection string>" --data-only -s public,auth -f backups/cloud-data.sql
docker exec -i supabase_db_orbithire psql -U postgres < backups/cloud-data.sql
```

Then pause or delete the project in the supabase.com dashboard so it can no longer bill you.
