"""Load Today signals for one user and store the generated daily plan."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .plan import (
    DEFAULT_TIME_ZONE,
    INTERVIEW_WINDOW,
    STRONG_MATCH_SCORE,
    FollowUp,
    Interview,
    Lesson,
    Signals,
    build_daily_plan,
    local_date,
    safe_zone,
)

log = logging.getLogger(__name__)

FOLLOW_UP_LOOKAHEAD = timedelta(hours=48)


async def _all(conn: AsyncConnection, sql: str, params: Any = None) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchall()


async def load_time_zone(conn: AsyncConnection, user_id: UUID | str) -> str:
    rows = await _all(conn, "SELECT timezone FROM profiles WHERE id = %s", (user_id,))
    tz = rows[0]["timezone"] if rows else None
    return safe_zone(tz).key if tz else DEFAULT_TIME_ZONE


async def _interviews(conn: AsyncConnection, user_id: UUID | str, now: datetime) -> tuple[Interview, ...]:
    rows = await _all(conn, """
        SELECT id, name, interview_at FROM companies
         WHERE user_id = %s AND interview_at BETWEEN %s AND %s
         ORDER BY interview_at LIMIT 5
    """, (user_id, now, now + INTERVIEW_WINDOW))
    return tuple(Interview(str(r["id"]), r["name"] or "a company", r["interview_at"]) for r in rows)


async def _follow_ups(conn: AsyncConnection, user_id: UUID | str, now: datetime) -> tuple[FollowUp, ...]:
    rows = await _all(conn, """
        SELECT f.id, f.company_id, f.next_reminder_at, c.name
          FROM follow_ups f JOIN companies c ON c.id = f.company_id
         WHERE f.user_id = %s AND f.status = 'active'
           AND f.next_reminder_at IS NOT NULL AND f.next_reminder_at <= %s
         ORDER BY f.next_reminder_at LIMIT 5
    """, (user_id, now + FOLLOW_UP_LOOKAHEAD))
    return tuple(FollowUp(str(r["id"]), str(r["company_id"]), r["name"] or "a company", r["next_reminder_at"])
                 for r in rows)


def _lesson_from_row(row: dict[str, Any] | None) -> Lesson | None:
    if not row:
        return None
    lesson_id = row.get("lesson_id") or row.get("id")
    if not lesson_id:
        return None
    title = row.get("lesson_title") or row.get("title") or "your lesson"
    return Lesson(str(lesson_id), str(title), f"/learn/lessons/{lesson_id}")


async def _lesson(conn: AsyncConnection, user_id: UUID | str) -> Lesson | None:
    """Learn (area 3) may not exist yet: missing table or columns mean no lesson."""
    rows = await _all(conn, "SELECT to_regclass('public.lesson_progress') IS NOT NULL AS present")
    if not rows or not rows[0]["present"]:
        return None
    try:
        async with conn.transaction():
            found = await _all(conn, """
                SELECT to_jsonb(lp) AS row FROM lesson_progress lp
                 WHERE lp.user_id = %s AND lp.status = 'in_progress'
                 ORDER BY lp.updated_at DESC LIMIT 1
            """, (user_id,))
    except Exception:  # noqa: BLE001
        log.info("lesson_progress not readable yet; skipping lesson rule")
        return None
    return _lesson_from_row(found[0]["row"] if found else None)


async def _strong_matches(conn: AsyncConnection, user_id: UUID | str) -> int:
    rows = await _all(conn, """
        SELECT count(*) AS n FROM job_matches
         WHERE user_id = %s AND status = 'new' AND llm_score >= %s
           AND prefilter_pass IS DISTINCT FROM FALSE
    """, (user_id, STRONG_MATCH_SCORE))
    return int(rows[0]["n"]) if rows else 0


async def load_signals(conn: AsyncConnection, user_id: UUID | str, now: datetime, time_zone: str) -> Signals:
    # One connection: queries run one after another (not in a loop over rows).
    interviews = await _interviews(conn, user_id, now)
    follow_ups = await _follow_ups(conn, user_id, now)
    lesson = await _lesson(conn, user_id)
    strong = await _strong_matches(conn, user_id)
    return Signals(now=now, time_zone=time_zone, interviews=interviews, follow_ups=follow_ups,
                   lesson=lesson, strong_match_count=strong)


def _plan_date(requested: Any, now: datetime, time_zone: str) -> date:
    if isinstance(requested, str):
        try:
            return date.fromisoformat(requested)
        except ValueError:
            pass
    return date.fromisoformat(local_date(now, time_zone))


async def generate_plan(conn: AsyncConnection, user_id: UUID | str, *, requested_date: Any = None,
                        now: datetime | None = None) -> dict[str, Any]:
    """Build and insert the plan. An existing plan for that date (on-demand) is kept."""
    now = now or datetime.now(timezone.utc)
    tz = await load_time_zone(conn, user_id)
    signals = await load_signals(conn, user_id, now, tz)
    items = build_daily_plan(signals)
    plan_date = _plan_date(requested_date, now, tz)
    cur = await conn.execute("""
        INSERT INTO daily_plans (user_id, date, items, generated_at, source)
        VALUES (%s, %s, %s, %s, 'worker')
        ON CONFLICT (user_id, date) DO NOTHING
    """, (user_id, plan_date, Jsonb(items), now))
    return {"date": plan_date.isoformat(), "items": len(items), "created": cur.rowcount == 1,
            "next_step": items[0]["kind"]}
