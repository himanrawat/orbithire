"""SQL for the `tasks` queue. Every function is a single statement, so it is
atomic on an autocommit connection."""

from __future__ import annotations

from typing import Any, Iterable, Mapping
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .registry import Task

CLAIM_SQL = """
UPDATE tasks AS t
   SET status     = 'running',
       attempts   = t.attempts + 1,
       locked_at  = now(),
       locked_by  = %(worker_id)s,
       updated_at = now()
 WHERE t.id = (
         SELECT id
           FROM tasks
          WHERE status = 'queued'
            AND run_after <= now()
            AND type = ANY(%(types)s)
          ORDER BY priority DESC, run_after
          LIMIT 1
          FOR UPDATE SKIP LOCKED
       )
   AND t.status = 'queued'
RETURNING t.*
"""

COMPLETE_SQL = """
UPDATE tasks
   SET status     = 'done',
       result     = %(result)s,
       locked_at  = NULL,
       locked_by  = NULL,
       updated_at = now()
 WHERE id = %(id)s
   AND status = 'running'
   AND locked_by = %(worker_id)s
RETURNING id
"""

FAIL_SQL = """
UPDATE tasks
   SET status     = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
       run_after  = CASE WHEN attempts >= max_attempts THEN run_after
                         ELSE now() + make_interval(secs => %(backoff)s) END,
       last_error = %(error)s,
       locked_at  = NULL,
       locked_by  = NULL,
       updated_at = now()
 WHERE id = %(id)s
   AND status = 'running'
   AND locked_by = %(worker_id)s
RETURNING id, status, attempts, run_after
"""

# Used on shutdown: give the task back without burning an attempt.
RELEASE_SQL = """
UPDATE tasks
   SET status     = 'queued',
       attempts   = GREATEST(attempts - 1, 0),
       last_error = %(reason)s,
       run_after  = now(),
       locked_at  = NULL,
       locked_by  = NULL,
       updated_at = now()
 WHERE id = %(id)s
   AND status = 'running'
   AND locked_by = %(worker_id)s
RETURNING id
"""

# A task is stale when it has been `running` for more than 2x its type's
# timeout (its worker crashed or hung). Requeue it, or fail it if it has
# already used all attempts.
RECLAIM_SQL = """
WITH m AS (
    SELECT * FROM unnest(%(types)s::text[], %(timeouts)s::float8[]) AS m(type, timeout)
)
UPDATE tasks AS t
   SET status     = CASE WHEN t.attempts >= t.max_attempts THEN 'failed' ELSE 'queued' END,
       last_error = 'stale lock reclaimed (was locked by ' || coalesce(t.locked_by, '?')
                    || ' since ' || t.locked_at::text || ')',
       run_after  = now(),
       locked_at  = NULL,
       locked_by  = NULL,
       updated_at = now()
 WHERE t.status = 'running'
   AND t.locked_at < now() - make_interval(
         secs => 2 * coalesce((SELECT m.timeout FROM m WHERE m.type = t.type), %(default_timeout)s)
       )
RETURNING t.id, t.type, t.status
"""


async def claim(conn: AsyncConnection, worker_id: str, types: Iterable[str]) -> Task | None:
    types = list(types)
    if not types:
        return None
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(CLAIM_SQL, {"worker_id": worker_id, "types": types})
        row = await cur.fetchone()
    return Task.from_row(row) if row else None


async def complete(conn: AsyncConnection, task_id: UUID, worker_id: str, result: Any) -> bool:
    res = Jsonb(result) if result is not None else None
    cur = await conn.execute(COMPLETE_SQL, {"id": task_id, "worker_id": worker_id, "result": res})
    return (await cur.fetchone()) is not None


async def fail(
    conn: AsyncConnection, task_id: UUID, worker_id: str, error: str, backoff: float
) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            FAIL_SQL,
            {"id": task_id, "worker_id": worker_id, "error": error[:4000], "backoff": float(backoff)},
        )
        return await cur.fetchone()


async def release(conn: AsyncConnection, task_id: UUID, worker_id: str, reason: str) -> bool:
    cur = await conn.execute(RELEASE_SQL, {"id": task_id, "worker_id": worker_id, "reason": reason})
    return (await cur.fetchone()) is not None


async def reclaim_stale(
    conn: AsyncConnection, timeouts: Mapping[str, float], default_timeout: float
) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            RECLAIM_SQL,
            {
                "types": list(timeouts.keys()),
                "timeouts": [float(v) for v in timeouts.values()],
                "default_timeout": float(default_timeout),
            },
        )
        return await cur.fetchall()
