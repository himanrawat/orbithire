"""Arbeitnow (https://www.arbeitnow.com/blog/job-board-api) - DE + UK, no key.

GET https://www.arbeitnow.com/api/job-board-api?page=N   (Germany / EU)
GET https://www.arbeitnow.co.uk/api/job-board-api?page=N (United Kingdom)
A feed (300 jobs/page, newest first, no search params): keywords and the date
window are applied locally. ToS: link back to Arbeitnow (we store its job URL
and source "arbeitnow").
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import from_epoch, html_to_text, is_remote_text, keyword_hit
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent

URLS = {"DE": "https://www.arbeitnow.com/api/job-board-api", "GB": "https://www.arbeitnow.co.uk/api/job-board-api"}
MAX_PAGES = 2


def map_arbeitnow(job: dict[str, Any]) -> NormalizedPosting:
    loc = (job.get("location") or "").strip() or None
    remote = bool(job.get("remote"))
    return NormalizedPosting(
        source="arbeitnow",
        external_id=job.get("slug"),
        url=job.get("url") or "",
        title=(job.get("title") or "").strip(),
        company=(job.get("company_name") or "Unknown").strip(),
        location=loc or ("Remote" if remote else None),
        is_remote=remote or is_remote_text(loc),
        description=html_to_text(job.get("description")) or None,
        posted_at=from_epoch(job.get("created_at")),
        raw=compact_raw(job),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    url = URLS.get(q.country.code, URLS["DE"])
    out = SourceOutput()
    cut = q.cutoff()
    cities = [c.lower() for c in q.cities() if c]
    for page in range(1, MAX_PAGES + 1):
        data = await request(client, "GET", url, params={"page": page})
        jobs = data.get("data") or []
        out.raw_count += len(jobs)
        for j in jobs:
            text = f"{j.get('title') or ''} {' '.join(j.get('tags') or [])}"
            if not j.get("title") or not keyword_hit(text, q.keywords):
                continue
            p = map_arbeitnow(j)
            if cities and not p.is_remote and not any(c in (p.location or "").lower() for c in cities):
                continue
            out.postings.append(p)
        oldest = from_epoch(jobs[-1].get("created_at")) if jobs else None
        if not (data.get("links") or {}).get("next") or (oldest and oldest < cut):
            break
    out.postings = recent(out.postings, q)
    return out


SOURCE = SourceDef(
    id="arbeitnow", label="Arbeitnow", fetch=fetch,
    countries=frozenset(URLS),
)
