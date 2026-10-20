"""digest: morning email with the top 5 new matches (payload {"user_id": ..., "day": ...}).

pg_cron runs ``enqueue_due_digests()`` hourly (migration 021), which enqueues one task per
user whose local digest hour has arrived. A task without ``user_id`` just runs that
function (handy for a manual trigger). Tests pass an httpx client via ``ctx.extra["http"]``.
"""

from __future__ import annotations

from typing import Any

from ..ranking.config import get_ranking_config
from ..ranking.digest import run_digest
from ..registry import Task, TaskContext, handler


@handler("digest")
async def digest(task: Task, ctx: TaskContext) -> dict[str, Any]:
    cfg = ctx.extra.get("ranking_config") or get_ranking_config()
    user_id = (task.payload or {}).get("user_id") or task.user_id
    async with ctx.pool.connection() as conn:
        if not user_id:
            cur = await conn.execute("SELECT enqueue_due_digests()")
            row = await cur.fetchone()
            return {"enqueued": row[0] if row else 0}
        return await run_digest(conn, str(user_id), cfg, http=ctx.extra.get("http"))
