"""Turn DB rows into Typst input data, and check rendered PDFs."""

from __future__ import annotations

import copy
import io
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from pypdf import PdfReader

from .engine import RenderError

# Default section labels (mirror templates/typst/_lib/data.typ default-labels).
DEFAULT_LABELS = {
    "summary": "Summary",
    "experience": "Experience",
    "education": "Education",
    "skills": "Skills",
    "projects": "Projects",
}
_CANON = {"work": "experience"}


def _s(x: Any) -> str:
    return x.strip() if isinstance(x, str) else ""


def _list(d: dict, *keys: str) -> list:
    for k in keys:
        v = d.get(k)
        if isinstance(v, list) and v:
            return v
    return []


def strip_inline_images(data: dict) -> dict:
    """Drop base64 `data:` images from basics (photos come in via sys.inputs.photo)."""
    out = copy.deepcopy(data) if isinstance(data, dict) else {}
    basics = out.get("basics")
    if isinstance(basics, dict) and isinstance(basics.get("image"), str) and basics["image"].startswith("data:"):
        basics.pop("image")
    return out


def resume_name(data: dict) -> str:
    basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
    personal = data.get("personal") if isinstance(data.get("personal"), dict) else {}
    return _s(basics.get("name")) or _s(personal.get("name"))


def expected_resume_headings(data: dict) -> list[str]:
    """Headings that must appear: core sections that have data and are not hidden."""
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}
    labels = {**DEFAULT_LABELS, **{k: v for k, v in (meta.get("labels") or {}).items() if isinstance(v, str)}}
    hidden = {_CANON.get(str(h).lower(), str(h).lower()) for h in (meta.get("hiddenSections") or [])}
    basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
    present: list[str] = []
    if _s(basics.get("summary")) or _s(data.get("summary")):
        present.append("summary")
    work = [w for w in _list(data, "work", "experience") if isinstance(w, dict)
            and any(_s(w.get(k)) for k in ("position", "title", "role", "name", "company"))]
    if work:
        present.append("experience")
    edu = [e for e in _list(data, "education") if isinstance(e, dict)
           and any(_s(e.get(k)) for k in ("institution", "school", "studyType", "degree", "area", "field"))]
    if edu:
        present.append("education")
    skills = _list(data, "skills")
    if any((isinstance(s, dict) and (_s(s.get("name")) or s.get("keywords"))) or _s(s) for s in skills):
        present.append("skills")
    projects = [p for p in _list(data, "projects") if isinstance(p, dict) and (_s(p.get("name")) or _s(p.get("title")))]
    if projects:
        present.append("projects")
    return [labels[k] for k in present if k not in hidden]


# ------------------------------------------------------------ cover letters

def build_cover_letter_data(
    row: dict, *, basics_fallback: dict | None, company_name: str | None, recruiter_name: str | None = None
) -> dict:
    """content_json if present (filling missing basics), else wrap the legacy plain text."""
    cj = row.get("content_json")
    fb = basics_fallback or {}
    if isinstance(cj, dict) and cj:
        data = copy.deepcopy(cj)
        basics = data.get("basics") if isinstance(data.get("basics"), dict) else {}
        for k, v in fb.items():
            if v and not basics.get(k):
                basics[k] = v
        data["basics"] = basics
        return data
    text = row.get("content") or ""
    if not text.strip():
        raise RenderError("cover letter has no content")
    recipient: dict[str, Any] = {}
    if company_name:
        recipient["company"] = company_name
    if recruiter_name:
        recipient["name"] = recruiter_name
    return {
        "basics": dict(fb),
        "recipient": recipient,
        "date": date.today().isoformat(),
        "content": text,
    }


def basics_from_profile(profile: dict | None) -> dict:
    if not profile:
        return {}
    out = {
        "name": profile.get("full_name") or "",
        "email": profile.get("email") or "",
        "phone": profile.get("phone") or "",
        "location": profile.get("location") or "",
        "url": profile.get("portfolio_url") or "",
        "label": profile.get("headline") or "",
    }
    return {k: v for k, v in out.items() if v}


def basics_from_resume(content_json: Any) -> dict:
    if not isinstance(content_json, dict):
        return {}
    b = content_json.get("basics")
    if not isinstance(b, dict):
        return {}
    loc = b.get("location")
    if isinstance(loc, dict):
        loc = ", ".join(x for x in (loc.get("city"), loc.get("region")) if isinstance(x, str) and x)
    out = {"name": b.get("name"), "email": b.get("email"), "phone": b.get("phone"),
           "url": b.get("url"), "label": b.get("label"), "location": loc}
    return {k: v for k, v in out.items() if isinstance(v, str) and v}


def letter_first_words(data: dict, n: int = 6) -> str:
    paras = data.get("paragraphs")
    if isinstance(paras, list) and paras:
        first = next((p for p in paras if isinstance(p, str) and p.strip()), "")
    else:
        text = _s(data.get("content"))
        first = re.split(r"\n\s*\n", text)[0] if text else ""
    return " ".join(first.split()[:n])


# -------------------------------------------------------------------- checks

def squash(s: str) -> str:
    return re.sub(r"\s+", "", s).lower()


@dataclass
class CheckResult:
    pages: int
    size: int
    warnings: list[str] = field(default_factory=list)


def check_pdf(
    pdf: bytes,
    *,
    must_contain: list[str],
    max_bytes: int,
    max_pages: int,
    one_page: bool = False,
) -> CheckResult:
    if not pdf.startswith(b"%PDF"):
        raise RenderError("output is not a PDF")
    if len(pdf) > max_bytes:
        raise RenderError(f"PDF too large: {len(pdf)} bytes > {max_bytes}")
    reader = PdfReader(io.BytesIO(pdf))
    pages = len(reader.pages)
    if pages < 1:
        raise RenderError("PDF has no pages")
    if pages > max_pages:
        raise RenderError(f"PDF has {pages} pages (max {max_pages})")
    text = squash("\n".join(p.extract_text() or "" for p in reader.pages))
    missing = [m for m in must_contain if m and squash(m) not in text]
    if missing:
        raise RenderError(f"PDF text check failed; missing: {missing}")
    warnings = []
    if one_page and pages > 1:
        warnings.append(f"one-page template overflowed to {pages} pages")
    return CheckResult(pages=pages, size=len(pdf), warnings=warnings)
