"""Phase 0 acceptance + queue semantics, against a real Postgres."""

from __future__ import annotations

import asyncio
import time
from collections import Counter

import httpx
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from orbithire_worker import queue
from orbithire_worker.handlers import load_all
from orbithire_worker.internal_http import HttpServer
from orbithire_worker.registry import Registry, registry as default_registry
from orbithire_worker.settings import Settings
from orbithire_worker.worker import Worker
from worker_helpers import running_worker, wait_for

load_all()


async def enqueue(db, type_="noop", payload=None, priority=0, max_attempts=None) -> str:
    cur = await db.execute(
        "SELECT enqueue_task(%s, %s, %s, NULL)", (type_, Jsonb(payload or {}), priority)
    )
    (task_id,) = await cur.fetchone()
    if max_attempts is not None:
        await db.execute("UPDATE tasks SET max_attempts=%s WHERE id=%s", (max_attempts, task_id))
    return task_id


async def get(db, task_id):
    async with db.cursor(row_factory=dict_row) as cur:
        await cur.execute("SELECT * FROM tasks WHERE id=%s", (task_id,))
        return await cur.fetchone()


def status_is(db, task_id, *statuses):
    async def pred():
        row = await get(db, task_id)
        return row if row and row["status"] in statuses else None

    return pred


# --------------------------------------------------------------- acceptance


async def test_noop_task_is_processed(db, settings):
    task_id = await enqueue(db, payload={})
    async with running_worker(Worker(settings, worker_id="w1")):
        row = await wait_for(status_is(db, task_id, "done"))
    assert row["attempts"] == 1
    assert row["result"]["ok"] is True
    assert row["result"]["worker"] == "w1"
    assert row["locked_by"] is None and row["locked_at"] is None


async def test_failing_noop_retries_with_backoff_then_fails(db, settings):
    # backoff base 0.3s -> waits of 0.3s then 0.6s between the 3 attempts
    task_id = await enqueue(db, payload={"fail": True, "message": "boom"}, max_attempts=3)
    seen_backoffs: list[float] = []

    async def watch():
        last_attempt = 0
        while True:
            row = await get(db, task_id)
            if row["status"] == "queued" and row["attempts"] > last_attempt:
                last_attempt = row["attempts"]
                seen_backoffs.append((row["run_after"] - row["updated_at"]).total_seconds())
            if row["status"] == "failed":
                return
            await asyncio.sleep(0.02)

    started = time.monotonic()
    async with running_worker(Worker(settings, worker_id="w1")):
        await asyncio.wait_for(watch(), 15)
    elapsed = time.monotonic() - started

    row = await get(db, task_id)
    assert row["status"] == "failed"
    assert row["attempts"] == 3
    assert "boom" in row["last_error"]
    assert row["locked_by"] is None
    # retried with exponential backoff: 0.3s, then 0.6s
    assert len(seen_backoffs) == 2, seen_backoffs
    assert abs(seen_backoffs[0] - 0.3) < 0.1, seen_backoffs
    assert abs(seen_backoffs[1] - 0.6) < 0.1, seen_backoffs
    assert elapsed >= 0.9


async def test_failure_then_success_ends_done(db, settings):
    reg = Registry()
    calls = Counter()

    @reg.handler("noop")
    async def flaky(task, ctx):
        calls[task.id] += 1
        if task.attempts < 2:
            raise ValueError("transient")
        return {"attempt": task.attempts}

    task_id = await enqueue(db)
    async with running_worker(Worker(settings, registry=reg, worker_id="w1")):
        row = await wait_for(status_is(db, task_id, "done"))
    assert row["attempts"] == 2
    assert row["result"] == {"attempt": 2}
    assert "transient" in row["last_error"]  # history of the earlier failure is kept


