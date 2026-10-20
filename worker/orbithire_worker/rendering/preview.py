"""`POST /preview` – fast page-1 render for the live editor preview.

Request JSON:
  template_id   Typst template id (required)
  data          resume / cover-letter JSON (same shape the template reads)
  accent        optional "#RRGGBB"
  paper         optional "a4" | "letter"
  format        "png" (default) | "svg"
  width         PNG width in px (default PREVIEW_WIDTH, max 2000)
  photo         optional data: URL; else basics.image when it is a data: URL

Response: image/png or image/svg+xml of page 1, with headers
  X-Page-Count, X-Render-Ms, X-Template-Id
Errors: 400 bad request / unknown template, 422 Typst compile error.

Compilers are pooled and reused (typst.Compiler keeps fonts + parsed
templates cached), concurrency is capped by PREVIEW_CONCURRENCY.
"""

from __future__ import annotations

import asyncio
import hashlib
import tempfile
import time
from pathlib import Path
from typing import Any

from .config import get_render_settings
from .documents import strip_inline_images
from .engine import RenderError, get_engine
from .photo import decode_data_url, write_photo

_sem: asyncio.Semaphore | None = None
_photo_dir: Path | None = None


def _semaphore() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(max(get_render_settings().preview_concurrency, 1))
    return _sem


def _photo_cache_dir() -> Path:
    global _photo_dir
    if _photo_dir is None:
        _photo_dir = Path(tempfile.mkdtemp(prefix="orbithire-preview-"))
    return _photo_dir


class PreviewError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status


async def render_preview(body: Any) -> tuple[bytes, str, dict[str, str]]:
    if not isinstance(body, dict):
        raise PreviewError(400, "body must be a JSON object")
    rs = get_render_settings()
    engine = get_engine()
    template_id = body.get("template_id")
    data = body.get("data")
    if not isinstance(data, dict):
        raise PreviewError(400, "data must be an object")
    try:
        meta = engine.meta(template_id)
    except RenderError as exc:
        raise PreviewError(400, str(exc)) from exc
    fmt = body.get("format") or "png"
    if fmt not in ("png", "svg"):
        raise PreviewError(400, "format must be png or svg")
    try:
        width = min(max(int(body.get("width") or rs.preview_width), 100), 2000)
    except (TypeError, ValueError):
        width = rs.preview_width
    doc_meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    paper = body.get("paper") or doc_meta.get("paper")
    accent = body.get("accent") or doc_meta.get("accent")
    page_in = 8.5 if paper == "letter" else 210 / 25.4
    ppi = width / page_in

    photo_path = None
    if meta.photo:
        basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
        src = body.get("photo") or basics.get("image")
        if isinstance(src, str) and src.startswith("data:"):
            raw = decode_data_url(src, rs.render_photo_max_bytes)
            if raw:
                photo_path = write_photo(raw, _photo_cache_dir())
    clean = strip_inline_images(data)

    started = time.perf_counter()
    async with _semaphore():
        try:
            pages = await asyncio.to_thread(
                engine.compile, template_id, clean, fmt=fmt, photo=photo_path,
                accent=accent, paper=paper, ppi=ppi if fmt == "png" else None,
            )
        except RenderError as exc:
            raise PreviewError(422, str(exc)) from exc
    ms = (time.perf_counter() - started) * 1000
    headers = {
        "X-Page-Count": str(len(pages)),
        "X-Render-Ms": f"{ms:.1f}",
        "X-Template-Id": template_id,
        "Cache-Control": "no-store",
        "ETag": '"' + hashlib.sha1(pages[0]).hexdigest()[:16] + '"',
    }
    return pages[0], "image/png" if fmt == "png" else "image/svg+xml", headers
