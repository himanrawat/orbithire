"""Today daily plan against the real migrations (daily_plans, cron enqueue, worker store).

Lives under tests/ranking to reuse its Supabase Postgres fixtures (supa_url, conn, user_id).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import psycopg

from orbithire_worker.today.store import generate_plan

from .helpers import add_posting, cleanup_postings


def _zone_in_window(now: datetime) -> str:
    """An Etc/GMT zone whose local time is within [06:30, 07:30), inside the cron window."""
    for offset in range(-12, 15):
        local = now + timedelta(hours=offset)
        minutes = local.hour * 60 + local.minute
        if 6 * 60 + 30 <= minutes < 7 * 60 + 30:
            # Etc/GMT signs are inverted: Etc/GMT-5 is UTC+5.
            return "UTC" if offset == 0 else f"Etc/GMT{'-' if offset > 0 else '+'}{abs(offset)}"
    raise AssertionError("no zone found")


def _zone_outside_window(now: datetime) -> str:
    for offset in range(-12, 15):
        local = now + timedelta(hours=offset)
        if 12 <= local.hour < 20:
            return "UTC" if offset == 0 else f"Etc/GMT{'-' if offset > 0 else '+'}{abs(offset)}"
    raise AssertionError("no zone found")


async def _pending(conn: psycopg.AsyncConnection, uid: str) -> int:
    cur = await conn.execute(
        "SELECT count(*) FROM tasks WHERE type = 'generate_daily_plan' AND user_id = %s", (uid,))
    return (await cur.fetchone())[0]


async def test_profile_timezone_defaults_to_new_york(conn: psycopg.AsyncConnection, user_id: str) -> None:
    cur = await conn.execute("SELECT timezone FROM profiles WHERE id = %s", (user_id,))
    assert (await cur.fetchone())[0] == "America/New_York"


async def test_generate_plan_writes_once(conn: psycopg.AsyncConnection, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    cur = await conn.execute(
        "INSERT INTO companies (user_id, name, status, interview_at) VALUES (%s, 'Initech', 'interviewing', %s) "
        "RETURNING id", (user_id, now + timedelta(hours=20)))
    company_id = str((await cur.fetchone())[0])
    _, match_id = await add_posting(conn, user_id)
    await conn.execute("UPDATE job_matches SET llm_score = 91 WHERE id = %s", (match_id,))
    try:
        first = await generate_plan(conn, user_id, requested_date="2026-10-23", now=now)
        assert first == {"date": "2026-10-23", "items": 3, "created": True, "next_step": "interview_prep"}
        cur = await conn.execute(
            "SELECT items, source FROM daily_plans WHERE user_id = %s AND date = '2026-10-23'", (user_id,))
        items, source = await cur.fetchone()
        assert source == "worker"
        assert [i["kind"] for i in items] == ["interview_prep", "review_matches", "focus_block"]
        assert items[0]["href"] == f"/companies/{company_id}"

        again = await generate_plan(conn, user_id, requested_date="2026-10-23", now=now)
        assert again["created"] is False
    finally:
        await cleanup_postings(conn, user_id)
        await conn.execute("DELETE FROM daily_plans WHERE user_id = %s", (user_id,))
        await conn.execute("DELETE FROM companies WHERE id = %s", (company_id,))


async def test_cron_enqueues_users_past_six_thirty(conn: psycopg.AsyncConnection, user_id: str) -> None:
    cur = await conn.execute("SELECT now()")
    now = (await cur.fetchone())[0]
    await conn.execute("UPDATE profiles SET timezone = %s WHERE id = %s", (_zone_in_window(now), user_id))
    try:
        await conn.execute("SELECT enqueue_due_daily_plans()")
        assert await _pending(conn, user_id) == 1
        await conn.execute("SELECT enqueue_due_daily_plans()")
        assert await _pending(conn, user_id) == 1  # already queued

        # Once today's plan exists, nothing more is enqueued.
        await conn.execute("DELETE FROM tasks WHERE type = 'generate_daily_plan' AND user_id = %s", (user_id,))
        await conn.execute(
            "INSERT INTO daily_plans (user_id, date) "
            "SELECT id, (now() AT TIME ZONE timezone)::date FROM profiles WHERE id = %s", (user_id,))
        await conn.execute("SELECT enqueue_due_daily_plans()")
        assert await _pending(conn, user_id) == 0

        await conn.execute("DELETE FROM daily_plans WHERE user_id = %s", (user_id,))
        await conn.execute("UPDATE profiles SET timezone = %s WHERE id = %s", (_zone_outside_window(now), user_id))
        await conn.execute("SELECT enqueue_due_daily_plans()")
        assert await _pending(conn, user_id) == 0
    finally:
        await conn.execute("DELETE FROM tasks WHERE type = 'generate_daily_plan' AND user_id = %s", (user_id,))
        await conn.execute("DELETE FROM daily_plans WHERE user_id = %s", (user_id,))


async def test_invalid_timezone_rejected(conn: psycopg.AsyncConnection, user_id: str) -> None:
    try:
        await conn.execute("UPDATE profiles SET timezone = 'Mars/Olympus' WHERE id = %s", (user_id,))
    except psycopg.errors.CheckViolation:
        return
    raise AssertionError("invalid time zone was accepted")
