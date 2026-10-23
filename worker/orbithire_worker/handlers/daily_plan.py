"""generate_daily_plan: build today's 3-5 item plan for one user.

Payload ``{"user_id": ..., "date": "YYYY-MM-DD", "trigger": "cron"}``. pg_cron runs
``enqueue_due_daily_plans()`` every 15 minutes (migration 20261024000500), which enqueues
one task per user whose local time just passed 6:30 AM. A task without ``user_id`` just
runs that function (handy for a manual trigger). A newly created plan triggers the morning
plan push, or the email fallback (push/morning.py).
"""

from __future__ import annotations

import logging
from typing import Any

from ..push.config import get_push_config
from ..push.deliver import pywebpush_sender
from ..push.morning import notify_morning_plan
from ..ranking.config import get_ranking_config
from ..registry import Task, TaskContext, handler
from ..today.store import generate_plan

log = logging.getLogger(__name__)


async def _notify(conn: Any, ctx: TaskContext, user_id: str, plan_date: str) -> dict[str, Any]:
    """Morning plan push (or email fallback). Never fails the plan task."""
    push_cfg = ctx.extra.get("push_config") or get_push_config()
    sender = ctx.extra.get("push_sender") or (pywebpush_sender(push_cfg) if push_cfg.enabled else None)
    try:
        return await notify_morning_plan(
            conn, user_id, plan_date, push_cfg=push_cfg,
            email_cfg=ctx.extra.get("ranking_config") or get_ranking_config(),
            sender=sender, http=ctx.extra.get("http"))
    except Exception:  # noqa: BLE001
        log.exception("morning plan notification failed")
        return {"notified": "error"}


@handler("generate_daily_plan")
async def generate_daily_plan(task: Task, ctx: TaskContext) -> dict[str, Any]:
    payload = task.payload or {}
    user_id = payload.get("user_id") or task.user_id
    async with ctx.pool.connection() as conn:
        if not user_id:
            cur = await conn.execute("SELECT enqueue_due_daily_plans()")
            row = await cur.fetchone()
            return {"enqueued": row[0] if row else 0}
        result = await generate_plan(conn, str(user_id), requested_date=payload.get("date"))
        if result.get("created"):
            result["notification"] = await _notify(conn, ctx, str(user_id), result["date"])
        return result
