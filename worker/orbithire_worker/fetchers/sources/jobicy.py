"""Jobicy (https://jobicy.com/jobs-rss-feed) - remote jobs, no key.

GET https://jobicy.com/api/v2/remote-jobs?count=<n>&geo=<geo>&tag=<kw>
`geo` values verified live (uk, usa, germany, apac, ...; "india" is rejected ->
we use "apac"). Attribution: credit Jobicy with a direct link to the source and
send applicants to the original job URL (we keep its URL and source "jobicy").
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import annual_factor, html_to_text, num, parse_iso, positive, scale
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, run_queries

URL = "https://jobicy.com/api/v2/remote-jobs"
MAX_KEYWORDS = 3
MAX_COUNT = 50


def map_jobicy(job: dict[str, Any]) -> NormalizedPosting:
    factor = annual_factor(job.get("salaryPeriod"))
    smin = scale(positive(num(job.get("salaryMin") or job.get("annualSalaryMin"))), factor)
    smax = scale(positive(num(job.get("salaryMax") or job.get("annualSalaryMax"))), factor)
    geo = (job.get("jobGeo") or "").strip()
    return NormalizedPosting(
        source="jobicy",
        external_id=str(job.get("id")),
        url=job.get("url") or "",
        title=html_to_text(job.get("jobTitle")),
        company=(job.get("companyName") or "Unknown").strip(),
        location=f"Remote ({geo})" if geo else "Remote",
        is_remote=True,
        salary_min=smin,
        salary_max=smax,
        currency=(job.get("salaryCurrency") or None) if (smin or smax) else None,
        description=html_to_text(job.get("jobDescription")) or job.get("jobExcerpt") or None,
        posted_at=parse_iso(job.get("pubDate")),
        raw=compact_raw(job, ("jobDescription", "companyLogo")),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    async def one(kw: str, _loc: str | None):
        params: dict[str, Any] = {"count": min(q.per_query, MAX_COUNT), "tag": kw}
        if q.country.jobicy_geo:
            params["geo"] = q.country.jobicy_geo
        data = await request(client, "GET", URL, params=params)
        jobs = data.get("jobs") or []
        mapped = [map_jobicy(j) for j in jobs if j.get("jobTitle")]
        return recent(mapped, q), len(jobs)

    return await run_queries(q.pairs(with_location=False, limit=MAX_KEYWORDS), one)


SOURCE = SourceDef(id="jobicy", label="Jobicy", fetch=fetch, remote_only=True)
