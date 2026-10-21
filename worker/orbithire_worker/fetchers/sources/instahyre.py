"""Instahyre (India) - Tier 3 scraper (opt-in), India only.

No public API. The site's own job-search frontend reads a logged-out JSON endpoint:

    GET https://www.instahyre.com/api/v1/job_search?skills=<keyword>&offset=0
    -> {"meta": {...}, "objects": [{id, title, locations, public_url, keywords,
        employer: {company_name, ...}}, ...]}   (35 per page)

(verified 2026-10 with plain HTTP; robots.txt has no Disallow rules). The HTML
pages (search, job detail) sit behind a Cloudflare challenge, so there is no
description, salary or posting date: those stay empty. The endpoint ignores
location parameters, so cities are filtered locally.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..models import NormalizedPosting, normalize_location
from ._scraper import (
    MAX_SCRAPER_QUERIES,
    MAX_SCRAPER_RESULTS,
    SCRAPER_TIMEOUT,
    ScraperError,
    ScraperSession,
    run_scraper,
)
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw

BASE = "https://www.instahyre.com"
PATH = "/api/v1/job_search"
_WFH = ("work from home", "remote")


def _locations(job: dict[str, Any]) -> list[str]:
    return [x.strip() for x in str(job.get("locations") or "").split(",") if x.strip()]


def map_instahyre(job: dict[str, Any]) -> NormalizedPosting:
    locs = _locations(job)
    employer = job.get("employer") or {}
    jid = job.get("id")
    return NormalizedPosting(
        source="instahyre",
        external_id=str(jid) if jid is not None else None,
        url=job.get("public_url") or f"{BASE}/job-{jid}/",
        title=(job.get("title") or job.get("candidate_title") or "").strip(),
        company=(employer.get("company_name") or "Unknown").strip(),
        location=", ".join(locs) or None,
        is_remote=any(x.lower() in _WFH for x in locs),
        description=None,  # not in the listing; job pages need a browser
        raw={
            **compact_raw(job, ("employer", "resource_uri", "interview_status", "reviewed_at", "score", "is_strong_match", "gender")),
            "employer": {k: employer.get(k) for k in ("id", "company_name", "company_tagline", "employee_count")},
        },
    )


def location_ok(job: dict[str, Any], cities: list[str], remote_ok: bool) -> bool:
    if not cities:
        return True
    locs = _locations(job)
    if remote_ok and any(x.lower() in _WFH for x in locs):
        return True
    wanted = {normalize_location(c) for c in cities}
    return any(normalize_location(x) in wanted for x in locs)


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    session = ScraperSession(client, BASE, label="Instahyre")
    limit = min(q.results_wanted, MAX_SCRAPER_RESULTS)
    cities = [c for c in q.cities() if c and c.strip().lower() not in ("remote", "anywhere")]

    async def one(s: ScraperSession, kw: str):
        data = await s.get(PATH, {"skills": kw, "offset": 0}, expect="json")
        if not isinstance(data, dict) or not isinstance(data.get("objects"), list):
            raise ScraperError("unexpected payload (no 'objects')")
        jobs = [j for j in data["objects"] if isinstance(j, dict) and j.get("title")]
        kept = [map_instahyre(j) for j in jobs if location_ok(j, cities, q.remote_ok)]
        return kept[:limit], len(jobs)

    keywords = list(dict.fromkeys(k for k in q.keywords if k.strip()))[:MAX_SCRAPER_QUERIES]
    return await run_scraper(session, keywords, one)


SOURCE = SourceDef(
    id="instahyre", label="Instahyre", fetch=fetch, countries=frozenset({"IN"}),
    scraper=True, timeout=SCRAPER_TIMEOUT,
)
