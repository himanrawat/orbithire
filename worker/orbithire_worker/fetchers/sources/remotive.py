"""Remotive (https://remotive.com/api-documentation) - remote jobs, no key.

GET https://remotive.com/api/remote-jobs?search=<kw>&limit=<n>
ToS: link back to the Remotive URL and mention Remotive as the source (we keep
its job URL and source "remotive"); jobs are delayed 24h; call at most ~4x/day,
so only the first 2 keywords are queried per run.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import html_to_text, parse_iso, parse_salary_text
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, remote_eligible, run_queries

URL = "https://remotive.com/api/remote-jobs"
MAX_KEYWORDS = 2


def map_remotive(job: dict[str, Any]) -> NormalizedPosting:
    req = (job.get("candidate_required_location") or "").strip()
    smin, smax, cur = parse_salary_text(job.get("salary"))
    return NormalizedPosting(
        source="remotive",
        external_id=str(job.get("id")),
        url=job.get("url") or "",
        title=(job.get("title") or "").strip(),
        company=(job.get("company_name") or "Unknown").strip(),
        location=f"Remote ({req})" if req else "Remote",
        is_remote=True,
        salary_min=smin,
        salary_max=smax,
        currency=cur if (smin or smax) else None,
        description=html_to_text(job.get("description")) or None,
        posted_at=parse_iso(job.get("publication_date")),
        raw=compact_raw(job),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    async def one(kw: str, _loc: str | None):
        data = await request(client, "GET", URL, params={"search": kw, "limit": q.per_query})
        jobs = data.get("jobs") or []
        mapped = [
            map_remotive(j) for j in jobs
            if j.get("title") and remote_eligible(j.get("candidate_required_location"), q.country)
        ]
        return recent(mapped, q), len(jobs)

    return await run_queries(q.pairs(with_location=False, limit=MAX_KEYWORDS), one)


SOURCE = SourceDef(id="remotive", label="Remotive", fetch=fetch, remote_only=True)
