"""Task handler registry.

Handlers are registered by task type with the ``@handler`` decorator::

    from orbithire_worker.registry import handler

    @handler("render_pdf")
    async def render_pdf(task: Task, ctx: TaskContext) -> dict | None:
        ...

Async handlers run on the event loop. Plain (sync) functions are run in a
thread via ``asyncio.to_thread`` so blocking libraries (JobSpy, typst) are fine.
The return value (a JSON-serialisable dict or None) is stored in ``tasks.result``.
"""

from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any, Callable
from uuid import UUID

if TYPE_CHECKING:
    from psycopg_pool import AsyncConnectionPool

    from .settings import Settings


@dataclass(slots=True)
class Task:
    id: UUID
    type: str
    payload: dict[str, Any]
    status: str
    priority: int
    attempts: int
    max_attempts: int
    run_after: datetime | None = None
    locked_at: datetime | None = None
    locked_by: str | None = None
    last_error: str | None = None
    result: Any = None
    user_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @classmethod
    def from_row(cls, row: dict[str, Any]) -> "Task":
        known = {f for f in cls.__dataclass_fields__}
        data = {k: v for k, v in row.items() if k in known}
        data["payload"] = data.get("payload") or {}
        return cls(**data)


@dataclass(slots=True)
class TaskContext:
    worker_id: str
    settings: "Settings"
    pool: "AsyncConnectionPool"
    extra: dict[str, Any] = field(default_factory=dict)


HandlerFn = Callable[[Task, TaskContext], Any]


class Registry:
    def __init__(self) -> None:
        self._handlers: dict[str, HandlerFn] = {}

    def register(self, task_type: str, fn: HandlerFn) -> HandlerFn:
        if task_type in self._handlers and self._handlers[task_type] is not fn:
            raise ValueError(f"handler for task type {task_type!r} already registered")
        self._handlers[task_type] = fn
        return fn

    def handler(self, task_type: str) -> Callable[[HandlerFn], HandlerFn]:
        def deco(fn: HandlerFn) -> HandlerFn:
            return self.register(task_type, fn)

        return deco

    def get(self, task_type: str) -> HandlerFn | None:
        return self._handlers.get(task_type)

    @property
    def types(self) -> list[str]:
        return sorted(self._handlers)

    def __contains__(self, task_type: str) -> bool:
        return task_type in self._handlers

    def copy(self) -> "Registry":
        r = Registry()
        r._handlers = dict(self._handlers)
        return r

    async def invoke(self, task: Task, ctx: TaskContext) -> Any:
        fn = self._handlers[task.type]
        if inspect.iscoroutinefunction(fn):
            return await fn(task, ctx)
        result = await asyncio.to_thread(fn, task, ctx)
        if inspect.isawaitable(result):
            return await result  # type: ignore[misc]
        return result


# Global default registry used by the real worker process.
registry = Registry()


def handler(task_type: str) -> Callable[[HandlerFn], HandlerFn]:
    """Register ``fn`` as the handler for ``task_type`` in the default registry."""
    return registry.handler(task_type)
