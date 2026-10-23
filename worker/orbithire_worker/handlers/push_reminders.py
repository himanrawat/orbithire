"""push_reminders: follow-up and interview web push (PRD area 8).

pg_cron runs ``enqueue_push_reminders()`` every 15 minutes (migration 20261024001200),
which queues one global task. A no-op while the VAPID keys are missing. Tests inject a
sender via ``ctx.extra["push_sender"]``.
"""

from __future__ import annotations

from typing import Any

from ..push.config import get_push_config
from ..push.deliver import pywebpush_sender
from ..push.reminders import run_reminders
from ..registry import Task, TaskContext, handler


@handler("push_reminders")
async def push_reminders(task: Task, ctx: TaskContext) -> dict[str, Any]:
    cfg = ctx.extra.get("push_config") or get_push_config()
    if not cfg.enabled:
        return {"skipped": "VAPID keys not configured"}
    sender = ctx.extra.get("push_sender") or pywebpush_sender(cfg)
    async with ctx.pool.connection() as conn:
        return await run_reminders(conn, push_cfg=cfg, sender=sender)
