"""Fixtures for the Typst rendering tests.

* ``supa_url``  – throwaway ``supabase/postgres`` container (has the auth
  schema, roles and extensions) with every real migration from
  ``supabase/migrations`` applied. Override with ``TEST_SUPABASE_DB_URL``
  (must be a scratch database: migrations are applied to it).
* ``minio``     – throwaway MinIO container standing in for R2 (bucket
  ``orbithire-test``). The real R2 bucket is never touched: R2 settings are
  always built explicitly from this container.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Iterator

import boto3
import psycopg
import pytest

REPO = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO / "supabase" / "migrations"
SUPA_IMAGE = os.environ.get("TEST_SUPABASE_PG_IMAGE", "public.ecr.aws/supabase/postgres:17.11.0.004")
MINIO_IMAGE = os.environ.get("TEST_MINIO_IMAGE", "minio/minio:latest")
BUCKET = "orbithire-test"
MINIO_USER = "orbithire"
MINIO_PASS = "orbithire-secret"


def _docker_run(name: str, args: list[str], port: str) -> str:
    if not shutil.which("docker"):
        pytest.skip("docker not available")
    proc = subprocess.run(["docker", "run", "-d", "--rm", "--name", name, *args], capture_output=True, text=True)
    if proc.returncode != 0:
        pytest.skip(f"could not start {name}: {proc.stderr.strip()[:300]}")
    out = subprocess.run(["docker", "port", name, port], check=True, capture_output=True, text=True).stdout
    return out.strip().splitlines()[0].rsplit(":", 1)[1]


def _wait_pg(url: str, timeout: float = 90) -> None:
    deadline = time.time() + timeout
    ok_streak = 0
    last: Exception | None = None
    while time.time() < deadline:
        try:
            with psycopg.connect(url, connect_timeout=2) as conn:
                conn.execute("SELECT auth.uid()")
            ok_streak += 1
            if ok_streak >= 3:  # image restarts once after its init scripts
                return
        except Exception as exc:  # noqa: BLE001
            ok_streak = 0
            last = exc
        time.sleep(1)
    raise RuntimeError(f"supabase postgres not ready: {last}")


def apply_migrations(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        for f in sorted(MIGRATIONS.glob("*.sql")):
            conn.execute(f.read_text())


@pytest.fixture(scope="session")
def supa_url() -> Iterator[str]:
    url = os.environ.get("TEST_SUPABASE_DB_URL")
    name = None
    if not url:
        name = f"orbithire-render-pg-{uuid.uuid4().hex[:8]}"
        port = _docker_run(name, ["-e", "POSTGRES_PASSWORD=postgres", "-p", "127.0.0.1::5432", SUPA_IMAGE], "5432/tcp")
        url = f"postgresql://postgres:postgres@127.0.0.1:{port}/postgres"
    try:
        _wait_pg(url)
        apply_migrations(url)
        yield url
    finally:
        if name:
            subprocess.run(["docker", "rm", "-f", name], capture_output=True)


@pytest.fixture(scope="session")
def minio() -> Iterator[dict]:
    name = f"orbithire-render-minio-{uuid.uuid4().hex[:8]}"
    port = _docker_run(
        name,
        ["-e", f"MINIO_ROOT_USER={MINIO_USER}", "-e", f"MINIO_ROOT_PASSWORD={MINIO_PASS}",
         "-p", "127.0.0.1::9000", MINIO_IMAGE, "server", "/data"],
        "9000/tcp",
    )
    endpoint = f"http://127.0.0.1:{port}"
    s3 = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=MINIO_USER,
                      aws_secret_access_key=MINIO_PASS, region_name="us-east-1")
    try:
        deadline = time.time() + 60
        while True:
            try:
                s3.create_bucket(Bucket=BUCKET)
                break
            except Exception:  # noqa: BLE001
                if time.time() > deadline:
                    raise
                time.sleep(0.5)
        yield {"endpoint": endpoint, "bucket": BUCKET, "key": MINIO_USER, "secret": MINIO_PASS, "s3": s3}
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True)
