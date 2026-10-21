"""Cutshort (India) - Tier 3 scraper (opt-in), India only.

No public job-seeker API (its REST/MCP API is for recruiters). The logged-out
listing pages listed in its sitemap are server-rendered Next.js pages whose
__NEXT_DATA__ (react-query dehydratedState, queryKey 'jobListData') carries up to
50 jobs with company, salary, locations, remote type, posted date and the HTML
description:

    /jobs/<skill-or-role>-jobs                e.g. /jobs/python-jobs
    /jobs/<skill-or-role>-jobs-in-<city>      e.g. /jobs/frontend-developer-jobs-in-pune

(verified 2026-10 with plain HTTP; robots.txt disallows /view/j/, /vj/, /apply/,
/profile/ and ?free_text / ?job_listing queries, not these paths). Slugs are
skill based ("reactjs", "python", "frontend-developer"); an unknown slug renders
an empty page and is reported for that query.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from ..common import html_to_text, num, parse_iso, parse_salary_text, positive
from ..models import NormalizedPosting, normalize_location
from ._scraper import (
    MAX_SCRAPER_QUERIES,
    MAX_SCRAPER_RESULTS,
    SCRAPER_TIMEOUT,
    ScraperError,
    ScraperSession,
    next_data,
    run_scraper,
    slugify,
    strip_seniority,
)
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw

BASE = "https://cutshort.io"

# Canonical city (normalize_location) -> Cutshort city slug (from its sitemap).
CITY_SLUGS = {
    "bangalore": "bangalore-bengaluru",
    "mumbai": "mumbai",
    "navi mumbai": "mumbai",
    "delhi": "delhi-ncr-gurgaon-noida",
    "gurgaon": "delhi-ncr-gurgaon-noida",
    "noida": "delhi-ncr-gurgaon-noida",
    "hyderabad": "hyderabad",
    "pune": "pune",
    "chennai": "chennai",
    "ahmedabad": "ahmedabad",
    "kolkata": "kolkata",
    "jaipur": "jaipur",
    "indore": "indore",
    "coimbatore": "coimbatore",
    "cochin": "kochi-cochin",
    "chandigarh": "chandigarh",
    "bhubaneswar": "bhubaneswar",
}

# Whole-keyword aliases (after seniority words are dropped).
_ROLE_SLUGS = {
    "frontend developer": "frontend-developer",
    "frontend engineer": "frontend-developer",
    "backend developer": "backend-developer",
    "backend engineer": "backend-developer",
    "fullstack developer": "fullstack-developer",
    "fullstack engineer": "fullstack-developer",
    "android developer": "android-developer",
    "android engineer": "android-developer",
    "ios developer": "ios-developer",
    "ios engineer": "ios-developer",
    "product manager": "product-manager",
    "ui designer": "ui-designer",
    "graphic designer": "graphic-designer",
    "data scientist": "datascience",
    "data science": "datascience",
    "data engineer": "data-engineering",
    "data analyst": "data-analytics",
    "machine learning": "machine-learning-ml",
    "machine learning engineer": "machine-learning-ml",
    "ml engineer": "machine-learning-ml",
    "devops engineer": "devops",
    "software engineer": "software-development",
    "software developer": "software-development",
}
_TECH = {
    "react": "reactjs", "react.js": "reactjs", "react js": "reactjs",
    "node": "nodejs", "node.js": "nodejs", "node js": "nodejs",
    "vue": "vuejs", "vue.js": "vuejs", "go": "golang",
}
_ROLE_WORDS = {"developer", "engineer", "programmer", "dev"}


def keyword_slug(keyword: str) -> str:
    text = keyword.lower().strip()
    for a, b in (("front end", "frontend"), ("front-end", "frontend"), ("back end", "backend"),
                 ("back-end", "backend"), ("full stack", "fullstack"), ("full-stack", "fullstack")):
        text = text.replace(a, b)
    words = strip_seniority(re.findall(r"[a-z0-9.+#]+", text))
    phrase = " ".join(words)
    if phrase in _ROLE_SLUGS:
        return _ROLE_SLUGS[phrase]
    core = [w for w in words if w not in _ROLE_WORDS] or words
    phrase = " ".join(core)
    if phrase in _TECH:
        return _TECH[phrase]
    return slugify(phrase.replace(".js", "js"))


def city_slug(location: str | None) -> str | None:
    if not location:
        return None
    return CITY_SLUGS.get(normalize_location(location))


def plan(q: SourceQuery) -> list[tuple[str, str, str | None]]:
    """[(path, keyword, city to filter locally when Cutshort has no city page)]."""
    out: list[tuple[str, str, str | None]] = []
    for kw, loc in q.pairs(limit=MAX_SCRAPER_QUERIES * 2):
        slug = keyword_slug(kw)
        if not slug:
            continue
        remote = bool(loc) and loc.strip().lower() in ("remote", "anywhere")
        cslug = None if remote else city_slug(loc)
        path = f"/jobs/{slug}-jobs" + (f"-in-{cslug}" if cslug else "")
        local = None if (cslug or remote or not loc) else loc
        item = (path, kw, local)
        if item not in out:
            out.append(item)
    return out[:MAX_SCRAPER_QUERIES]


def _salary(job: dict[str, Any]) -> tuple[float | None, float | None, str | None]:
    text = (job.get("jobFactSummary") or {}).get("salary") or job.get("salaryRangeText")
    smin, smax, cur = parse_salary_text(text, "INR")
    if smin or smax:
        return smin, smax, cur
    sr = job.get("salaryRange") or {}
    lo, hi = positive(num(sr.get("min"))), positive(num(sr.get("max")))
    return lo, hi, (sr.get("currency") or "INR") if (lo or hi) else None


def _is_remote(job: dict[str, Any]) -> bool:
    rt = str(job.get("remoteType") or "").lower()
    locs = " ".join(job.get("locations") or []).lower()
    return ("remote" in rt and "not" not in rt) or "remote" in locs


def map_cutshort(job: dict[str, Any]) -> NormalizedPosting:
    company = (job.get("companyDetails") or {}).get("name") or (job.get("companyId") or {}).get("name") or "Unknown"
    locs = [x for x in (job.get("locations") or []) if x]
    smin, smax, cur = _salary(job)
    remote = _is_remote(job)
    summary = job.get("jobFactSummary") or {}
    return NormalizedPosting(
        source="cutshort",
        external_id=job.get("_id"),
        url=job.get("publicUrl") or f"{BASE}/job/{job.get('_id')}",
        title=(job.get("headline") or summary.get("roleTitle") or "").strip(),
        company=company.strip(),
        location=", ".join(locs) or ("Remote" if remote else None),
        is_remote=remote,
        salary_min=smin,
        salary_max=smax,
        currency=cur,
        description=html_to_text(job.get("sanitizedComment")) or None,
        posted_at=parse_iso(summary.get("postedDate")),
        raw={
            **compact_raw(job, ("sanitizedComment", "companyDetails", "createdBy", "allSkillsObj", "relatedHubLinks")),
            "company": {k: (job.get("companyDetails") or {}).get(k) for k in ("_id", "name", "type", "size", "stage")},
        },
    )


def parse_page(html: str) -> list[dict[str, Any]] | None:
    """Jobs on a listing page; None when the slug has no listing page."""
    nd = next_data(html)
    if nd is None:
        raise ScraperError("no __NEXT_DATA__ on the page (layout changed?)")
    state = ((nd.get("props") or {}).get("pageProps") or {}).get("dehydratedState") or {}
    for query in state.get("queries") or []:
        if (query.get("queryKey") or [None])[0] != "jobListData":
            continue
        payload = ((query.get("state") or {}).get("data") or {}).get("data") or {}
        jobs = (payload.get("pageData") or {}).get("jobs")
        return [j for j in jobs if isinstance(j, dict) and j.get("headline")] if isinstance(jobs, list) else []
    return None


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    session = ScraperSession(client, BASE, label="Cutshort")
    limit = min(q.results_wanted, MAX_SCRAPER_RESULTS)

    async def one(s: ScraperSession, item: tuple[str, str, str | None]):
        path, kw, local_city = item
        jobs = parse_page(await s.get(path))
        if jobs is None:
            raise ScraperError(f"no Cutshort listing page for {kw!r} ({path})")
        raw = len(jobs)
        if local_city:
            want = normalize_location(local_city)
            jobs = [j for j in jobs if _is_remote(j) and q.remote_ok
                    or any(normalize_location(x) == want for x in j.get("locations") or [])]
        return [map_cutshort(j) for j in jobs[:limit]], raw

    return await run_scraper(session, plan(q), one, describe=lambda it: it[0])


SOURCE = SourceDef(
    id="cutshort", label="Cutshort", fetch=fetch, countries=frozenset({"IN"}),
    scraper=True, timeout=SCRAPER_TIMEOUT,
)
