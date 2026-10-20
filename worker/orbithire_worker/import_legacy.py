"""One-time import of the old ai-job-search workflow for one OrbitHire user.

    # applications from the tracker CSV
    uv run python -m orbithire_worker.import_legacy tracker \\
        --user-email you@example.com --path ~/Desktop/ai-job-search/job_search_tracker.csv [--dry-run]

    # existing PDFs (cv/*.pdf -> resumes, cover_letters/*.pdf -> cover letters)
    uv run python -m orbithire_worker.import_legacy pdfs \\
        --user-email you@example.com --path ~/Desktop/ai-job-search [--dry-run] [--include-examples]

Same rules as the portal's Settings -> Import (lib/import/tracker.ts and
lib/import/filenames.ts); keep both in sync. Re-running is idempotent:
applications dedupe on (company, job title) per user, PDFs on their storage key
({user}/{resumes|cover-letters}/import-<file>.pdf). Imports run the tracker
first so PDFs can be matched to the applications it created.

Profile merge (CLAUDE.md) is only in the portal, because it needs a per-field
review of current vs proposed values.

PDF storage uses the R2_* settings. For tests point them at MinIO
(R2_ENDPOINT=http://127.0.0.1:9000 ...), never at the production bucket.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

IMPORT_MARKER = "Imported from job_search_tracker.csv"

STATUS_MAP = {
    "drafted": "saved",
    "draft": "saved",
    "saved": "saved",
    "applied": "applied",
    "submitted": "applied",
    "interview": "interviewing",
    "interviewing": "interviewing",
    "interview_only": "interviewing",
    "offer": "offered",
    "offered": "offered",
    "hired": "offered",
    "rejected": "rejected",
    "no_response": "rejected",
    "offer_declined": "withdrawn",
    "withdrawn": "withdrawn",
}
STATUS_RANK = {"saved": 0, "applied": 1, "interviewing": 2, "offered": 3, "rejected": 4, "withdrawn": 4}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://", re.I)


# --------------------------------------------------------------------------- tracker


def map_status(raw: str | None) -> tuple[str, bool]:
    key = re.sub(r"[\s-]+", "_", (raw or "").strip().lower())
    status = STATUS_MAP.get(key)
    return (status, True) if status else ("saved", False)


def map_row(row: dict[str, str]) -> dict[str, Any] | None:
    get = lambda k: (row.get(k) or "").strip()  # noqa: E731
    name = get("company")
    if not name:
        return None
    tracker_status = get("status")
    status, known = map_status(tracker_status)
    date = get("date")
    fit_raw = get("fit_rating")
    try:
        fit: float | int | None = float(fit_raw) if fit_raw else None
        if fit is not None and fit.is_integer():
            fit = int(fit)
    except ValueError:
        fit = None
    source = get("source")

    lines = [IMPORT_MARKER]
    if fit is not None:
        lines.append(f"Fit rating: {fit}")
    if tracker_status:
        lines.append(f"Tracker status: {tracker_status}" + ("" if known else " (unrecognised, imported as saved)"))
    if date:
        lines.append(f"Tracked on: {date}")
    for col, label in (("role_type", "Role type"), ("channel", "Channel"), ("deadline", "Deadline")):
        if get(col):
            lines.append(f"{label}: {get(col)}")
    if source and not URL_RE.match(source):
        lines.append(f"Source: {source}")
    if get("cv_file"):
        lines.append(f"CV file: {get('cv_file')}")
    if get("cover_letter_file"):
        lines.append(f"Cover letter file: {get('cover_letter_file')}")
    notes = get("notes")
    return {
        "name": name,
        "job_title": get("role") or None,
        "job_url": source if source and URL_RE.match(source) else None,
        "industry": get("sector") or None,
        "recruiter_name": get("contact_person") or None,
        "status": status,
        "applied_at": f"{date}T00:00:00.000Z" if status != "saved" and DATE_RE.match(date) else None,
        "notes": "\n".join(lines) + (f"\n\n{notes}" if notes else ""),
        "fit_rating": fit,
        "tracker_status": tracker_status,
    }


def parse_tracker(text: str) -> list[dict[str, str]]:
    reader = csv.reader(io.StringIO(text.lstrip("﻿")))
    rows = [r for r in reader if any(v.strip() for v in r)]
    if not rows:
        return []
    header = [h.strip().lower() for h in rows[0]]
    return [{h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(header) if h} for r in rows[1:]]


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def dedupe_key(name: str, job_title: str | None) -> str:
    return f"{_norm(name)}|{_norm(job_title)}"


COMPANY_FIELDS = ("name", "job_title", "job_url", "industry", "recruiter_name", "status", "applied_at", "notes")


def plan_tracker(text: str, existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror of planTrackerImport() in lib/import/tracker.ts."""
    by_key = {dedupe_key(c["name"], c.get("job_title")): c for c in existing}
    seen: set[str] = set()
    plan: list[dict[str, Any]] = []
    for index, row in enumerate(parse_tracker(text)):
        mapped = map_row(row)
        if mapped is None:
            continue
        key = dedupe_key(mapped["name"], mapped["job_title"])
        if key in seen:
            plan.append({"index": index, "action": "skip", "reason": "Duplicate row in the CSV", "mapped": mapped, "existing_id": None, "changes": {}})
            continue
        seen.add(key)
        cur = by_key.get(key)
        if cur is None:
            plan.append({
                "index": index,
                "action": "create",
                "reason": "New application",
                "mapped": mapped,
                "existing_id": None,
                "changes": {k: mapped[k] for k in COMPANY_FIELDS},
            })
            continue
        patch: dict[str, Any] = {}
        for f in ("job_url", "industry", "recruiter_name", "applied_at"):
            if not cur.get(f) and mapped[f]:
                patch[f] = mapped[f]
        cur_status = cur.get("status") or "saved"
        if STATUS_RANK.get(mapped["status"], 0) > STATUS_RANK.get(cur_status, 0):
            patch["status"] = mapped["status"]
        if IMPORT_MARKER not in (cur.get("notes") or ""):
            patch["notes"] = f"{cur['notes']}\n\n{mapped['notes']}" if cur.get("notes") else mapped["notes"]
        plan.append({
            "index": index,
            "action": "update" if patch else "skip",
            "reason": f"Fill in: {', '.join(patch)}" if patch else "Already imported, nothing to change",
            "mapped": mapped,
            "existing_id": str(cur["id"]),
            "changes": patch,
        })
    return plan


