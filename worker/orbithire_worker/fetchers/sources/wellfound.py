"""Wellfound (ex AngelList Talent) - startup jobs, any country. Tier 3 scraper (opt-in).

No public API. The logged-out SEO landing pages are server-rendered Next.js pages
whose __NEXT_DATA__ carries the Apollo cache with up to 20 startups and their
highlighted job listings (title, locations, remote, compensation, liveStartAt,
full markdown description):

    /role/l/<role>/<location>   e.g. /role/l/software-engineer/india
    /role/r/<role>              remote jobs for a role

(verified 2026-10 with plain HTTP; robots.txt disallows /search, /jobs/applications
and several ?query patterns, not these paths). An unknown role slug redirects to a
generic page, in which case results are filtered locally by keyword.
"""

from __future__ import annotations

import re
from typing import Any

import httpx

from ..common import from_epoch, keyword_hit, parse_salary_text
from ..models import NormalizedPosting
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
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, remote_eligible

BASE = "https://wellfound.com"

_CITY_ALIASES = {"bengaluru": "bangalore", "gurugram": "gurgaon", "bombay": "mumbai", "new-delhi": "delhi"}


def role_slug(keyword: str) -> str:
    """'Senior Frontend Developer' -> 'frontend-engineer' (Wellfound's role slugs)."""
    text = keyword.lower()
    for a, b in (("front end", "frontend"), ("front-end", "frontend"), ("back end", "backend"),
                 ("back-end", "backend"), ("fullstack", "full stack")):
        text = text.replace(a, b)
    words = strip_seniority(re.findall(r"[a-z0-9]+", text))
    words = ["engineer" if w in ("developer", "dev", "programmer") else w for w in words]
    return "-".join(words)


def location_slug(location: str | None, country_name: str) -> str:
    slug = slugify(location or country_name)
    return _CITY_ALIASES.get(slug, slug)


def _is_remote_location(loc: str | None) -> bool:
    return bool(loc) and loc.strip().lower() in ("remote", "anywhere", "worldwide")


def plan(q: SourceQuery) -> list[tuple[str, str, str]]:
    """[(path, keyword, kind)] - kind 'location' or 'remote'; at most MAX_SCRAPER_QUERIES."""
    out: list[tuple[str, str, str]] = []
    for kw, loc in q.pairs(limit=MAX_SCRAPER_QUERIES * 2):
        role = role_slug(kw)
        if not role:
            continue
        if _is_remote_location(loc):
            item = (f"/role/r/{role}", kw, "remote")
        else:
            item = (f"/role/l/{role}/{location_slug(loc, q.country.name)}", kw, "location")
        if item not in out:
            out.append(item)
    if q.remote_ok and len(out) < MAX_SCRAPER_QUERIES and out:
        remote = (f"/role/r/{role_slug(out[0][1])}", out[0][1], "remote")
        if remote not in out:
            out.append(remote)
    return out[:MAX_SCRAPER_QUERIES]


def _salary(comp: str | None) -> tuple[float | None, float | None, str | None]:
    # "₹10L – ₹20L • 0.05% – 0.1%" / "$114k – $148k" / "₹12L – ₹16L • No equity"
    text = (comp or "").split("•", 1)[0].strip()
    return parse_salary_text(text) if text else (None, None, None)


def map_wellfound(job: dict[str, Any], startup: dict[str, Any]) -> NormalizedPosting:
    jid = str(job.get("id") or "")
    slug = job.get("slug") or slugify(job.get("title") or "")
    locations = list(dict.fromkeys(x for x in (job.get("locationNames") or []) if x))
    rc = job.get("remoteConfig") or {}
    is_remote = bool(job.get("remote")) and (rc.get("kind") in (None, "REMOTE"))
    location = ", ".join(locations) or ("Remote" if is_remote else None)
    if is_remote and location and "remote" not in location.lower():
        location = f"{location} (Remote)"
    smin, smax, cur = _salary(job.get("compensation"))
    raw = compact_raw(job, ("description", "__typename", "isBookmarked"))
    raw["startup"] = {k: startup.get(k) for k in ("id", "name", "slug", "companySize", "highConcept")}
    return NormalizedPosting(
        source="wellfound",
        external_id=jid or None,
        url=f"{BASE}/jobs/{jid}-{slug}",
        title=(job.get("title") or "").strip(),
        company=(startup.get("name") or "Unknown").strip(),
        location=location,
        is_remote=is_remote,
        salary_min=smin,
        salary_max=smax,
        currency=cur if (smin or smax) else None,
        description=(job.get("description") or "").strip() or None,
        posted_at=from_epoch(job.get("liveStartAt")),
        raw=raw,
    )


def parse_page(html: str) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], dict[str, Any]]:
    """[(job, startup)] from a landing page, plus the page's Next.js `query`."""
    nd = next_data(html)
    if nd is None:
        raise ScraperError("no __NEXT_DATA__ on the page (layout changed?)")
    props = (nd.get("props") or {}).get("pageProps") or {}
    data = ((props.get("apolloState") or {}).get("data")) or {}
    talent = ((data.get("ROOT_QUERY") or {}).get("talent")) or {}
    results = next((v for k, v in talent.items() if k.startswith("seoLandingPageJobSearchResults")), None)
    if not isinstance(results, dict):
        raise ScraperError("no job search results in the page data (layout changed?)")
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for ref in results.get("startups") or []:
        startup = data.get((ref or {}).get("__ref") or "") or {}
        for jref in startup.get("highlightedJobListings") or []:
            job = data.get((jref or {}).get("__ref") or "")
            if isinstance(job, dict) and job.get("id") and job.get("title"):
                pairs.append((job, startup))
    return pairs, nd.get("query") or {}


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    session = ScraperSession(client, BASE, label="Wellfound")
    limit = min(q.results_wanted, MAX_SCRAPER_RESULTS)

    async def one(s: ScraperSession, item: tuple[str, str, str]):
        path, kw, kind = item
        html = await s.get(path)
        pairs, query = parse_page(html)
        honoured = query.get("role") == path.split("/")[3]
        kept: list[NormalizedPosting] = []
        for job, startup in pairs:
            text = f"{job.get('title') or ''} {job.get('primaryRoleTitle') or ''}"
            if not honoured and not keyword_hit(text, [kw, path.split("/")[3].replace("-", " ")]):
                continue
            if kind == "remote" and not remote_eligible(", ".join(job.get("acceptedRemoteLocationNames") or []), q.country):
                continue
            kept.append(map_wellfound(job, startup))
        return kept[:limit], len(pairs)

    return await run_scraper(session, plan(q), one, describe=lambda it: it[0])


SOURCE = SourceDef(
    id="wellfound", label="Wellfound", fetch=fetch, scraper=True, timeout=SCRAPER_TIMEOUT,
)