async def test_two_workers_never_claim_the_same_task(db, settings):
    reg = Registry()
    calls: Counter = Counter()
    by_worker: Counter = Counter()

    @reg.handler("noop")
    async def counting(task, ctx):
        calls[str(task.id)] += 1
        by_worker[ctx.worker_id] += 1
        await asyncio.sleep(0.01)
        return {"worker": ctx.worker_id}

    s = settings.model_copy(update={"worker_concurrency": {"noop": 4}})
    ids = [str(await enqueue(db)) for _ in range(80)]

    async def all_done():
        cur = await db.execute("SELECT count(*) FROM tasks WHERE status='done'")
        return (await cur.fetchone())[0] == len(ids)

    async with running_worker(Worker(s, registry=reg, worker_id="A")), running_worker(
        Worker(s, registry=reg, worker_id="B")
    ):
        await wait_for(all_done, timeout=20)

    assert set(calls) == set(ids)
    assert all(n == 1 for n in calls.values()), [i for i, n in calls.items() if n > 1]
    cur = await db.execute("SELECT max(attempts), min(attempts) FROM tasks")
    assert tuple(await cur.fetchone()) == (1, 1)
    assert by_worker["A"] > 0 and by_worker["B"] > 0, by_worker


async def test_concurrent_claims_are_unique(db, pg_url):
    for _ in range(25):
        await enqueue(db)
    conns = [await psycopg.AsyncConnection.connect(pg_url, autocommit=True) for _ in range(40)]
    try:
        results = await asyncio.gather(*(queue.claim(c, f"w{i}", ["noop"]) for i, c in enumerate(conns)))
    finally:
        for c in conns:
            await c.close()
    claimed = [r.id for r in results if r is not None]
    assert len(claimed) == 25
    assert len(set(claimed)) == 25


# ------------------------------------------------------------ other semantics


async def test_priority_order(db, settings):
    low = await enqueue(db, priority=0)
    high = await enqueue(db, priority=10)
    t = await queue.claim(db, "w", ["noop"])
    assert str(t.id) == str(high)
    t2 = await queue.claim(db, "w", ["noop"])
    assert str(t2.id) == str(low)


async def test_run_after_in_future_is_not_claimed(db):
    task_id = await enqueue(db)
    await db.execute("UPDATE tasks SET run_after = now() + interval '1 hour' WHERE id=%s", (task_id,))
    assert await queue.claim(db, "w", ["noop"]) is None


async def test_only_registered_types_are_claimed(db):
    await enqueue(db, type_="render_pdf")
    assert await queue.claim(db, "w", ["noop"]) is None
    assert (await queue.claim(db, "w", ["render_pdf"])).type == "render_pdf"


async def test_hard_timeout(db, settings):
    s = settings.model_copy(update={"worker_timeouts": {"noop": 0.3}})
    task_id = await enqueue(db, payload={"sleep": 5}, max_attempts=1)
    async with running_worker(Worker(s, worker_id="w1")):
        row = await wait_for(status_is(db, task_id, "failed"), timeout=5)
    assert row["last_error"].startswith("TaskTimeout")


async def test_per_type_concurrency_slots(db, settings):
    reg = Registry()
    active = 0
    peak = 0

    @reg.handler("noop")
    async def slow(task, ctx):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.2)
        active -= 1

    @reg.handler("render_pdf")
    async def render(task, ctx):
        return None

    s = settings.model_copy(update={"worker_concurrency": {"noop": 2, "render_pdf": 1}})
    for _ in range(6):
        await enqueue(db)
    render_id = await enqueue(db, type_="render_pdf")

    async def all_done():
        cur = await db.execute("SELECT count(*) FROM tasks WHERE status='done'")
        return (await cur.fetchone())[0] == 7

    started = time.monotonic()
    async with running_worker(Worker(s, registry=reg, worker_id="w1")) as w:
        # render isn't blocked behind the noop backlog
        await wait_for(status_is(db, render_id, "done"), timeout=0.5)
        await wait_for(all_done, timeout=10)
    assert peak == 2
    assert time.monotonic() - started >= 0.6  # 6 tasks / 2 slots * 0.2s


async def test_listen_notify_wakes_worker_without_polling(db, settings):
    s = settings.model_copy(update={"worker_poll_interval": 60})
    async with running_worker(Worker(s, worker_id="w1")):
        await asyncio.sleep(0.5)  # worker is now idle, waiting on NOTIFY
        task_id = await enqueue(db)
        await wait_for(status_is(db, task_id, "done"), timeout=3)


