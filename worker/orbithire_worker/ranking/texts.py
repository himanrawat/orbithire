"""Text built from postings and the user's profile, for embeddings and the LLM prompt."""

from __future__ import annotations

import hashlib
import html
import json
import re
from typing import Any

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"[ \t\r\f\v]+")
_NL = re.compile(r"\n{3,}")


def clean(text: str | None) -> str:
    if not text:
        return ""
    t = html.unescape(_TAG.sub(" ", text))
    t = _WS.sub(" ", t)
    return _NL.sub("\n\n", t).strip()


def posting_text(p: dict[str, Any], max_chars: int) -> str:
    head = " | ".join(x for x in (p.get("title"), p.get("company"), p.get("location")) if x)
    if p.get("is_remote"):
        head += " | Remote"
    body = clean(p.get("description"))
    return (head + "\n\n" + body)[:max_chars].strip()


def _as_list(v: Any) -> list[Any]:
    if v is None:
        return []
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return [v]
    return v if isinstance(v, list) else [v]


def _extended(profile: dict[str, Any]) -> dict[str, Any]:
    raw = profile.get("extended_profile")
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except ValueError:
        return {}


def _resume_summary(content: dict[str, Any] | None) -> list[str]:
    """Pull the useful bits out of a JSON Resume (resumes.content_json)."""
    if not isinstance(content, dict):
        return []
    lines: list[str] = []
    basics = content.get("basics") or {}
    if isinstance(basics, dict):
        if basics.get("label"):
            lines.append(f"Headline: {basics['label']}")
        if basics.get("summary"):
            lines.append(f"Summary: {basics['summary']}")
    for w in _as_list(content.get("work"))[:8]:
        if not isinstance(w, dict):
            continue
        role = " at ".join(x for x in (w.get("position"), w.get("name") or w.get("company")) if x)
        dates = "–".join(x for x in (w.get("startDate"), w.get("endDate") or "present") if x)
        lines.append(f"- {role} ({dates})" if role else "")
        for h in _as_list(w.get("highlights"))[:4]:
            if isinstance(h, str):
                lines.append(f"  • {h}")
    skills = []
    for s in _as_list(content.get("skills")):
        if isinstance(s, dict):
            skills.append(s.get("name") or "")
            skills.extend(k for k in _as_list(s.get("keywords")) if isinstance(k, str))
        elif isinstance(s, str):
            skills.append(s)
    if skills:
        lines.append("Skills: " + ", ".join(x for x in skills if x))
    for e in _as_list(content.get("education"))[:3]:
        if isinstance(e, dict):
            lines.append("Education: " + ", ".join(
                x for x in (e.get("studyType"), e.get("area"), e.get("institution")) if x))
    return [x for x in lines if x]


def profile_text(profile: dict[str, Any], resume: dict[str, Any] | None = None, max_chars: int = 8000) -> str:
    """Deterministic profile text (so its hash only changes when the profile does)."""
    lines: list[str] = []
    if profile.get("headline"):
        lines.append(f"Headline: {profile['headline']}")
    if profile.get("target_job_titles"):
        lines.append("Target roles: " + ", ".join(profile["target_job_titles"]))
    if profile.get("skills"):
        lines.append("Skills: " + ", ".join(profile["skills"]))
    if profile.get("experience_summary"):
        lines.append("Experience: " + clean(profile["experience_summary"]))
    ext = _extended(profile)
    for w in _as_list(ext.get("work_experience"))[:8]:
        if isinstance(w, dict):
            role = " at ".join(x for x in (w.get("title") or w.get("position"), w.get("company")) if x)
            desc = clean(str(w.get("description") or ""))[:400]
            lines.append(f"- {role}: {desc}" if desc else f"- {role}")
    for e in _as_list(ext.get("education"))[:3]:
        if isinstance(e, dict):
            lines.append("Education: " + ", ".join(
                str(x) for x in (e.get("degree"), e.get("field"), e.get("school") or e.get("institution")) if x))
    if profile.get("location"):
        lines.append(f"Based in: {profile['location']}")
    if profile.get("preferred_locations"):
        lines.append("Preferred locations: " + ", ".join(profile["preferred_locations"]))
    if profile.get("work_type"):
        lines.append(f"Work type: {profile['work_type']}")
    if resume:
        rs = _resume_summary(resume.get("content_json"))
        if rs:
            lines.append("")
            lines.append(f"Latest resume ({resume.get('title') or 'untitled'}):")
            lines.extend(rs)
        elif resume.get("content_text"):
            lines.append("")
            lines.append("Latest resume: " + clean(resume["content_text"]))
    return "\n".join(lines)[:max_chars].strip()


def text_hash(model: str, text: str) -> str:
    return hashlib.sha256(f"{model}\n{text}".encode("utf-8")).hexdigest()


def vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.7g}" for x in vec) + "]"
