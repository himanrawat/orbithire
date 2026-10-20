"""render_pdf handler against real migrations (supabase/postgres) + MinIO as R2.

Includes the Phase 1 acceptance checks:
  * a queued render is ready within ~5 s,
  * 10 renders enqueued at once never run more than 2 at a time and all end ready,
  * the extracted PDF text contains the name and all section headings.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import time
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pypdf import PdfReader

from orbithire_worker.handlers import render_pdf as render_mod
from orbithire_worker.registry import Registry
from orbithire_worker.rendering import engine as engine_mod
from orbithire_worker.settings import Settings
from orbithire_worker.worker import Worker
from worker_helpers import running_worker, wait_for

SAMPLES = Path(__file__).resolve().parents[3] / "templates" / "typst" / "samples"


def sample(name: str) -> dict:
    return json.loads((SAMPLES / f"{name}.json").read_text())


@pytest.fixture
def rsettings(supa_url: str, minio: dict) -> Settings:
    return Settings(
        _env_file=None,
        database_url=supa_url,
        r2_endpoint=minio["endpoint"],
        r2_bucket=minio["bucket"],
        r2_access_key_id=minio["key"],
        r2_secret_access_key=minio["secret"],
        r2_account_id=None,
        r2_public_base_url=None,
        worker_poll_interval=0.5,
        worker_backoff_base=0.2,
        worker_backoff_max=1,
        worker_reclaim_interval=3600,
        worker_shutdown_grace=5,
        worker_http_enabled=False,
        worker_concurrency={"render_pdf": 2},
        worker_timeouts={"render_pdf": 30},
    )


def registry() -> Registry:
    reg = Registry()
    reg.register("render_pdf", render_mod.render_pdf)
    return reg


@pytest.fixture
async def db(supa_url: str):
    async with await psycopg.AsyncConnection.connect(supa_url, autocommit=True) as conn:
        await conn.execute("DELETE FROM tasks")
        yield conn


@pytest.fixture
async def user(db) -> str:
    uid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO auth.users (id, email, aud, role) VALUES (%s, %s, 'authenticated', 'authenticated')",
        (uid, f"{uid[:8]}@test.local"),
    )
    await db.execute("UPDATE profiles SET full_name = 'Profile Person', phone = '+1 555' WHERE id = %s", (uid,))
    return uid


async def make_company(db, user: str, name: str = "Acme Robotics") -> str:
    cur = await db.execute(
        "INSERT INTO companies (user_id, name, job_title, recruiter_name) VALUES (%s, %s, 'Engineer', 'Morgan Patel') RETURNING id",
        (user, name),
    )
    return str((await cur.fetchone())[0])


async def make_resume(db, user: str, company: str | None, content: dict, template: str = "modern") -> str:
    cur = await db.execute(
        "INSERT INTO resumes (user_id, company_id, title, content_json, template, engine, pdf_status) "
        "VALUES (%s, %s, 'Resume', %s, %s, 'typst', 'queued') RETURNING id",
        (user, company, Jsonb(content), template),
    )
    return str((await cur.fetchone())[0])


async def enqueue(db, user: str, payload: dict, max_attempts: int | None = None) -> str:
    cur = await db.execute("SELECT enqueue_task('render_pdf', %s, 0, %s)", (Jsonb(payload), user))
    task_id = (await cur.fetchone())[0]
    if max_attempts is not None:
        await db.execute("UPDATE tasks SET max_attempts = %s WHERE id = %s", (max_attempts, task_id))
    return str(task_id)


async def row(db, table: str, doc_id: str) -> dict:
    async with db.cursor(row_factory=dict_row) as cur:
        await cur.execute(f"SELECT * FROM {table} WHERE id = %s", (doc_id,))
        return await cur.fetchone()


async def task_row(db, task_id: str) -> dict:
    async with db.cursor(row_factory=dict_row) as cur:
        await cur.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
        return await cur.fetchone()


def doc_status(db, table, doc_id, *statuses):
    async def pred():
        r = await row(db, table, doc_id)
        return r if r and r["pdf_status"] in statuses else None
    return pred


def pdf_text(minio: dict, key: str) -> tuple[str, int]:
    body = minio["s3"].get_object(Bucket=minio["bucket"], Key=key)["Body"].read()
    reader = PdfReader(io.BytesIO(body))
    return "\n".join(p.extract_text() or "" for p in reader.pages), len(reader.pages)


def squash(s: str) -> str:
    return "".join(s.split()).lower()


# ------------------------------------------------------------------- tests

async def test_resume_renders_to_r2_and_row_is_ready(db, user, rsettings, minio):
    company = await make_company(db, user)
    data = sample("resume-full")
    doc = await make_resume(db, user, company, data)
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        t0 = time.monotonic()
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": doc})
        r = await wait_for(doc_status(db, "resumes", doc, "ready", "failed"), timeout=10)
        elapsed = time.monotonic() - t0
    assert r["pdf_status"] == "ready", r["pdf_error"]
    assert elapsed < 5, f"PDF took {elapsed:.2f}s"
    assert r["pdf_error"] is None
    # key scheme of lib/r2.ts generateFileKey + proxy URL
    assert r["pdf_key"].startswith(f"{user}/resumes/acme-robotics-") and r["pdf_key"].endswith(".pdf")
    assert r["pdf_url"] == f"/api/files/{r['pdf_key']}"
    text, pages = pdf_text(minio, r["pdf_key"])
    assert squash(data["basics"]["name"]) in squash(text)
    for h in ["Summary", "Skills", "Experience", "Education", "Projects", "Certifications", "Languages"]:
        assert squash(h) in squash(text), h
    t = await task_row(db, task_id)
    assert t["status"] == "done" and t["result"]["pages"] == pages
    print(f"\nsingle render: ready after {elapsed*1000:.0f} ms, task result {t['result']}")


async def test_rerender_replaces_old_object(db, user, rsettings, minio):
    doc = await make_resume(db, user, None, sample("resume-minimal"), template="ats-classic")
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        await enqueue(db, user, {"document_type": "resume", "document_id": doc})
        first = await wait_for(doc_status(db, "resumes", doc, "ready"), timeout=10)
        await db.execute("UPDATE resumes SET pdf_status='queued' WHERE id=%s", (doc,))
        await asyncio.sleep(0.01)
        await enqueue(db, user, {"document_type": "resume", "document_id": doc, "template_id": "compact", "accent": "#aa0000", "paper": "letter"})
        second = await wait_for(
            lambda: _ready_with_new_key(db, doc, first["pdf_key"]), timeout=10
        )
    assert second["pdf_key"] != first["pdf_key"]
    # no company -> title used for the key
    assert second["pdf_key"].startswith(f"{user}/resumes/resume-")
    objs = minio["s3"].list_objects_v2(Bucket=minio["bucket"], Prefix=f"{user}/")
    keys = [o["Key"] for o in objs.get("Contents", [])]
    assert first["pdf_key"] not in keys and second["pdf_key"] in keys
    body = minio["s3"].get_object(Bucket=minio["bucket"], Key=second["pdf_key"])["Body"].read()
    assert round(float(PdfReader(io.BytesIO(body)).pages[0].mediabox.width)) == 612  # letter


async def _ready_with_new_key(db, doc, old_key):
    r = await row(db, "resumes", doc)
    return r if r["pdf_status"] == "ready" and r["pdf_key"] != old_key else None


async def test_legacy_cover_letter_text(db, user, rsettings, minio):
    company = await make_company(db, user, "Globex")
    resume = await make_resume(db, user, company, sample("resume-full"))
    text = "Dear Morgan,\n\nI am thrilled to apply for this platform role at Globex.\n\nSincerely,\nJordan"
    cur = await db.execute(
        "INSERT INTO cover_letters (user_id, company_id, resume_id, title, content, engine, template, pdf_status) "
        "VALUES (%s, %s, %s, 'CL', %s, 'typst', 'cover-classic', 'queued') RETURNING id",
        (user, company, resume, text),
    )
    cl = str((await cur.fetchone())[0])
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        await enqueue(db, user, {"document_type": "cover_letter", "document_id": cl})
        r = await wait_for(doc_status(db, "cover_letters", cl, "ready", "failed"), timeout=10)
    assert r["pdf_status"] == "ready", r["pdf_error"]
    assert r["pdf_key"].startswith(f"{user}/cover-letters/globex-")
    pdf, _ = pdf_text(minio, r["pdf_key"])
    assert "thrilled to apply" in pdf
    assert "Jordan Rivera" in pdf  # basics from the linked resume
    assert "Globex" in pdf  # recipient company


async def test_structured_cover_letter(db, user, rsettings, minio):
    cur = await db.execute(
        "INSERT INTO cover_letters (user_id, title, content_json, engine, template, pdf_status) "
        "VALUES (%s, 'CL', %s, 'typst', 'cover-modern', 'queued') RETURNING id",
        (user, Jsonb(sample("cover-letter"))),
    )
    cl = str((await cur.fetchone())[0])
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        await enqueue(db, user, {"document_type": "cover_letter", "document_id": cl})
        r = await wait_for(doc_status(db, "cover_letters", cl, "ready", "failed"), timeout=10)
    assert r["pdf_status"] == "ready", r["pdf_error"]


async def test_photo_template_uses_inline_photo(db, user, rsettings, minio):
    data = sample("resume-eu")
    photo = (SAMPLES / "photo.png").read_bytes()
    data["basics"]["image"] = "data:image/png;base64," + base64.b64encode(photo).decode()
    doc = await make_resume(db, user, None, data, template="eu-photo")
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": doc})
        r = await wait_for(doc_status(db, "resumes", doc, "ready", "failed"), timeout=10)
    assert r["pdf_status"] == "ready", r["pdf_error"]
    assert (await task_row(db, task_id))["result"]["photo"] is True


async def test_photo_from_profile_avatar_in_r2(db, user, rsettings, minio):
    key = f"{user}/photos/avatar.png"
    minio["s3"].put_object(Bucket=minio["bucket"], Key=key, Body=(SAMPLES / "photo.png").read_bytes())
    await db.execute("UPDATE profiles SET avatar_url = %s WHERE id = %s", (key, user))
    doc = await make_resume(db, user, None, sample("resume-eu"), template="eu-photo")
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": doc})
        r = await wait_for(doc_status(db, "resumes", doc, "ready", "failed"), timeout=10)
    assert r["pdf_status"] == "ready", r["pdf_error"]
    assert (await task_row(db, task_id))["result"]["photo"] is True


async def test_unknown_template_fails_immediately(db, user, rsettings):
    doc = await make_resume(db, user, None, sample("resume-minimal"))
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": doc, "template_id": "nope"})
        r = await wait_for(doc_status(db, "resumes", doc, "failed"), timeout=10)
        t = await wait_for(lambda: _task_in(db, task_id, "failed"), timeout=5)
    assert "unknown Typst template" in r["pdf_error"]
    assert t["attempts"] == 1  # deterministic error: not retried


async def test_wrong_kind_template_fails(db, user, rsettings):
    doc = await make_resume(db, user, None, sample("resume-minimal"), template="cover-classic")
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        await enqueue(db, user, {"document_type": "resume", "document_id": doc, "template_id": "cover-classic"})
        r = await wait_for(doc_status(db, "resumes", doc, "failed"), timeout=10)
    assert "not resume" in r["pdf_error"]


async def test_upload_failure_is_retried_then_failed(db, user, rsettings):
    bad = rsettings.model_copy(update={"r2_bucket": "does-not-exist"})
    doc = await make_resume(db, user, None, sample("resume-minimal"))
    seen_queued_with_error = False
    async with running_worker(Worker(bad, registry=registry(), worker_id="t1")):
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": doc}, max_attempts=2)

        async def failed():
            nonlocal seen_queued_with_error
            r = await row(db, "resumes", doc)
            if r["pdf_status"] == "queued" and r["pdf_error"]:
                seen_queued_with_error = True
            return r if r["pdf_status"] == "failed" else None

        r = await wait_for(failed, timeout=20, interval=0.02)
        t = await wait_for(lambda: _task_in(db, task_id, "failed"), timeout=5)
    assert seen_queued_with_error, "first failure should leave the row queued for retry"
    assert t["attempts"] == 2
    assert "NoSuchBucket" in r["pdf_error"] or "bucket" in r["pdf_error"].lower()


async def test_missing_document_is_skipped(db, user, rsettings):
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")):
        task_id = await enqueue(db, user, {"document_type": "resume", "document_id": str(uuid.uuid4())})
        t = await wait_for(lambda: _task_in(db, task_id, "done"), timeout=10)
    assert t["result"]["skipped"]


async def _task_in(db, task_id, status):
    t = await task_row(db, task_id)
    return t if t["status"] == status else None


# --------------------------------------------------------- Phase 1 acceptance

@pytest.mark.parametrize("slow", [False, True], ids=["real-speed", "slowed-0.25s"])
async def test_ten_parallel_renders_max_two_at_once(db, user, rsettings, minio, monkeypatch, slow):
    """10 renders enqueued at once: never more than 2 running, all end ready.

    The slowed variant adds 0.25 s per compile so renders overlap enough to
    prove both slots are actually used (peak == 2)."""
    active = 0
    peak = 0
    original = engine_mod.TypstEngine.compile

    def tracked(self, *a, **kw):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        try:
            if slow:
                time.sleep(0.25)
            return original(self, *a, **kw)
        finally:
            active -= 1

    monkeypatch.setattr(engine_mod.TypstEngine, "compile", tracked)
    company = await make_company(db, user)
    templates = ["modern", "ats-classic", "compact", "modern", "ats-classic"]
    docs = [await make_resume(db, user, company, sample("resume-full"), template=templates[i % 5]) for i in range(10)]

    db_peak = 0
    async with running_worker(Worker(rsettings, registry=registry(), worker_id="t1")) as w:
        t0 = time.monotonic()
        # all 10 in one transaction = "at once"
        async with db.transaction():
            for d in docs:
                await enqueue(db, user, {"document_type": "resume", "document_id": d})

        async def all_ready():
            nonlocal db_peak
            cur = await db.execute("SELECT count(*) FILTER (WHERE status='running'), count(*) FILTER (WHERE status='done') FROM tasks")
            running, done = await cur.fetchone()
            cur = await db.execute("SELECT count(*) FROM resumes WHERE pdf_status='rendering' AND user_id=%s", (user,))
            rendering = (await cur.fetchone())[0]
            db_peak = max(db_peak, running, rendering, w.slots()["render_pdf"]["in_use"])
            return done == 10

        await wait_for(all_ready, timeout=30, interval=0.01)
        elapsed = time.monotonic() - t0

    cur = await db.execute("SELECT pdf_status, count(*) FROM resumes WHERE id = ANY(%s) GROUP BY 1", (docs,))
    statuses = dict(await cur.fetchall())
    assert statuses == {"ready": 10}
    assert peak <= 2 and db_peak <= 2
    if slow:
        assert peak == 2
        assert elapsed >= 5 * 0.25  # 10 renders / 2 slots
    print(f"\n10 parallel renders ({'slowed' if slow else 'real'}): all ready in {elapsed:.2f}s, "
          f"peak concurrent compiles={peak}, peak running (db/slots)={db_peak}")
