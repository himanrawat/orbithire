"""fetch_jobs handler against a throwaway Supabase Postgres with the REAL
migrations (supabase/migrations/*.sql) applied. Fetchers are mocked.

Uses `public.ecr.aws/supabase/postgres` (has the auth schema, roles and pg_cron
preloaded); override with TEST_SUPABASE_PG_IMAGE, or point
TEST_SUPABASE_DATABASE_URL at a scratch database that already has the
migrations applied.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterator

import psycopg
import pytest
from psycopg_pool import AsyncConnectionPool

from orbithire_worker import fetchers, jobs_db
from orbithire_worker.fetchers import FetchResult, NormalizedPosting, parse_portals
from orbithire_worker.handlers import fetch_jobs as fj
from orbithire_worker.registry import Task, TaskContext
from orbithire_worker.settings import Settings

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
IMAGE = os.environ.get("TEST_SUPABASE_PG_IMAGE", "public.ecr.aws/supabase/postgres:17.11.0.004")


def _wait(url: str, timeout: float = 120) -> None:
    deadline = time.time() + timeout
    last: Exception | None = None
    while time.time() < deadline:
        try:
            with psycopg.connect(url, connect_timeout=2) as c:
                if c.execute("SELECT to_regclass('auth.users') IS NOT NULL").fetchone()[0]:
                    return
        except Exception as e:  # noqa: BLE001
            last = e
        time.sleep(1)
    raise RuntimeError(f"supabase postgres not ready: {last}")


@pytest.fixture(scope="module")
def supa_url() -> Iterator[str]:
    url = os.environ.get("TEST_SUPABASE_DATABASE_URL")
    if url:
        yield url
        return
    if not shutil.which("docker"):
        pytest.skip("docker not available")
    name = f"orbithire-fetch-test-{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", name, "-e", "POSTGRES_PASSWORD=postgres",
         "-p", "127.0.0.1::5432", IMAGE],
        check=True, capture_output=True,
    )
    try:
        port = subprocess.run(
            ["docker", "port", name, "5432/tcp"], check=True, capture_output=True, text=True
        ).stdout.strip().splitlines()[0].rsplit(":", 1)[1]
        url = f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres"
        _wait(url)
        time.sleep(2)
        _wait(url)
        with psycopg.connect(url, autocommit=True) as c:
            for f in sorted(MIGRATIONS.glob("*.sql")):
                c.execute(f.read_text())
        yield url
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)


@pytest.fixture
async def ctx(supa_url: str):
    pool = AsyncConnectionPool(supa_url, min_size=1, max_size=3, kwargs={"autocommit": True}, open=False)
    await pool.open(wait=True)
    async with pool.connection() as c:
        await c.execute("TRUNCATE tasks, job_matches, job_postings, job_searches, watched_companies CASCADE")
    yield TaskContext(worker_id="test", settings=Settings(_env_file=None, database_url=supa_url), pool=pool)
    await pool.close()


@pytest.fixture
def user_id(supa_url: str) -> str:
    uid = str(uuid.uuid4())
    with psycopg.connect(supa_url, autocommit=True) as c:
        c.execute("INSERT INTO auth.users (id, email) VALUES (%s, %s)", (uid, f"{uid}@test.local"))
        c.execute(
            "INSERT INTO profiles (id, email) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
            (uid, f"{uid}@test.local"),
        )
    return uid


def posting(i: int, source: str = "linkedin", **kw) -> NormalizedPosting:
    return NormalizedPosting(
        source=source,
        external_id=f"{source}-{i}",
        url=f"https://example.com/{source}/{i}",
        title=kw.pop("title", f"Frontend Engineer {i}"),
        company=kw.pop("company", f"Acme {i}"),
        location=kw.pop("location", "Bengaluru, India"),
        posted_at=datetime(2026, 10, 19, tzinfo=UTC),
        **kw,
    )


def make_task(payload: dict) -> Task:
    return Task(id=uuid.uuid4(), type="fetch_jobs", payload=payload, status="running",
                priority=0, attempts=1, max_attempts=3)


async def scalar(ctx, sql: str, *args):
    async with ctx.pool.connection() as c:
        cur = await c.execute(sql, args)
        return (await cur.fetchone())[0]


async def make_search(ctx, user_id: str, **kw) -> str:
    async with ctx.pool.connection() as c:
        cur = await c.execute(
            """INSERT INTO job_searches (user_id, keywords, sites, results_wanted)
               VALUES (%s, %s, %s, 5) RETURNING id""",
            (user_id, kw.get("keywords", ["frontend"]), kw.get("sites", ["linkedin", "naukri"])),
        )
        return str((await cur.fetchone())[0])


# --------------------------------------------------------------------------- tests


async def test_search_fetch_inserts_then_rerun_has_no_duplicates(ctx, user_id, monkeypatch):
    batch = [posting(i) for i in range(5)]
    # posting without description/salary first; later run supplies them
    batch.append(posting(99, source="naukri"))
    calls = []

    async def fake_fetch_search(spec, **_kw):
        calls.append(spec)
        return FetchResult(postings=list(batch), counts={"linkedin": 5, "naukri": 1},
                           errors={"naukri": "partial: 1 query blocked"})

    monkeypatch.setattr(fetchers, "fetch_search", fake_fetch_search)
    search_id = await make_search(ctx, user_id)

    r1 = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": search_id}), ctx)
    assert calls[0].keywords == ["frontend"] and calls[0].results_wanted == 5
    assert r1["postings_inserted"] == 6 and r1["matches_created"] == 6
    assert r1["sources"]["linkedin"] == {"fetched": 5}
    assert "error" in r1["sources"]["naukri"]
    assert await scalar(ctx, "SELECT count(*) FROM job_postings") == 6
    assert await scalar(
        ctx, "SELECT count(*) FROM job_matches WHERE user_id=%s AND status='new' "
        "AND prefilter_pass IS NULL AND search_id=%s", user_id, search_id) == 6

    # rank_jobs enqueued with {user_id}
    assert r1["rank_task_created"] is True
    payload = await scalar(ctx, "SELECT payload FROM tasks WHERE type='rank_jobs' AND user_id=%s", user_id)
    assert payload == {"user_id": user_id}

    before = await scalar(ctx, "SELECT max(last_seen_at) FROM job_postings")
    # rerun: same jobs (one now with description + salary, one re-titled duplicate
    # spelling that normalises to the same dedupe_key)
    batch[-1] = posting(99, source="naukri", description="Full JD", salary_min=1_500_000,
                        salary_max=2_500_000, currency="INR")
    batch.append(posting(0, title="Front-End Engineer 0", location="Bangalore"))
    r2 = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": search_id}), ctx)
    assert r2["postings_inserted"] == 0
    assert r2["matches_created"] == 0
    assert r2["postings_updated"] == 6
    assert await scalar(ctx, "SELECT count(*) FROM job_postings") == 6
    assert await scalar(ctx, "SELECT count(*) FROM job_matches") == 6
    assert await scalar(ctx, "SELECT min(last_seen_at) FROM job_postings") > before
    desc, smin, interval = None, None, None
    async with ctx.pool.connection() as c:
        cur = await c.execute(
            "SELECT description, salary_min, salary_interval FROM job_postings WHERE external_id='naukri-99'")
        desc, smin, interval = await cur.fetchone()
    assert desc == "Full JD" and float(smin) == 1_500_000 and interval == "yearly"
    # still exactly one queued rank_jobs task for the user
    assert r2["rank_task_created"] is False
    assert await scalar(ctx, "SELECT count(*) FROM tasks WHERE type='rank_jobs'") == 1


async def test_description_not_overwritten_once_set(ctx, user_id, monkeypatch):
    first = [posting(1, description="original")]
    second = [posting(1, description="changed")]
    seq = iter([first, second])

    async def fake(spec, **_kw):
        return FetchResult(postings=next(seq), counts={"linkedin": 1})

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    sid = await make_search(ctx, user_id)
    await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    assert await scalar(ctx, "SELECT description FROM job_postings") == "original"


async def test_14_day_expiry(ctx, user_id, monkeypatch):
    async def fake(spec, **_kw):
        return FetchResult(postings=[posting(1), posting(2), posting(3)], counts={"linkedin": 3})

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    sid = await make_search(ctx, user_id)
    await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    async with ctx.pool.connection() as c:
        # posting 2: stale + shortlisted; posting 3: stale + skipped (kept as is)
        await c.execute("UPDATE job_postings SET last_seen_at = now() - interval '15 days' "
                        "WHERE external_id IN ('linkedin-2','linkedin-3')")
        await c.execute("UPDATE job_matches m SET status='shortlisted' FROM job_postings p "
                        "WHERE p.id=m.job_posting_id AND p.external_id='linkedin-2'")
        await c.execute("UPDATE job_matches m SET status='skipped' FROM job_postings p "
                        "WHERE p.id=m.job_posting_id AND p.external_id='linkedin-3'")

    async def fake_only_1(spec, **_kw):
        return FetchResult(postings=[posting(1)], counts={"linkedin": 1})

    monkeypatch.setattr(fetchers, "fetch_search", fake_only_1)
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    assert r["expired"] == {"postings": 2, "matches": 1}
    rows = {}
    async with ctx.pool.connection() as c:
        cur = await c.execute("SELECT p.external_id, p.is_active, m.status FROM job_matches m "
                              "JOIN job_postings p ON p.id=m.job_posting_id")
        for ext, active, status in await cur.fetchall():
            rows[ext] = (active, status)
    assert rows == {
        "linkedin-1": (True, "new"),
        "linkedin-2": (False, "expired"),
        "linkedin-3": (False, "skipped"),
    }

    # seen again later -> active, match revived to 'new'
    async def fake_2(spec, **_kw):
        return FetchResult(postings=[posting(2)], counts={"linkedin": 1})

    monkeypatch.setattr(fetchers, "fetch_search", fake_2)
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    assert r["matches_revived"] == 1
    assert await scalar(ctx, "SELECT m.status FROM job_matches m JOIN job_postings p ON "
                             "p.id=m.job_posting_id WHERE p.external_id='linkedin-2'") == "new"


async def test_watchlist_bounded_concurrency_and_filters(ctx, user_id, monkeypatch):
    import asyncio

    async with ctx.pool.connection() as c:
        for i in range(10):
            await c.execute(
                "INSERT INTO watched_companies (user_id, company, ats, board_token) VALUES (%s,%s,'greenhouse',%s)",
                (user_id, f"Co{i}", f"co{i}"))
        await c.execute(
            "INSERT INTO watched_companies (user_id, company, ats, board_token, enabled) "
            "VALUES (%s,'Off','lever','off',false)", (user_id,))
        await c.execute(
            "INSERT INTO job_searches (user_id, keywords, include_keywords, exclude_keywords) "
            "VALUES (%s, '{react}', '{Frontend}', '{Junior}')", (user_id,))

    active = 0
    peak = 0
    seen_filters = []

    async def fake_company(company, *, include=None, exclude=None, client=None):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.05)
        active -= 1
        seen_filters.append((tuple(include), tuple(exclude)))
        if company.company == "Co3":
            return FetchResult(errors={"greenhouse": "board not found (404)"}, counts={"greenhouse": 0})
        n = int(company.company[2:])
        return FetchResult(postings=[posting(n, source="greenhouse", company=company.company)],
                           counts={"greenhouse": 4})

    monkeypatch.setattr(fetchers, "fetch_company", fake_company)
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "watchlist": True}), ctx)
    assert peak <= fj.ATS_CONCURRENCY and peak > 1
    assert len(seen_filters) == 10  # disabled company not fetched
    assert seen_filters[0] == (("Frontend",), ("Junior",))
    assert r["kind"] == "watchlist" and r["companies_failed"] == 1
    assert "Co3" in r["errors"]
    assert r["postings_inserted"] == 9 and r["matches_created"] == 9
    assert await scalar(ctx, "SELECT count(*) FROM job_matches WHERE search_id IS NULL") == 9
    assert r["rank_task_id"]


async def test_all_sources_failed_raises(ctx, user_id, monkeypatch):
    async def fake(spec, **_kw):
        return FetchResult(errors={"linkedin": "429", "naukri": "blocked"},
                           counts={"linkedin": 0, "naukri": 0})

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    sid = await make_search(ctx, user_id)
    with pytest.raises(fj.FetchJobsError):
        await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    assert await scalar(ctx, "SELECT count(*) FROM tasks WHERE type='rank_jobs'") == 0


async def test_unknown_search_is_skipped(ctx, user_id):
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": str(uuid.uuid4())}), ctx)
    assert r["skipped"] == "search not found"


async def test_cron_and_fetch_now_rpc(ctx, user_id, supa_url):
    sid = await make_search(ctx, user_id)
    with psycopg.connect(supa_url, autocommit=True) as c:
        c.execute("INSERT INTO watched_companies (user_id, company, ats, board_token) "
                  "VALUES (%s,'Vercel','greenhouse','vercel')", (user_id,))
        assert c.execute("SELECT enqueue_daily_job_fetches()").fetchone()[0] == 2
        assert c.execute("SELECT enqueue_daily_job_fetches()").fetchone()[0] == 0  # already queued
        payloads = [r[0] for r in c.execute(
            "SELECT payload FROM tasks WHERE type='fetch_jobs' ORDER BY payload->>'watchlist' NULLS FIRST")]
        assert payloads[0]["search_id"] == sid and payloads[1]["watchlist"] is True
        assert c.execute("SELECT schedule FROM cron.job WHERE jobname='orbithire-daily-job-fetch'"
                         ).fetchone()[0] == "30 1 * * *"

        def as_user(sql: str):
            with c.transaction():
                c.execute("SET LOCAL ROLE authenticated")
                for key in ("request.jwt.claim.sub",):
                    c.execute("SELECT set_config(%s, %s, true)", (key, user_id))
                c.execute("SELECT set_config('request.jwt.claims', %s, true)",
                          ('{"sub":"%s","role":"authenticated"}' % user_id,))
                return c.execute(sql).fetchone()[0]

        assert as_user("SELECT request_job_fetch()")["reason"] == "in_progress"
        c.execute("UPDATE tasks SET status='done'")
        assert as_user("SELECT request_job_fetch()")["reason"] == "too_soon"
        c.execute("UPDATE tasks SET created_at = now() - interval '11 minutes'")
        res = as_user("SELECT request_job_fetch()")
        assert res["queued"] is True and len(res["task_ids"]) == 2 and res["watchlist"] is True
        # inbox view visible to the owner only
        assert as_user("SELECT count(*) FROM job_inbox") == 0


async def test_company_status_applied_syncs_match(ctx, user_id, supa_url, monkeypatch):
    async def fake(spec, **_kw):
        return FetchResult(postings=[posting(1)], counts={"linkedin": 1})

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    sid = await make_search(ctx, user_id)
    await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    with psycopg.connect(supa_url, autocommit=True) as c:
        cid = c.execute("INSERT INTO companies (user_id, name, status) VALUES (%s,'Acme 1','saved') RETURNING id",
                        (user_id,)).fetchone()[0]
        c.execute("UPDATE job_matches SET company_id=%s, status='shortlisted'", (cid,))
        c.execute("UPDATE companies SET notes='x' WHERE id=%s", (cid,))
        assert c.execute("SELECT status FROM job_matches").fetchone()[0] == "shortlisted"
        c.execute("UPDATE companies SET status='applied' WHERE id=%s", (cid,))
        assert c.execute("SELECT status FROM job_matches").fetchone()[0] == "applied"


async def test_import_portals_config(ctx, user_id):
    cfg = parse_portals({
        "title_filter": {"positive": ["Frontend", "React", "TypeScript", "UI Engineer"], "negative": ["Junior"]},
        "tracked_companies": [
            {"name": "Vercel", "careers_url": "https://job-boards.greenhouse.io/vercel",
             "api": "https://boards-api.greenhouse.io/v1/boards/vercel/jobs"},
            {"name": "Loom", "careers_url": "https://jobs.lever.co/loom", "enabled": False},
            {"name": "Linear", "careers_url": "https://linear.app/careers"},
        ],
    })
    async with ctx.pool.connection() as c:
        r = await jobs_db.import_portals_config(c, user_id, cfg)
        r2 = await jobs_db.import_portals_config(c, user_id, cfg)
    assert r["companies_added"] == 2 and r["companies_skipped"] == ["Linear"]
    assert r2["companies_added"] == 0 and r2["companies_updated"] == 2 and r2["search_created"] is False
    assert await scalar(ctx, "SELECT count(*) FROM job_searches WHERE user_id=%s", user_id) == 1
    kw, inc, exc = None, None, None
    async with ctx.pool.connection() as c:
        cur = await c.execute("SELECT keywords, include_keywords, exclude_keywords FROM job_searches")
        kw, inc, exc = await cur.fetchone()
    assert kw == ["Frontend", "React", "TypeScript"] and len(inc) == 4 and exc == ["Junior"]
    assert await scalar(ctx, "SELECT enabled FROM watched_companies WHERE board_token='loom'") is False


# --------------------------------------------------------------------------- migration 025


def test_job_search_limit_trigger(supa_url, user_id):
    """Max 3 job_searches per user, enforced by a BEFORE INSERT trigger."""
    other = str(uuid.uuid4())
    with psycopg.connect(supa_url, autocommit=True) as c:
        c.execute("INSERT INTO auth.users (id, email) VALUES (%s, %s)", (other, f"{other}@test.local"))
        c.execute("INSERT INTO profiles (id, email) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                  (other, f"{other}@test.local"))
        for i in range(3):
            c.execute("INSERT INTO job_searches (user_id, name, keywords) VALUES (%s, %s, '{x}')",
                      (user_id, f"s{i}"))
        with pytest.raises(psycopg.errors.CheckViolation, match="at most 3 job searches") as ei:
            c.execute("INSERT INTO job_searches (user_id, name, keywords) VALUES (%s, 's3', '{x}')",
                      (user_id,))
        assert ei.value.diag.message_primary.startswith("job_search_limit:")
        assert "Delete or edit" in (ei.value.diag.message_hint or "")
        # other users are unaffected; updates of existing searches still work
        c.execute("INSERT INTO job_searches (user_id, keywords) VALUES (%s, '{x}')", (other,))
        c.execute("UPDATE job_searches SET name = 'renamed' WHERE user_id = %s AND name = 's0'", (user_id,))
        # after a delete there is room again
        c.execute("DELETE FROM job_searches WHERE user_id = %s AND name = 'renamed'", (user_id,))
        c.execute("INSERT INTO job_searches (user_id, keywords) VALUES (%s, '{x}')", (user_id,))
        assert c.execute("SELECT count(*) FROM job_searches WHERE user_id=%s", (user_id,)).fetchone()[0] == 3
        # same limit when inserting as the user through RLS (the app's path)
        with pytest.raises(psycopg.errors.CheckViolation):
            with c.transaction():
                c.execute("SET LOCAL ROLE authenticated")
                c.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (user_id,))
                c.execute("SELECT set_config('request.jwt.claims', %s, true)",
                          ('{"sub":"%s","role":"authenticated"}' % user_id,))
                c.execute("INSERT INTO job_searches (user_id, keywords) VALUES (%s, '{x}')", (user_id,))
        c.execute("DELETE FROM job_searches WHERE user_id IN (%s, %s)", (user_id, other))


def test_job_search_country_sources_and_ats_constraints(supa_url, user_id):
    with psycopg.connect(supa_url, autocommit=True) as c:
        row = c.execute(
            "INSERT INTO job_searches (user_id, keywords) VALUES (%s, '{x}') RETURNING country, sources",
            (user_id,),
        ).fetchone()
        assert row == ("IN", [])  # existing rows / defaults stay valid
        c.execute(
            "UPDATE job_searches SET country='GB', sources='{adzuna,reed,remotive}', sites='{linkedin}' "
            "WHERE user_id=%s", (user_id,))
        with pytest.raises(psycopg.errors.CheckViolation):
            c.execute("UPDATE job_searches SET sources='{monster}' WHERE user_id=%s", (user_id,))
        with pytest.raises(psycopg.errors.CheckViolation):
            c.execute("UPDATE job_searches SET country='gbr' WHERE user_id=%s", (user_id,))
        for ats in ("workable", "smartrecruiters", "recruitee", "personio", "teamtailor"):
            c.execute("INSERT INTO watched_companies (user_id, company, ats, board_token) VALUES (%s,%s,%s,%s)",
                      (user_id, ats, ats, f"tok-{ats}"))
        with pytest.raises(psycopg.errors.CheckViolation):
            c.execute("INSERT INTO watched_companies (user_id, company, ats, board_token) "
                      "VALUES (%s,'x','workday','x')", (user_id,))
        c.execute("DELETE FROM watched_companies WHERE user_id=%s", (user_id,))
        c.execute("DELETE FROM job_searches WHERE user_id=%s", (user_id,))


async def test_search_country_and_sources_reach_fetchers(ctx, user_id, monkeypatch):
    seen = {}

    async def fake(spec, **kw):
        seen["spec"], seen["env"] = spec, kw.get("env")
        return FetchResult(
            postings=[posting(1, source="reed", location="London")],
            counts={"reed": 1, "adzuna": 0},
            errors={"adzuna": "missing API key (ADZUNA_APP_ID, ADZUNA_APP_KEY)"},
            skipped={"naukri": "not available for United Kingdom"},
        )

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    monkeypatch.setenv("REED_API_KEY", "k-reed")
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.chdir(Path(__file__).parent)  # no worker/.env leaking into the test
    async with ctx.pool.connection() as c:
        cur = await c.execute(
            """INSERT INTO job_searches (user_id, keywords, sites, sources, country)
               VALUES (%s, '{python}', '{}', '{reed,adzuna}', 'GB') RETURNING id""", (user_id,))
        sid = str((await cur.fetchone())[0])
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    spec = seen["spec"]
    assert spec.country == "GB" and spec.sources == ["reed", "adzuna"] and spec.sites == []
    assert seen["env"].get("REED_API_KEY") == "k-reed" and "ADZUNA_APP_ID" not in seen["env"]
    assert r["country"] == "GB" and r["postings_inserted"] == 1
    assert r["sources"]["naukri"] == {"fetched": 0, "skipped": "not available for United Kingdom"}
    assert r["sources"]["adzuna"]["error"].startswith("missing API key")


async def test_only_missing_keys_does_not_raise(ctx, user_id, monkeypatch):
    async def fake(spec, **_kw):
        return FetchResult(counts={"reed": 0}, errors={"reed": "missing API key (REED_API_KEY)"})

    monkeypatch.setattr(fetchers, "fetch_search", fake)
    async with ctx.pool.connection() as c:
        cur = await c.execute(
            "INSERT INTO job_searches (user_id, keywords, sites, sources, country) "
            "VALUES (%s, '{python}', '{}', '{reed}', 'GB') RETURNING id", (user_id,))
        sid = str((await cur.fetchone())[0])
    r = await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)
    assert r["postings_kept"] == 0 and "missing API key" in r["errors"]["reed"]

    async def failing(spec, **_kw):
        return FetchResult(counts={"reed": 0}, errors={"reed": "HTTP 500"})

    monkeypatch.setattr(fetchers, "fetch_search", failing)
    with pytest.raises(fj.FetchJobsError):
        await fj.fetch_jobs(make_task({"user_id": user_id, "search_id": sid}), ctx)


async def test_import_portals_respects_search_limit(ctx, user_id):
    async with ctx.pool.connection() as c:
        for i in range(3):
            await c.execute("INSERT INTO job_searches (user_id, name, keywords) VALUES (%s, %s, '{x}')",
                            (user_id, f"s{i}"))
        cfg = parse_portals({
            "title_filter": {"positive": ["Frontend"]},
            "tracked_companies": [{"name": "Skroutz", "careers_url": "https://apply.workable.com/skroutz/"}],
        })
        r = await jobs_db.import_portals_config(c, user_id, cfg)
    assert r["companies_added"] == 1 and r["search_created"] is False and r["search_id"] is None
    assert "limit" in r["search_skipped"]
    assert await scalar(ctx, "SELECT ats FROM watched_companies WHERE user_id=%s", user_id) == "workable"
