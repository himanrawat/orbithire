"""Helpers shared by worker tests (kept out of conftest so they can be imported)."""

from __future__ import annotations

import asyncio
import contextlib
from typing import AsyncIterator


@contextlib.asynccontextmanager
async def running_worker(worker) -> AsyncIterator[object]:
    await worker.start()
    task = asyncio.create_task(worker.run())
    try:
        yield worker
    finally:
        worker.request_stop()
        await asyncio.wait_for(task, 15)


async def wait_for(predicate, timeout: float = 10, interval: float = 0.05):
    deadline = asyncio.get_running_loop().time() + timeout
    while True:
        value = await predicate()
        if value:
            return value
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition not met in time")
        await asyncio.sleep(interval)