def summarize(plan: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(plan),
        "create": sum(p["action"] == "create" for p in plan),
        "update": sum(p["action"] == "update" for p in plan),
        "skip": sum(p["action"] == "skip" for p in plan),
    }


# --------------------------------------------------------------------------- PDFs

RESUME_PREFIXES = ("main_", "cv_", "resume_")
COVER_PREFIXES = ("cover_letter_", "cover_", "cl_")
CONF_RANK = {"tracker": 4, "exact": 3, "role": 2, "company": 1, "none": 0}


def _compact(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _tokens(s: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t]


def _basename(p: str) -> str:
    return re.split(r"[\\/]", p)[-1]


def parse_pdf_filename(filename: str) -> tuple[str, str]:
    lower = re.sub(r"\.pdf$", "", _basename(filename), flags=re.I).lower()
    for p in COVER_PREFIXES:
        if lower.startswith(p):
            return "cover_letter", lower[len(p):]
    for p in RESUME_PREFIXES:
        if lower.startswith(p):
            return "resume", lower[len(p):]
    return ("cover_letter" if "cover" in lower else "resume"), lower


def _role_tokens_after_company(slug: str, company: str) -> list[str] | None:
    cn = _compact(company)
    if len(cn) < 2:
        return None
    toks = _tokens(slug)
    acc = ""
    for i, t in enumerate(toks):
        acc += t
        if acc == cn:
            return toks[i + 1:]
        if not cn.startswith(acc):
            return None
    return None


def _tracker_references(notes: str | None, filename: str) -> bool:
    if not notes:
        return False
    base = _basename(filename).lower()
    for line in notes.split("\n"):
        line = line.strip()
        if re.match(r"^(cv file|cover letter file):", line, re.I):
            if _basename(line.split(":", 1)[1].strip()).lower() == base:
                return True
    return False


def _jaccard(a: list[str], b: list[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    return len(sa & sb) / len(sa | sb)


def _title_case(s: str) -> str:
    return " ".join(t[:1].upper() + t[1:] for t in _tokens(s))


def match_filename(filename: str, companies: list[dict[str, Any]]) -> dict[str, Any]:
    """Mirror of matchPdfFilename() in lib/import/filenames.ts."""
    kind, slug = parse_pdf_filename(filename)
    kind_label = "CV" if kind == "resume" else "Cover letter"
    best: tuple[dict[str, Any], str, float] | None = None
    for c in companies:
        if _tracker_references(c.get("notes"), filename):
            conf, score = "tracker", 1.0
        else:
            role = _role_tokens_after_company(slug, c["name"])
            if role is None:
                continue
            title_toks = _tokens(c.get("job_title") or "")
            score = _jaccard(role, title_toks)
            if title_toks and _compact("".join(role)) == _compact(c.get("job_title") or ""):
                conf = "exact"
            elif score >= 0.5:
                conf = "role"
            else:
                conf = "company"
        if best is None or CONF_RANK[conf] > CONF_RANK[best[1]] or (CONF_RANK[conf] == CONF_RANK[best[1]] and score > best[2]):
            best = (c, conf, score)
    toks = _tokens(slug)
    suggest_skip = "example" in toks or "template" in toks
    base = _basename(filename)
    if best is None:
        return {
            "filename": base, "kind": kind, "slug": slug, "company_id": None, "company_label": None,
            "confidence": "none", "title": f"{kind_label} – {_title_case(slug) or base} (imported)", "suggest_skip": suggest_skip,
        }
    c = best[0]
    label = f"{c['name']} – {c['job_title']}" if c.get("job_title") else c["name"]
    return {
        "filename": base, "kind": kind, "slug": slug, "company_id": str(c["id"]), "company_label": label,
        "confidence": best[1], "title": f"{kind_label} – {label} (imported)", "suggest_skip": suggest_skip,
    }


def import_file_key(user_id: str, kind: str, filename: str) -> str:
    """Mirror of importFileKey() in lib/import/filenames.ts."""
    stem = re.sub(r"\.pdf$", "", _basename(filename), flags=re.I).lower()
    stem = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")[:80]
    folder = "resumes" if kind == "resume" else "cover-letters"
    return f"{user_id}/{folder}/import-{stem or 'file'}.pdf"


def find_pdfs(path: Path) -> list[Path]:
    """An ai-job-search root (cv/, cover_letters/), a folder of PDFs, or one PDF."""
    if path.is_file():
        return [path]
    found: list[Path] = []
    subdirs = [path / "cv", path / "cover_letters"]
    roots = [d for d in subdirs if d.is_dir()] or [path]
    for d in roots:
        found.extend(sorted(p for p in d.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"))
    return found


def pdf_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    except Exception:  # noqa: BLE001 - text is a convenience only
        return ""


# --------------------------------------------------------------------------- DB


@dataclass
class Ctx:
    conn: Any
    user_id: str
    out: dict[str, Any] = field(default_factory=dict)


def _user_id(conn: Any, email: str) -> str:
    row = conn.execute("SELECT id FROM profiles WHERE lower(email) = lower(%s) LIMIT 1", (email,)).fetchone()
    if row is None:
        row = conn.execute("SELECT id FROM auth.users WHERE lower(email) = lower(%s) LIMIT 1", (email,)).fetchone()
    if row is None:
        raise SystemExit(f"no user with email {email!r}")
    return str(row[0])


def _companies(conn: Any, user_id: str) -> list[dict[str, Any]]:
    cur = conn.execute(
        "SELECT id, name, job_title, status, notes, job_url, industry, recruiter_name, applied_at "
        "FROM companies WHERE user_id = %s ORDER BY created_at",
        (user_id,),
    )
    cols = [d.name for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def run_tracker(conn: Any, user_id: str, csv_path: Path, dry_run: bool) -> dict[str, Any]:
    text = csv_path.read_text(encoding="utf-8")
    plan = plan_tracker(text, _companies(conn, user_id))
    rows = [
        {
            "action": p["action"],
            "company": p["mapped"]["name"],
            "job_title": p["mapped"]["job_title"],
            "status": f"{p['mapped']['tracker_status'] or '-'} -> {p['mapped']['status']}",
            "fit": p["mapped"]["fit_rating"],
            "reason": p["reason"],
        }
        for p in plan
    ]
    result: dict[str, Any] = {"dry_run": dry_run, "summary": summarize(plan), "rows": rows}
    if dry_run:
        return result
    created = updated = 0
    with conn.transaction():
        for p in plan:
            if p["action"] == "create":
                ch = p["changes"]
                conn.execute(
                    "INSERT INTO companies (user_id, name, job_title, job_url, industry, recruiter_name, status, applied_at, notes) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                    (user_id, ch["name"], ch["job_title"], ch["job_url"], ch["industry"], ch["recruiter_name"], ch["status"], ch["applied_at"], ch["notes"]),
                )
                created += 1
            elif p["action"] == "update":
                ch = p["changes"]
                sets = ", ".join(f"{k} = %s" for k in ch)
                conn.execute(
                    f"UPDATE companies SET {sets}, updated_at = now() WHERE id = %s AND user_id = %s",  # noqa: S608 - keys are fixed column names
                    (*ch.values(), p["existing_id"], user_id),
                )
                updated += 1
    result.update({"created": created, "updated": updated, "skipped": len(plan) - created - updated})
    return result


def run_pdfs(conn: Any, user_id: str, path: Path, dry_run: bool, include_examples: bool, r2: Any = None) -> dict[str, Any]:
    companies = _companies(conn, user_id)
    existing = {
        r[0]
        for table in ("resumes", "cover_letters")
        for r in conn.execute(f"SELECT pdf_key FROM {table} WHERE user_id = %s AND source = 'import'", (user_id,)).fetchall()  # noqa: S608
        if r[0]
    }
    files = find_pdfs(path)
    plan = []
    for f in files:
        m = match_filename(f.name, companies)
        key = import_file_key(user_id, m["kind"], f.name)
        if key in existing:
            action, reason = "skip", "already imported"
        elif m["suggest_skip"] and not include_examples:
            action, reason = "skip", "example/template file (use --include-examples)"
        else:
            action, reason = "import", "attach" if m["company_id"] else "unattached"
        plan.append({**m, "path": str(f), "key": key, "action": action, "reason": reason})

    summary = {
        "files": len(plan),
        "import": sum(p["action"] == "import" for p in plan),
        "skip": sum(p["action"] == "skip" for p in plan),
        "matched": sum(p["action"] == "import" and bool(p["company_id"]) for p in plan),
        "unattached": sum(p["action"] == "import" and not p["company_id"] for p in plan),
        "by_confidence": {
            c: sum(p["action"] == "import" and p["confidence"] == c for p in plan) for c in CONF_RANK if any(p["confidence"] == c for p in plan)
        },
    }
    rows = [
        {k: p[k] for k in ("filename", "kind", "action", "reason", "confidence", "company_label", "title")} for p in plan
    ]
    result: dict[str, Any] = {"dry_run": dry_run, "summary": summary, "rows": rows}
    if dry_run:
        return result

    if r2 is None:
        from .r2 import get_r2

        r2 = get_r2()
    imported = 0
    errors: list[str] = []
    for p in plan:
        if p["action"] != "import":
            continue
        data = Path(p["path"]).read_bytes()
        if not data.startswith(b"%PDF-"):
            errors.append(f"{p['filename']}: not a PDF")
            continue
        try:
            r2.put(p["key"], data, "application/pdf")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{p['filename']}: upload failed: {exc}")
            continue
        text = pdf_text(data)
        url = f"/api/files/{p['key']}"
        if p["kind"] == "resume":
            conn.execute(
                "INSERT INTO resumes (user_id, company_id, title, content_json, content_text, pdf_url, pdf_key, pdf_status, source, source_client) "
                "VALUES (%s, %s, %s, '{}'::jsonb, %s, %s, %s, 'ready', 'import', 'ai-job-search')",
                (user_id, p["company_id"], p["title"][:200], text or None, url, p["key"]),
            )
        else:
            conn.execute(
                "INSERT INTO cover_letters (user_id, company_id, title, content, pdf_url, pdf_key, pdf_status, source, source_client) "
                "VALUES (%s, %s, %s, %s, %s, %s, 'ready', 'import', 'ai-job-search')",
                (user_id, p["company_id"], p["title"][:200], text, url, p["key"]),
            )
        imported += 1
    result.update({"imported": imported, "errors": errors})
    return result


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, help_ in (("tracker", "job_search_tracker.csv -> applications"), ("pdfs", "cv/ + cover_letters/ PDFs -> documents")):
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("--user-email", required=True)
        sp.add_argument("--path", required=True, help="CSV file (tracker) or ai-job-search folder / PDF folder (pdfs)")
        sp.add_argument("--database-url", help="defaults to DATABASE_URL / settings")
        sp.add_argument("--dry-run", action="store_true", help="show what would happen, write nothing")
        if name == "pdfs":
            sp.add_argument("--include-examples", action="store_true", help="also import main_example.pdf etc.")
    args = p.parse_args(argv)

    import psycopg

    from .settings import get_settings

    url = args.database_url or get_settings().database_url
    path = Path(args.path).expanduser()
    if not path.exists():
        raise SystemExit(f"not found: {path}")
    with psycopg.connect(url, autocommit=True) as conn:
        user_id = _user_id(conn, args.user_email)
        if args.cmd == "tracker":
            out = run_tracker(conn, user_id, path, args.dry_run)
        else:
            out = run_pdfs(conn, user_id, path, args.dry_run, args.include_examples)
    out = {"user_id": user_id, **out}
    json.dump(out, sys.stdout, indent=2, default=str, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
