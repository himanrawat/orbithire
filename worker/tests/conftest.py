"""Shared fixtures.

DB tests run against a throwaway Postgres container (``docker run`` on a random
port), or against ``TEST_DATABASE_URL`` if set (the `tasks` table is dropped
and recreated there, so never point it at a real database).

The ``pg_url`` fixture is not autouse, so tests that don't need a database
(e.g. tests/fetchers) never start a container.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import AsyncIterator, Iterator

import psycopg
import pytest

from orbithire_worker.settings import Settings

FIXTURE_SQL = Path(__file__).parent / "fixtures" / "tasks.sql"
PG_IMAGE = os.environ.get("TEST_PG_IMAGE", "postgres:16-alpine")


def _wait_for_pg(url: str, timeout: float = 60) -> None:
    deadline = time.time() + timeout
    last: Exception | None = None
    while time.time() < deadline:
        try:
            with psycopg.connect(url, connect_timeout=2) as conn:
                conn.execute("SELECT 1")
                return
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(0.5)
    raise RuntimeError(f"postgres did not become ready: {last}")


@pytest.fixture(scope="session")
def pg_url() -> Iterator[str]:
    url = os.environ.get("TEST_DATABASE_URL")
    container = None
    if not url:
        if not shutil.which("docker"):
            pytest.skip("docker not available and TEST_DATABASE_URL not set")
        name = f"orbithire-worker-test-{uuid.uuid4().hex[:8]}"
        subprocess.run(
            [
                "docker", "run", "-d", "--rm", "--name", name,
                "-e", "POSTGRES_PASSWORD=postgres",
                "-p", "127.0.0.1::5432",
                PG_IMAGE,
            ],
            check=True,
            capture_output=True,
        )
        container = name
        port = subprocess.run(
            ["docker", "port", name, "5432/tcp"], check=True, capture_output=True, text=True
        ).stdout.strip().splitlines()[0].rsplit(":", 1)[1]
        url = f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres"
    try:
        _wait_for_pg(url)
        # Postgres restarts once after initdb in the official image; settle.
        time.sleep(1)
        _wait_for_pg(url)
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("DROP TABLE IF EXISTS tasks CASCADE")
            conn.execute(FIXTURE_SQL.read_text())
        yield url
    finally:
        if container:
            subprocess.run(["docker", "rm", "-f", container], capture_output=True)


@pytest.fixture
async def db(pg_url: str) -> AsyncIterator[psycopg.AsyncConnection]:
    async with await psycopg.AsyncConnection.connect(pg_url, autocommit=True) as conn:
        await conn.execute("TRUNCATE tasks")
        yield conn


@pytest.fixture
def settings(pg_url: str) -> Settings:
    return Settings(
        _env_file=None,
        database_url=pg_url,
        worker_poll_interval=0.5,
        worker_backoff_base=0.3,
        worker_backoff_max=5,
        worker_reclaim_interval=3600,
        worker_shutdown_grace=2,
        worker_http_enabled=False,
        worker_concurrency={"noop": 2},
        worker_timeouts={"noop": 5},
    )
