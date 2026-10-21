"""SEEK (Australia: seek.com.au, New Zealand: seek.co.nz) - Tier 3 scraper, SHIPPED BLOCKED.

Checked 2026-10 with plain HTTP and an honest User-Agent:
* robots.txt (served from au.seek.com / nz.seek.com) disallows /api/jobsearch/,
  /graphql, */job/ and query strings except ?keywords, so the JSON search API
  the site uses is off limits;
* the allowed path-based listing pages (/<keyword>-jobs[/in-<Location>]) answer
  HTTP 403 with a Cloudflare "Just a moment..." JavaScript challenge.

Both hosts need a real browser, which OrbitHire deliberately does not use (no
headless browser, no bot-protection evasion). The source is therefore registered
with `blocked`, which makes fetch_api_sources skip it with that reason without any
request. `fetch` is kept as a polite probe (robots.txt + one listing page) so
live_smoke_scrapers.py can re-check; if SEEK ever serves the page to plain HTTP,
a listing parser has to be written and `blocked` removed.
"""

from __future__ import annotations

import httpx

from ._scraper import SCRAPER_TIMEOUT, ScraperSession, run_scraper, slugify
from .base import SourceDef, SourceOutput, SourceQuery

HOSTS = {"AU": "https://www.seek.com.au", "NZ": "https://www.seek.co.nz"}
BLOCKED = "blocked: requires browser (SEEK serves a Cloudflare JS challenge to plain HTTP; its search API is disallowed by robots.txt)"


def listing_path(keyword: str, location: str | None) -> str:
    path = f"/{slugify(keyword)}-jobs"
    if location:
        path += "/in-" + "-".join(w.capitalize() for w in slugify(location).split("-"))
    return path


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    """Probe only (see module docstring): raises ScraperBlocked on the challenge."""
    base = HOSTS.get(q.country.code, HOSTS["AU"])
    session = ScraperSession(client, base, label="SEEK")
    kw, loc = (q.pairs(limit=1) or [(q.keywords[0] if q.keywords else "developer", None)])[0]

    async def one(s: ScraperSession, path: str):
        await s.get(path)
        return [], 0  # page served without a challenge: parser not implemented

    out = await run_scraper(session, [listing_path(kw, loc)], one)
    if not out.skipped:
        out.errors.append("SEEK served the listing without a challenge; a parser is not implemented yet")
    return out


SOURCE = SourceDef(
    id="seek", label="SEEK", fetch=fetch, countries=frozenset({"AU", "NZ"}),
    scraper=True, blocked=BLOCKED, timeout=SCRAPER_TIMEOUT,
)
