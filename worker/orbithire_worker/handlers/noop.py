"""`noop` task: used for the Phase 0 acceptance check and smoke tests.

payload:
  fail:  bool   – raise an error (to exercise retries / max_attempts)
  sleep: float  – seconds to sleep before finishing (to exercise timeouts / slots)
  message: str  – error message when fail=true
"""

from __future__ import annotations

import asyncio

from ..registry import Task, TaskContext, handler


@handler("noop")
async def noop(task: Task, ctx: TaskContext) -> dict:
    payload = task.payload or {}
    sleep = float(payload.get("sleep") or 0)
    if sleep > 0:
        await asyncio.sleep(sleep)
    if payload.get("fail"):
        raise RuntimeError(payload.get("message") or "noop asked to fail")
    return {"ok": True, "worker": ctx.worker_id, "attempt": task.attempts}
