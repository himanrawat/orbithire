"""rank_jobs: pre-filter -> similarity -> LLM top-N for one user (payload {"user_id": ...}).

See orbithire_worker/ranking/pipeline.py. Tests inject fake clients through
``ctx.extra["ranking_clients_factory"]`` and config through ``ctx.extra["ranking_config"]``.
"""

from __future__ import annotations

from typing import Any

from ..ranking.config import get_ranking_config
from ..ranking.pipeline import rank_user
from ..registry import Task, TaskContext, handler


@handler("rank_jobs")
async def rank_jobs(task: Task, ctx: TaskContext) -> dict[str, Any]:
    user_id = (task.payload or {}).get("user_id") or task.user_id
    if not user_id:
        raise ValueError("rank_jobs needs payload.user_id")
    cfg = ctx.extra.get("ranking_config") or get_ranking_config()
    kwargs: dict[str, Any] = {}
    if "ranking_clients_factory" in ctx.extra:
        kwargs["clients_factory"] = ctx.extra["ranking_clients_factory"]
    async with ctx.pool.connection() as conn:
        return await rank_user(conn, str(user_id), cfg, **kwargs)