async def test_reclaim_stale_running_tasks(db, settings):
    stale = await enqueue(db)
    dead = await enqueue(db, max_attempts=2)
    fresh = await enqueue(db)
    await db.execute(
        "UPDATE tasks SET status='running', attempts=1, locked_by='ghost', locked_at=now()-interval '1 hour' WHERE id=%s",
        (stale,),
    )
    await db.execute(
        "UPDATE tasks SET status='running', attempts=2, locked_by='ghost', locked_at=now()-interval '1 hour' WHERE id=%s",
        (dead,),
    )
    # running for 6s with a 5s timeout: not stale yet (needs > 2x timeout)
    await db.execute(
        "UPDATE tasks SET status='running', attempts=1, locked_by='alive', locked_at=now()-interval '6 seconds' WHERE id=%s",
        (fresh,),
    )
    w = Worker(settings, worker_id="w1")
    await w.start()
    try:
        rows = await w.reclaim_stale()
    finally:
        w.request_stop()
        await w.run()
    assert {str(r["id"]) for r in rows} == {str(stale), str(dead)}
    assert (await get(db, stale))["status"] == "queued"
    assert (await get(db, dead))["status"] == "failed"
    assert "stale lock" in (await get(db, dead))["last_error"]
    assert (await get(db, fresh))["status"] == "running"


async def test_graceful_shutdown_releases_in_flight_task(db, settings):
    s = settings.model_copy(update={"worker_shutdown_grace": 0.2})
    task_id = await enqueue(db, payload={"sleep": 10})
    w = Worker(s, worker_id="w1")
    await w.start()
    runner = asyncio.create_task(w.run())
    await wait_for(status_is(db, task_id, "running"))
    w.request_stop()  # what SIGTERM does
    await asyncio.wait_for(runner, 5)
    row = await get(db, task_id)
    assert row["status"] == "queued"
    assert row["attempts"] == 0  # shutdown does not burn an attempt
    assert row["locked_by"] is None


async def test_completion_ignored_if_lock_lost(db):
    task_id = await enqueue(db)
    t = await queue.claim(db, "w1", ["noop"])
    await db.execute("UPDATE tasks SET locked_by='someone-else' WHERE id=%s", (task_id,))
    assert await queue.complete(db, t.id, "w1", {"x": 1}) is False


# ---------------------------------------------------------------------- http


async def test_http_health_and_preview(db, settings):
    w = Worker(settings, worker_id="w1")
    await w.start()
    server = HttpServer(w, "127.0.0.1", 0)
    await server.start()
    try:
        async with httpx.AsyncClient(base_url=f"http://127.0.0.1:{server.port}") as client:
            r = await client.get("/health")
            assert r.status_code == 200
            body = r.json()
            assert body["db"] is True and body["ok"] is True
            assert body["slots"]["noop"] == {"in_use": 0, "max": 2}
            r = await client.post("/preview", json={"template": "x"})
            assert r.status_code == 501
            assert (await client.get("/nope")).status_code == 404
            assert (await client.get("/preview")).status_code == 405
    finally:
        await server.stop()
        w.request_stop()
        await w.run()


# ------------------------------------------------------------------ settings


def test_settings_parsing(monkeypatch):
    monkeypatch.setenv("WORKER_CONCURRENCY", "render_pdf=3,fetch_jobs:2")
    monkeypatch.setenv("WORKER_TIMEOUTS", '{"render_pdf": 45}')
    monkeypatch.setenv("R2_ACCOUNT_ID", "abc")
    s = Settings(_env_file=None)
    assert s.concurrency_for("render_pdf") == 3
    assert s.concurrency_for("fetch_jobs") == 2
    assert s.concurrency_for("rank_jobs") == 1
    assert s.timeout_for("render_pdf") == 45
    assert s.timeout_for("fetch_jobs") == 300
    assert s.r2_resolved_endpoint == "https://abc.r2.cloudflarestorage.com"
    assert [s.backoff_for(n) for n in (1, 2, 3)] == [30, 60, 120]


def test_noop_registered():
    assert "noop" in default_registry
