"""Himalayas (https://himalayas.app/docs/remote-jobs-api) - remote jobs, no key.

GET https://himalayas.app/jobs/api/search?q=<kw>&country=<name>&sort=recent&page=1
(20 per page). Attribution: apply via `applicationLink` and credit Himalayas
with a visible source link (we keep its URL and source "himalayas").
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import annual_factor, from_epoch, html_to_text, num, positive, scale
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, run_queries

URL = "https://himalayas.app/jobs/api/search"
MAX_KEYWORDS = 3


def map_himalayas(job: dict[str, Any]) -> NormalizedPosting:
    factor = annual_factor(job.get("salaryPeriod"))
    smin = scale(positive(num(job.get("minSalary"))), factor)
    smax = scale(positive(num(job.get("maxSalary"))), factor)
    restr = job.get("locationRestrictions") or []
    return NormalizedPosting(
        source="himalayas",
        external_id=job.get("guid") or job.get("applicationLink"),
        url=job.get("applicationLink") or job.get("guid") or "",
        title=(job.get("title") or "").strip(),
        company=(job.get("companyName") or "Unknown").strip(),
        location=(
            f"Remote ({', '.join(restr[:4])}{f' +{len(restr) - 4} more' if len(restr) > 4 else ''})"
            if restr else "Remote"
        ),
        is_remote=True,
        salary_min=smin,
        salary_max=smax,
        currency=(job.get("currency") or None) if (smin or smax) else None,
        description=html_to_text(job.get("description")) or job.get("excerpt") or None,
        posted_at=from_epoch(job.get("pubDate")),
        raw=compact_raw(job, ("description", "timezoneRestrictions")),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    async def one(kw: str, _loc: str | None):
        params = {"q": kw, "country": q.country.name, "sort": "recent", "page": 1}
        data = await request(client, "GET", URL, params=params)
        jobs = data.get("jobs") or []
        mapped = [map_himalayas(j) for j in jobs[: q.per_query] if j.get("title")]
        return recent(mapped, q), len(jobs)

    return await run_queries(q.pairs(with_location=False, limit=MAX_KEYWORDS), one)


SOURCE = SourceDef(id="himalayas", label="Himalayas", fetch=fetch, remote_only=True)
