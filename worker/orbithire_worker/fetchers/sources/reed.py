"""Reed.co.uk (https://www.reed.co.uk/developers/jobseeker) - UK, free key.

GET https://www.reed.co.uk/api/1.0/search?keywords&locationName&resultsToTake
Basic auth: username = API key, empty password.
Results: {jobId, employerName, jobTitle, locationName, minimumSalary,
maximumSalary, currency, date "dd/mm/yyyy", jobDescription (snippet), jobUrl}.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from ..common import html_to_text, is_remote_text, num, positive
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, run_queries

URL = "https://www.reed.co.uk/api/1.0/search"
ENV = ("REED_API_KEY",)


def _reed_date(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.strptime(v.strip()[:10], "%d/%m/%Y").replace(tzinfo=UTC)
    except ValueError:
        return None


def map_reed(job: dict[str, Any]) -> NormalizedPosting:
    loc = job.get("locationName")
    smin, smax = positive(num(job.get("minimumSalary"))), positive(num(job.get("maximumSalary")))
    title = (job.get("jobTitle") or "").strip()
    return NormalizedPosting(
        source="reed",
        external_id=str(job.get("jobId")),
        url=job.get("jobUrl") or f"https://www.reed.co.uk/jobs/{job.get('jobId')}",
        title=title,
        company=(job.get("employerName") or "Unknown").strip(),
        location=loc,
        is_remote=is_remote_text(loc, title),
        salary_min=smin,
        salary_max=smax,
        currency=(job.get("currency") or "GBP") if (smin or smax) else None,
        description=html_to_text(job.get("jobDescription")) or None,
        posted_at=_reed_date(job.get("date")),
        raw=compact_raw(job, ("jobDescription",)),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    auth = (q.env["REED_API_KEY"], "")

    async def one(kw: str, loc: str | None):
        params: dict[str, Any] = {"keywords": kw, "resultsToTake": q.per_query}
        if loc:
            params["locationName"] = loc
        data = await request(client, "GET", URL, params=params, auth=auth)
        results = data.get("results") or []
        mapped = [map_reed(j) for j in results if j.get("jobTitle")]
        return recent(mapped, q, grace_hours=24), len(results)

    return await run_queries(q.pairs(), one)


SOURCE = SourceDef(id="reed", label="Reed", fetch=fetch, countries=frozenset({"GB"}), env=ENV)
