"""The claim/run loop.

* ``LISTEN tasks_new`` wakes the loop immediately when a task is inserted; a
  poll every ``worker_poll_interval`` seconds catches delayed retries
  (``run_after`` in the future) and missed notifications.
* Each task type has its own number of concurrency slots. A task is only
  claimed when a slot for its type is free, so a burst of renders never
  starves a fetch and vice versa.
* Claiming uses ``FOR UPDATE SKIP LOCKED`` so any number of workers can share
  the queue without double-processing.
* Each run has a hard timeout; failures are retried with exponential backoff
  until ``max_attempts``, then the task is left ``failed`` with ``last_error``.
"""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from typing import Any

import psycopg
from psycopg_pool import AsyncConnectionPool

from . import queue
from .registry import Registry, Task, TaskContext
from .registry import registry as default_registry
from .settings import Settings

log = logging.getLogger("orbithire_worker")

NOTIFY_CHANNEL = "tasks_new"


class TaskTimeout(Exception):
    pass


class Worker:
    def __init__(
        self,
        settings: Settings,
        registry: Registry | None = None,
        worker_id: str | None = None,
    ) -> None:
        self.settings = settings
        self.registry = registry or default_registry
        self.worker_id = worker_id or settings.worker_id
        self.pool: AsyncConnectionPool | None = None

        self._wake = asyncio.Event()
        self._stopping = asyncio.Event()
        self._in_flight: dict[str, set[asyncio.Task[None]]] = {t: set() for t in self.registry.types}
        self._running_ids: dict[asyncio.Task[None], Task] = {}
        self._bg: list[asyncio.Task[Any]] = []
        self.started_at = time.time()
        self.processed = 0
        self.failed = 0
        self.last_db_ok: bool | None = None

    # ------------------------------------------------------------------ slots
    def slots(self) -> dict[str, dict[str, int]]:
        return {
            t: {"in_use": len(self._in_flight.get(t, ())), "max": self.settings.concurrency_for(t)}
            for t in self.registry.types
        }

    def _free_types(self) -> list[str]:
        return [
            t
            for t in self.registry.types
            if len(self._in_flight.setdefault(t, set())) < self.settings.concurrency_for(t)
        ]

    # -------------------------------------------------------------- lifecycle
    async def start(self) -> None:
        if not self.registry.types:
            raise RuntimeError("no task handlers registered")
        self.pool = AsyncConnectionPool(
            self.settings.database_url,
            min_size=1,
            max_size=self.settings.worker_db_pool_size,
            kwargs={"autocommit": True},
            open=False,
            name=f"worker-{self.worker_id}",
        )
        await self.pool.open(wait=True, timeout=30)
        self._bg = [
            asyncio.create_task(self._listen_loop(), name="listen"),
            asyncio.create_task(self._reclaim_loop(), name="reclaim"),
        ]
        log.info(
            "worker %s started; types=%s slots=%s",
            self.worker_id,
            self.registry.types,
            {t: s["max"] for t, s in self.slots().items()},
        )

    def request_stop(self) -> None:
        if not self._stopping.is_set():
            log.info("worker %s: stop requested", self.worker_id)
        self._stopping.set()
        self._wake.set()

    @property
    def stopping(self) -> bool:
        return self._stopping.is_set()

    async def run(self) -> None:
        """Run until ``request_stop()``; then drain gracefully."""
        if self.pool is None:
            await self.start()
        try:
            await self._claim_loop()
        finally:
            await self._shutdown()

    async def _shutdown(self) -> None:
        running = list(self._running_ids)
        if running:
            log.info("waiting up to %.0fs for %d running task(s)", self.settings.worker_shutdown_grace, len(running))
            _, pending = await asyncio.wait(running, timeout=self.settings.worker_shutdown_grace)
            for t in pending:
                t.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
        for t in self._bg:
            t.cancel()
        await asyncio.gather(*self._bg, return_exceptions=True)
        if self.pool is not None:
            await self.pool.close()
            self.pool = None
        log.info("worker %s stopped (processed=%d failed=%d)", self.worker_id, self.processed, self.failed)

    # ------------------------------------------------------------------ loops
    async def _claim_loop(self) -> None:
        assert self.pool is not None
        while not self.stopping:
            self._wake.clear()
            try:
                await self._fill_slots()
                self.last_db_ok = True
            except (psycopg.Error, OSError) as exc:
                self.last_db_ok = False
                log.warning("claim failed: %s", exc)
            if self.stopping:
                break
            try:
                await asyncio.wait_for(self._wake.wait(), timeout=self.settings.worker_poll_interval)
            except asyncio.TimeoutError:
                pass

    async def _fill_slots(self) -> None:
        assert self.pool is not None
        while not self.stopping:
            free = self._free_types()
            if not free:
                return
            async with self.pool.connection() as conn:
                task = await queue.claim(conn, self.worker_id, free)
            if task is None:
                return
            self._spawn(task)

    def _spawn(self, task: Task) -> None:
        at = asyncio.create_task(self._run_task(task), name=f"task-{task.type}-{task.id}")
        self._in_flight.setdefault(task.type, set()).add(at)
        self._running_ids[at] = task

        def _done(fut: asyncio.Task[None]) -> None:
            self._in_flight.get(task.type, set()).discard(fut)
            self._running_ids.pop(fut, None)
            self._wake.set()  # a slot freed up: try to claim more

        at.add_done_callback(_done)

    async def _listen_loop(self) -> None:
        """Hold a dedicated connection with LISTEN; reconnect on failure."""
        while not self.stopping:
            try:
                async with await psycopg.AsyncConnection.connect(
                    self.settings.database_url, autocommit=True
                ) as conn:
                    await conn.execute(f"LISTEN {NOTIFY_CHANNEL}")
                    log.debug("listening on %s", NOTIFY_CHANNEL)
                    self._wake.set()  # catch anything inserted while we were down
                    async for note in conn.notifies():
                        if note.payload in self.registry or not note.payload:
                            self._wake.set()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("LISTEN connection lost (%s); retrying in 2s", exc)
                await asyncio.sleep(2)

    async def _reclaim_loop(self) -> None:
        while not self.stopping:
            try:
                await self.reclaim_stale()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.warning("reclaim failed: %s", exc)
            await asyncio.sleep(self.settings.worker_reclaim_interval)

    async def reclaim_stale(self) -> list[dict[str, Any]]:
        assert self.pool is not None
        timeouts = {t: self.settings.timeout_for(t) for t in set(self.settings.worker_timeouts) | set(self.registry.types)}
        async with self.pool.connection() as conn:
            rows = await queue.reclaim_stale(conn, timeouts, self.settings.worker_default_timeout)
        for r in rows:
            log.warning("reclaimed stale task %s (%s) -> %s", r["id"], r["type"], r["status"])
        if rows:
            self._wake.set()
        return rows

    # ---------------------------------------------------------------- running
    async def _run_task(self, task: Task) -> None:
        assert self.pool is not None
        timeout = self.settings.timeout_for(task.type)
        ctx = TaskContext(worker_id=self.worker_id, settings=self.settings, pool=self.pool)
        started = time.monotonic()
        log.info("task %s %s attempt %d/%d", task.id, task.type, task.attempts, task.max_attempts)
        try:
            try:
                result = await asyncio.wait_for(self.registry.invoke(task, ctx), timeout=timeout)
            except asyncio.TimeoutError as exc:
                raise TaskTimeout(f"timed out after {timeout:g}s") from exc
        except asyncio.CancelledError:
            # Shutdown: hand the task back without burning an attempt.
            await asyncio.shield(self._release(task, "released on worker shutdown"))
            raise
        except Exception as exc:  # noqa: BLE001
            self.failed += 1
            err = _format_error(exc)
            backoff = self.settings.backoff_for(task.attempts)
            try:
                async with self.pool.connection() as conn:
                    row = await queue.fail(conn, task.id, self.worker_id, err, backoff)
            except Exception:  # noqa: BLE001
                log.exception("could not record failure of task %s", task.id)
                return
            if row and row["status"] == "failed":
                log.error("task %s %s failed permanently after %d attempts: %s", task.id, task.type, row["attempts"], err.splitlines()[0])
            elif row:
                log.warning("task %s %s failed (attempt %d), retry in %.1fs: %s", task.id, task.type, row["attempts"], backoff, err.splitlines()[0])
            return

        try:
            async with self.pool.connection() as conn:
                ok = await queue.complete(conn, task.id, self.worker_id, _jsonable(result))
        except Exception:  # noqa: BLE001
            log.exception("could not record completion of task %s", task.id)
            return
        self.processed += 1
        if ok:
            log.info("task %s %s done in %.2fs", task.id, task.type, time.monotonic() - started)
        else:
            log.warning("task %s finished but lock was lost (reclaimed?)", task.id)

    async def _release(self, task: Task, reason: str) -> None:
        if self.pool is None:
            return
        try:
            async with self.pool.connection() as conn:
                await queue.release(conn, task.id, self.worker_id, reason)
        except Exception:  # noqa: BLE001
            log.exception("could not release task %s", task.id)

    # ----------------------------------------------------------------- health
    async def health(self) -> dict[str, Any]:
        db_ok = False
        if self.pool is not None:
            try:
                async with self.pool.connection(timeout=3) as conn:
                    await conn.execute("SELECT 1")
                db_ok = True
            except Exception:  # noqa: BLE001
                db_ok = False
        self.last_db_ok = db_ok
        return {
            "ok": db_ok and not self.stopping,
            "db": db_ok,
            "worker_id": self.worker_id,
            "stopping": self.stopping,
            "uptime_s": round(time.time() - self.started_at, 1),
            "processed": self.processed,
            "failed": self.failed,
            "slots": self.slots(),
        }


def _format_error(exc: BaseException) -> str:
    if isinstance(exc, TaskTimeout):
        return f"TaskTimeout: {exc}"
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__, limit=8))
    return f"{type(exc).__name__}: {exc}\n\n{tb}"


def _jsonable(result: Any) -> Any:
    if result is None or isinstance(result, (dict, list, str, int, float, bool)):
        return result
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    return {"value": str(result)}
