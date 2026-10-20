"""Entry point: ``uv run worker`` (console script) or ``python -m orbithire_worker``."""

from __future__ import annotations

import asyncio
import logging
import os
import signal

from .handlers import load_all
from .internal_http import HttpServer
from .settings import get_settings
from .worker import Worker

log = logging.getLogger("orbithire_worker")


async def amain() -> None:
    settings = get_settings()
    load_all()
    worker = Worker(settings)

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, worker.request_stop)
        except NotImplementedError:  # pragma: no cover - Windows
            pass

    await worker.start()
    http: HttpServer | None = None
    if settings.worker_http_enabled:
        http = HttpServer(worker, settings.worker_http_host, settings.worker_http_port)
        await http.start()
    try:
        await worker.run()
    finally:
        if http is not None:
            await http.stop()


def run() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(amain())


if __name__ == "__main__":
    run()
