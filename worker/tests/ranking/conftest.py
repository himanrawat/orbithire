"""Fixtures for ranking/digest tests: a throwaway Supabase Postgres (pgvector, pg_cron,
auth schema) with the REAL migrations from supabase/migrations applied in order.

Set ``TEST_SUPABASE_DATABASE_URL`` to reuse an existing scratch database that already
has the migrations (never point it at a real database: tests insert and delete rows).
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

MIGRATIONS = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
IMAGE = os.environ.get("TEST_SUPABASE_PG_IMAGE", "public.ecr.aws/supabase/postgres:17.11.0.004")


def _wait(url: str, timeout: float = 120) -> None:
    deadline = time.time() + timeout
    last: Exception | None = None
    while time.time() < deadline:
        try:
            with psycopg.connect(url, connect_timeout=2) as conn:
                conn.execute("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'").fetchone()
                if conn.execute("SELECT to_regprocedure('auth.uid()')").fetchone()[0]:
                    return
        except Exception as exc:  # noqa: BLE001
            last = exc
        time.sleep(1)
    raise RuntimeError(f"supabase postgres did not become ready: {last}")


@pytest.fixture(scope="session")
def supa_url() -> Iterator[str]:
    url = os.environ.get("TEST_SUPABASE_DATABASE_URL")
    if url:
        yield url
        return
    if not shutil.which("docker"):
        pytest.skip("docker not available and TEST_SUPABASE_DATABASE_URL not set")
    name = f"orbithire-rank-test-{uuid.uuid4().hex[:8]}"
    subprocess.run(
        ["docker", "run", "-d", "--rm", "--name", name, "-e", "POSTGRES_PASSWORD=postgres",
         "-p", "127.0.0.1::5432", IMAGE],
        check=True, capture_output=True,
    )
    try:
        port = subprocess.run(["docker", "port", name, "5432/tcp"], check=True, capture_output=True,
                              text=True).stdout.strip().splitlines()[0].rsplit(":", 1)[1]
        url = f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres"
        _wait(url)
        time.sleep(2)  # init scripts restart the server once
        _wait(url)
        with psycopg.connect(url, autocommit=True) as conn:
            for f in sorted(MIGRATIONS.glob("*.sql")):
                try:
                    conn.execute(f.read_text())
                except Exception as exc:
                    raise RuntimeError(f"migration {f.name} failed: {exc}") from exc
        yield url
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)


@pytest.fixture
async def conn(supa_url: str) -> AsyncIterator[psycopg.AsyncConnection]:
    async with await psycopg.AsyncConnection.connect(supa_url, autocommit=True) as c:
        yield c


@pytest.fixture
async def user_id(conn: psycopg.AsyncConnection) -> AsyncIterator[str]:
    """A fresh auth user + profile (profiles row is created by our trigger or inserted here)."""
    uid = str(uuid.uuid4())
    email = f"rank-{uid[:8]}@example.test"
    await conn.execute(
        "INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES (%s, %s, 'authenticated', "
        "'authenticated', '00000000-0000-0000-0000-000000000000')", (uid, email))
    await conn.execute(
        "INSERT INTO profiles (id, email, full_name, headline, skills, target_job_titles, location) "
        "VALUES (%s, %s, 'Test User', 'Frontend Engineer', %s, %s, 'New Delhi, India') "
        "ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, headline = EXCLUDED.headline, "
        "skills = EXCLUDED.skills, target_job_titles = EXCLUDED.target_job_titles, location = EXCLUDED.location",
        (uid, email, ["React", "TypeScript", "Next.js", "Design systems"], ["Frontend Engineer", "UX Engineer"]))
    yield uid
    await conn.execute("DELETE FROM auth.users WHERE id = %s", (uid,))
    await conn.execute("DELETE FROM profiles WHERE id = %s", (uid,))
