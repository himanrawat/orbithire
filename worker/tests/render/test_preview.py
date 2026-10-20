"""POST /preview over the real internal HTTP server, plus pure unit tests."""

from __future__ import annotations

import base64
import json
import statistics
import time
from pathlib import Path

import httpx
import pytest

from orbithire_worker.internal_http import HttpServer
from orbithire_worker.rendering.documents import (
    build_cover_letter_data,
    check_pdf,
    expected_resume_headings,
    strip_inline_images,
)
from orbithire_worker.rendering.engine import RenderError, get_engine
from orbithire_worker.rendering.photo import fetch_photo_bytes

SAMPLES = Path(__file__).resolve().parents[3] / "templates" / "typst" / "samples"


def sample(name: str) -> dict:
    return json.loads((SAMPLES / f"{name}.json").read_text())


class _NoWorker:
    async def health(self):  # pragma: no cover - not used here
        return {"ok": True}


@pytest.fixture
async def server():
    srv = HttpServer(_NoWorker(), "127.0.0.1", 0)  # type: ignore[arg-type]
    await srv.start()
    try:
        yield f"http://127.0.0.1:{srv.port}"
    finally:
        await srv.stop()


async def test_preview_png_and_warm_latency(server):
    data = sample("resume-full")
    async with httpx.AsyncClient(base_url=server, timeout=10) as c:
        first_t = time.perf_counter()
        r = await c.post("/preview", json={"template_id": "modern", "data": data})
        first_ms = (time.perf_counter() - first_t) * 1000
        assert r.status_code == 200, r.text
        assert r.headers["content-type"] == "image/png"
        assert r.content.startswith(b"\x89PNG")
        assert int(r.headers["x-page-count"]) >= 1

        timings = []
        for i in range(10):
            # simulate typing: the data changes on every request
            data["basics"]["summary"] = f"Edited summary revision {i} " * 3
            t = time.perf_counter()
            r = await c.post("/preview", json={"template_id": "modern", "data": data, "accent": "#0f766e"})
            timings.append((time.perf_counter() - t) * 1000)
            assert r.status_code == 200
    print(f"\n/preview first={first_ms:.0f} ms, warm median={statistics.median(timings):.0f} ms, max={max(timings):.0f} ms")
    assert max(timings) < 500
    assert statistics.median(timings) < 300


async def test_preview_svg_cover_letter_and_photo(server):
    photo = "data:image/png;base64," + base64.b64encode((SAMPLES / "photo.png").read_bytes()).decode()
    eu = sample("resume-eu")
    eu["basics"]["image"] = photo
    async with httpx.AsyncClient(base_url=server, timeout=10) as c:
        r = await c.post("/preview", json={"template_id": "cover-classic", "data": sample("cover-letter"), "format": "svg"})
        assert r.status_code == 200 and r.headers["content-type"] == "image/svg+xml"
        r = await c.post("/preview", json={"template_id": "eu-photo", "data": eu, "paper": "letter"})
        assert r.status_code == 200
        with_photo = r.content
        eu["basics"].pop("image")
        r = await c.post("/preview", json={"template_id": "eu-photo", "data": eu, "paper": "letter"})
        assert r.status_code == 200 and r.content != with_photo


async def test_preview_errors(server):
    async with httpx.AsyncClient(base_url=server, timeout=10) as c:
        assert (await c.post("/preview", json={"template_id": "nope", "data": {}})).status_code == 400
        assert (await c.post("/preview", json={"template_id": "../etc", "data": {}})).status_code == 400
        assert (await c.post("/preview", json={"template_id": "modern"})).status_code == 400
        assert (await c.post("/preview", content=b"{not json")).status_code == 400
        assert (await c.get("/preview")).status_code == 405


# ------------------------------------------------------------------ units

def test_expected_headings_respect_hidden_and_labels():
    d = sample("resume-full")
    assert expected_resume_headings(d) == ["Summary", "Experience", "Education", "Skills", "Projects"]
    d["meta"] = {"hiddenSections": ["projects", "work"], "labels": {"skills": "Kenntnisse"}}
    assert expected_resume_headings(d) == ["Summary", "Education", "Kenntnisse"]


def test_strip_inline_images_keeps_urls():
    d = {"basics": {"name": "A", "image": "data:image/png;base64,AAAA"}}
    assert "image" not in strip_inline_images(d)["basics"]
    assert "image" in d["basics"]  # original untouched
    d2 = {"basics": {"image": "https://x/y.png"}}
    assert strip_inline_images(d2)["basics"]["image"] == "https://x/y.png"


def test_cover_letter_builder():
    legacy = build_cover_letter_data({"content": "Hi\n\nBody"}, basics_fallback={"name": "N"}, company_name="Co")
    assert legacy["recipient"] == {"company": "Co"} and legacy["content"] == "Hi\n\nBody"
    structured = build_cover_letter_data(
        {"content_json": {"basics": {"email": "e"}, "paragraphs": ["p"]}}, basics_fallback={"name": "N", "email": "x"}, company_name=None
    )
    assert structured["basics"] == {"email": "e", "name": "N"}
    with pytest.raises(RenderError):
        build_cover_letter_data({"content": "  "}, basics_fallback={}, company_name=None)


def test_check_pdf_rejects_missing_text_and_size():
    pdf = get_engine().compile("ats-classic", sample("resume-minimal"))[0]
    check_pdf(pdf, must_contain=["Experience"], max_bytes=2_000_000, max_pages=6)
    with pytest.raises(RenderError, match="missing"):
        check_pdf(pdf, must_contain=["Definitely Not There"], max_bytes=2_000_000, max_pages=6)
    with pytest.raises(RenderError, match="too large"):
        check_pdf(pdf, must_contain=[], max_bytes=100, max_pages=6)


def test_photo_sources_order():
    png = (SAMPLES / "photo.png").read_bytes()
    data_url = "data:image/png;base64," + base64.b64encode(png).decode()
    calls = []

    def r2_get(key):
        calls.append(key)
        return png if key == "u/photos/a.png" else None

    assert fetch_photo_bytes([data_url, "u/photos/a.png"], r2_get=r2_get, max_bytes=10**7) == png
    assert calls == []
    assert fetch_photo_bytes(["/api/profile/photo", "u/photos/a.png"], r2_get=r2_get, max_bytes=10**7) == png
    assert fetch_photo_bytes(["u/photos/missing.png"], r2_get=r2_get, max_bytes=10**7) is None
    assert fetch_photo_bytes([data_url], r2_get=None, max_bytes=10) is None  # too big
