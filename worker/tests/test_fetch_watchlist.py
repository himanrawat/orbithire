"""fetch_watchlist (fetch once, fan out) against a throwaway Supabase Postgres with
the real migrations applied. Board fetches are mocked. Reuses the container
fixtures of test_fetch_jobs.py."""

from __future__ import annotations

import uuid

import psycopg
import pytest

from orbithire_worker import fetchers
from orbithire_worker.fetchers import FetchResult
from orbithire_worker.handlers import fetch_jobs as fj
from orbithire_worker.handlers import fetch_watchlist as fw
from orbithire_worker.registry import Task

from test_fetch_jobs import ctx, make_search, make_task, posting, scalar, supa_url, user_id  # noqa: F401

BOARDS = {
    "acme": [("Senior Frontend Engineer", "New York, NY"), ("Account Executive", "Austin, TX"),
             ("Frontend Engineer", "London, UK")],
    "globex": [("Frontend Developer", "Remote - US"), ("Data Scientist", "Seattle, WA")],
}


def watch_task() -> Task:
    return Task(id=uuid.uuid4(), type="fetch_watchlist", payload={"trigger": "test"}, status="running",
                priority=0, attempts=1, max_attempts=3)


@pytest.fixture
async def boards(ctx, monkeypatch):  # noqa: F811
    async with ctx.pool.connection() as c:
        await c.execute("TRUNCATE source_runs, job_observations")
        await c.execute("UPDATE company_watchlist SET active = FALSE")
        await c.execute("DELETE FROM company_watchlist WHERE board_token LIKE 'test-%%'")
        await c.execute(
            """INSERT INTO company_watchlist (name, ats, board_token, priority)
               VALUES ('Acme', 'greenhouse', 'test-acme', 1), ('Globex', 'ashby', 'test-globex', 2)""")
        await c.execute("UPDATE job_supply_settings SET fanout_enabled = FALSE, per_user_watchlist = TRUE")
    calls: list[str] = []

    async def fake_fetch_company(company, **_kw):
        token = company.board_token.removeprefix("test-")
        calls.append(company.board_token)
        jobs = BOARDS.get(token, [])
        out = [posting(i, source=company.ats, title=t, location=loc, company=company.company)
               for i, (t, loc) in enumerate(jobs)]
        return FetchResult(postings=out, counts={company.ats: len(out)})

    monkeypatch.setattr(fetchers, "fetch_company", fake_fetch_company)
    yield calls
    async with ctx.pool.connection() as c:
        await c.execute("DELETE FROM company_watchlist WHERE board_token LIKE 'test-%%'")
        await c.execute("UPDATE company_watchlist SET active = TRUE")
        await c.execute("UPDATE job_supply_settings SET fanout_enabled = FALSE, per_user_watchlist = TRUE")


async def us_search(ctx, user_id: str) -> str:  # noqa: F811
    sid = await make_search(ctx, user_id, keywords=["frontend"], sites=[])
    async with ctx.pool.connection() as c:
        await c.execute("UPDATE job_searches SET country = 'US', sources = '{himalayas}' WHERE id = %s", (sid,))
    return sid


def test_seed_and_schedule(supa_url):  # noqa: F811
    with psycopg.connect(supa_url, autocommit=True) as c:
        assert c.execute("SELECT count(*) FROM company_watchlist WHERE country = 'US'").fetchone()[0] >= 500
        assert c.execute("SELECT count(*) FROM job_sources WHERE tos_restricted").fetchone()[0] == 3
        c.execute("DELETE FROM tasks WHERE type = 'fetch_watchlist'")
        assert c.execute("SELECT enqueue_watchlist_fetch()").fetchone()[0] == 1
        assert c.execute("SELECT enqueue_watchlist_fetch()").fetchone()[0] == 0
        c.execute("DELETE FROM tasks WHERE type = 'fetch_watchlist'")
        jobs = c.execute("SELECT schedule FROM cron.job WHERE jobname = 'nextmilestone-watchlist-fetch'").fetchall()
        assert jobs == [("*/15 * * * *",)]


