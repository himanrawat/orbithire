"""generate_daily_plan: build today's 3-5 item plan for one user.

Payload ``{"user_id": ..., "date": "YYYY-MM-DD", "trigger": "cron"}``. pg_cron runs
``enqueue_due_daily_plans()`` every 15 minutes (migration 20261024000500), which enqueues
one task per user whose local time just passed 6:30 AM. A task without ``user_id`` just
runs that function (handy for a manual trigger).
"""

from __future__ import annotations

from typing import Any

from ..registry import Task, TaskContext, handler
from ..today.store import generate_plan


@handler("generate_daily_plan")
async def generate_daily_plan(task: Task, ctx: TaskContext) -> dict[str, Any]:
    payload = task.payload or {}
    user_id = payload.get("user_id") or task.user_id
    async with ctx.pool.connection() as conn:
        if not user_id:
            cur = await conn.execute("SELECT enqueue_due_daily_plans()")
            row = await cur.fetchone()
            return {"enqueued": row[0] if row else 0}
        return await generate_plan(conn, str(user_id), requested_date=payload.get("date"))
