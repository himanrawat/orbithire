"""`render_pdf` task: render a resume / cover letter with Typst and store the PDF in R2.

payload:
  document_type  "resume" | "cover_letter"
  document_id    uuid of the resumes / cover_letters row
  template_id    optional Typst template id (default: the row's `template`, else the kind's default)
  accent         optional "#RRGGBB" (default: content_json.meta.accent)
  paper          optional "a4" | "letter" (default: content_json.meta.paper)

Row lifecycle: pdf_status queued (set by the app) -> rendering -> ready
(pdf_key, pdf_url set, pdf_error cleared). On failure: pdf_status goes back
to `queued` with pdf_error while the task still has attempts left, and to
`failed` on the last attempt. Deterministic errors (unknown template, Typst
compile error, failed output checks) fail immediately: retrying won't help.

The handler enforces its own deadline (task timeout − 3 s) so it can record
the failure on the row before the worker's hard timeout fires.
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
import time
from pathlib import Path
from typing import Any

from psycopg.rows import dict_row

from ..r2 import generate_file_key, get_r2, proxy_url
from ..registry import Task, TaskContext, handler
from ..rendering.config import get_render_settings
from ..rendering.documents import (
    basics_from_profile,
    basics_from_resume,
    build_cover_letter_data,
    check_pdf,
    expected_resume_headings,
    letter_first_words,
    resume_name,
    strip_inline_images,
)
from ..rendering.engine import RenderError, get_engine
from ..rendering.photo import fetch_photo_bytes, write_photo

log = logging.getLogger(__name__)

TABLES = {"resume": "resumes", "cover_letter": "cover_letters"}


class RenderTimeout(Exception):
    pass


async def _set_row(ctx: TaskContext, table: str, doc_id: str, sql_set: str, params: dict[str, Any]) -> None:
    async with ctx.pool.connection() as conn:
        await conn.execute(f"UPDATE {table} SET {sql_set}, updated_at = now() WHERE id = %(id)s", {"id": doc_id, **params})


async def _fetchone(ctx: TaskContext, sql: str, params: dict[str, Any]) -> dict[str, Any] | None:
    async with ctx.pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, params)
            return await cur.fetchone()


@handler("render_pdf")
async def render_pdf(task: Task, ctx: TaskContext) -> dict:
    payload = task.payload or {}
    doc_type = payload.get("document_type")
    doc_id = payload.get("document_id")
    if doc_type not in TABLES or not doc_id:
        raise RenderError(f"bad payload: document_type={doc_type!r} document_id={doc_id!r}")
    table = TABLES[doc_type]
    budget = max(ctx.settings.timeout_for("render_pdf") - 3, 1)

    try:
        return await asyncio.wait_for(_render(task, ctx, doc_type, str(doc_id), table), timeout=budget)
    except asyncio.CancelledError:
        # Worker shutdown: the task is released back to the queue.
        await asyncio.shield(_set_row(ctx, table, str(doc_id), "pdf_status = 'queued'", {}))
        raise
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, asyncio.TimeoutError):
            exc = RenderTimeout(f"render exceeded {budget:g}s")
        permanent = isinstance(exc, RenderError)
        final = permanent or task.attempts >= task.max_attempts
        msg = f"{type(exc).__name__}: {exc}"[:2000]
        if not final:
            msg = f"attempt {task.attempts}/{task.max_attempts} failed, retrying: {msg}"
        try:
            await _set_row(
                ctx, table, str(doc_id),
                "pdf_status = %(status)s, pdf_error = %(err)s",
                {"status": "failed" if final else "queued", "err": msg},
            )
            if permanent:
                async with ctx.pool.connection() as conn:
                    await conn.execute("UPDATE tasks SET max_attempts = attempts WHERE id = %s", (task.id,))
        except Exception:  # noqa: BLE001
            log.exception("could not record render failure for %s %s", doc_type, doc_id)
        raise exc from None


async def _render(task: Task, ctx: TaskContext, doc_type: str, doc_id: str, table: str) -> dict:
    started = time.monotonic()
    payload = task.payload or {}
    rs = get_render_settings()
    engine = get_engine()

    extra = ", c.recruiter_name AS recruiter_name" if doc_type == "cover_letter" else ""
    row = await _fetchone(
        ctx,
        f"SELECT d.*, c.name AS company_name{extra} FROM {table} d "
        f"LEFT JOIN companies c ON c.id = d.company_id WHERE d.id = %(id)s",
        {"id": doc_id},
    )
    if row is None:
        log.info("render_pdf: %s %s no longer exists; skipping", doc_type, doc_id)
        return {"skipped": "document not found", "document_id": doc_id}

    await _set_row(ctx, table, doc_id, "pdf_status = 'rendering'", {})

    # ---- template
    template_id = payload.get("template_id") or (row.get("template") if row.get("template") in engine.template_ids else None)
    template_id = template_id or engine.default_template(doc_type)
    meta = engine.meta(template_id)
    if meta.kind != doc_type:
        raise RenderError(f"template {template_id!r} is a {meta.kind} template, not {doc_type}")

    # ---- data
    content = row.get("content_json") if isinstance(row.get("content_json"), dict) else {}
    profile = None
    if doc_type == "resume" or meta.photo or not (content.get("basics") or {}).get("name"):
        profile = await _fetchone(ctx, "SELECT * FROM profiles WHERE id = %(id)s", {"id": row["user_id"]})
    if doc_type == "resume":
        if not content:
            raise RenderError("resume has no content_json")
        data = strip_inline_images(content)
        name = resume_name(data)
        must = ([name] if name else []) + expected_resume_headings(data)
    else:
        fallback = basics_from_profile(profile)
        if row.get("resume_id"):
            r = await _fetchone(ctx, "SELECT content_json FROM resumes WHERE id = %(id)s", {"id": row["resume_id"]})
            fallback = {**fallback, **basics_from_resume(r and r.get("content_json"))}
        data = strip_inline_images(
            build_cover_letter_data(
                row, basics_fallback=fallback,
                company_name=row.get("company_name"), recruiter_name=row.get("recruiter_name"),
            )
        )
        name = ((data.get("basics") or {}).get("name") or "").strip()
        must = [m for m in (name, letter_first_words(data)) if m]

    doc_meta = content.get("meta") if isinstance(content.get("meta"), dict) else {}
    accent = payload.get("accent") or doc_meta.get("accent")
    paper = payload.get("paper") or doc_meta.get("paper")

    with tempfile.TemporaryDirectory(prefix="render-") as tmp:
        photo_path: Path | None = None
        if meta.photo:
            basics = content.get("basics") if isinstance(content.get("basics"), dict) else {}
            r2_get = None
            try:
                r2 = get_r2(ctx.settings)
                r2_get = lambda k: r2.get(k, max_bytes=rs.render_photo_max_bytes)  # noqa: E731
            except Exception:  # noqa: BLE001
                pass
            photo_bytes = await asyncio.to_thread(
                fetch_photo_bytes,
                [basics.get("image"), (profile or {}).get("avatar_url")],
                r2_get=r2_get,
                max_bytes=rs.render_photo_max_bytes,
            )
            if photo_bytes:
                photo_path = write_photo(photo_bytes, Path(tmp))

        compile_started = time.monotonic()
        pages = await asyncio.to_thread(
            engine.compile, template_id, data, fmt="pdf", photo=photo_path, accent=accent, paper=paper
        )
        compile_ms = round((time.monotonic() - compile_started) * 1000)
    pdf = pages[0]

    check = await asyncio.to_thread(
        check_pdf, pdf, must_contain=must, max_bytes=rs.render_max_pdf_bytes,
        max_pages=rs.render_max_pages, one_page=meta.one_page,
    )

    # ---- upload (same key scheme as lib/r2.ts generateFileKey)
    r2 = get_r2(ctx.settings)
    key = generate_file_key(str(row["user_id"]), doc_type, row.get("company_name") or row.get("title"))
    await asyncio.to_thread(r2.put, key, pdf, "application/pdf")

    # A newer save may have re-queued the row meanwhile: keep its status so
    # the newer task's result wins.
    await _set_row(
        ctx, table, doc_id,
        "pdf_key = %(key)s, pdf_url = %(url)s, pdf_error = NULL, "
        "pdf_status = CASE WHEN pdf_status = 'rendering' THEN 'ready' ELSE pdf_status END",
        {"key": key, "url": proxy_url(key)},
    )

    old_key = row.get("pdf_key")
    if old_key and old_key != key and str(old_key).startswith(f"{row['user_id']}/"):
        try:
            await asyncio.to_thread(r2.delete, old_key)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not delete old PDF %s: %s", old_key, exc)

    return {
        "document_type": doc_type,
        "document_id": doc_id,
        "template_id": template_id,
        "pdf_key": key,
        "pages": check.pages,
        "bytes": check.size,
        "photo": photo_path is not None,
        "compile_ms": compile_ms,
        "total_ms": round((time.monotonic() - started) * 1000),
        "warnings": check.warnings,
    }