async def test_shadow_mode_stores_supply_without_matches(ctx, user_id, boards):  # noqa: F811
    await us_search(ctx, user_id)
    r = await fw.fetch_watchlist(watch_task(), ctx)
    assert sorted(boards) == ["test-acme", "test-globex"]
    assert r["boards"] == 2 and r["priority_boards"] == 1
    assert r["postings_inserted"] == 5 and r["observations"] == 5
    # frontend titles in the US or remote: NY + Remote US (London is not the search's country)
    assert r["matches_planned"] == 2 and r["fanout"] is False
    assert await scalar(ctx, "SELECT count(*) FROM job_matches") == 0
    assert await scalar(ctx, "SELECT count(*) FROM source_runs") == 2
    assert await scalar(ctx, "SELECT last_success_at IS NOT NULL FROM company_watchlist "
                             "WHERE board_token = 'test-acme'") is True
    # boards were claimed: nothing due on an immediate rerun
    again = await fw.fetch_watchlist(watch_task(), ctx)
    assert again["skipped"] == "no boards due"


async def test_fanout_creates_matches_and_ranks(ctx, user_id, boards):  # noqa: F811
    sid = await us_search(ctx, user_id)
    async with ctx.pool.connection() as c:
        await c.execute("UPDATE job_supply_settings SET fanout_enabled = TRUE")
    r1 = await fw.fetch_watchlist(watch_task(), ctx)
    assert r1["matches_created"] == 2 and r1["rank_tasks_created"] == 1
    assert await scalar(ctx, "SELECT count(*) FROM job_matches WHERE user_id = %s AND search_id = %s",
                        user_id, sid) == 2
    # next run: same postings observed again, no duplicate matches or rank tasks
    async with ctx.pool.connection() as c:
        await c.execute("UPDATE company_watchlist SET last_fetched_at = NULL WHERE board_token LIKE 'test-%%'")
    r2 = await fw.fetch_watchlist(watch_task(), ctx)
    assert r2["postings_inserted"] == 0 and r2["matches_created"] == 0 and r2["rank_tasks_created"] == 0
    assert await scalar(ctx, "SELECT max(seen_count) FROM job_observations") == 2


async def test_user_boards_fetched_once_when_per_user_path_is_off(ctx, user_id, boards):  # noqa: F811
    async with ctx.pool.connection() as c:
        await c.execute("UPDATE job_supply_settings SET fanout_enabled = TRUE, per_user_watchlist = FALSE")
        await c.execute("UPDATE company_watchlist SET active = FALSE WHERE board_token = 'test-globex'")
        await c.execute(
            "INSERT INTO watched_companies (user_id, company, ats, board_token) "
            "VALUES (%s, 'Globex', 'ashby', 'test-globex')", (user_id,))
    # the legacy per-user watchlist task now defers to fetch_watchlist
    legacy = await fj.fetch_jobs(make_task({"user_id": user_id, "watchlist": True}), ctx)
    assert legacy["skipped"] == "watchlist covered by fetch_watchlist fan-out"

    r = await fw.fetch_watchlist(watch_task(), ctx)
    assert sorted(boards) == ["test-acme", "test-globex"]
    # no searches: the watcher gets every Globex job, nothing from Acme
    assert r["matches_created"] == 2
    titles = await scalar(
        ctx, "SELECT array_agg(p.title ORDER BY p.title) FROM job_matches m "
             "JOIN job_postings p ON p.id = m.job_posting_id WHERE m.user_id = %s AND m.search_id IS NULL", user_id)
    assert titles == ["Data Scientist", "Frontend Developer"]


async def test_all_boards_failing_raises(ctx, boards, monkeypatch):  # noqa: F811
    async def broken(company, **_kw):
        return FetchResult(errors={company.ats: "HTTP 500"}, counts={company.ats: 0})

    monkeypatch.setattr(fetchers, "fetch_company", broken)
    with pytest.raises(fw.FetchWatchlistError):
        await fw.fetch_watchlist(watch_task(), ctx)
    assert await scalar(ctx, "SELECT consecutive_failures FROM company_watchlist "
                             "WHERE board_token = 'test-acme'") == 1
    assert await scalar(ctx, "SELECT count(*) FROM source_runs WHERE error = 'HTTP 500'") == 2
