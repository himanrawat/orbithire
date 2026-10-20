"""MyCareersFuture (Singapore, Workforce Singapore) - public JSON, no key.

GET https://api.mycareersfuture.gov.sg/v2/jobs?search&limit&page=0&sortBy=new_posting_date
(verified live 2026-10; includes the HTML description). Salaries are SGD,
usually monthly (salary.type.salaryType).
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import annual_factor, html_to_text, num, parse_iso, positive, scale
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, run_queries

URL = "https://api.mycareersfuture.gov.sg/v2/jobs"
MAX_LIMIT = 50


def map_mcf(job: dict[str, Any]) -> NormalizedPosting:
    meta = job.get("metadata") or {}
    sal = job.get("salary") or {}
    hidden = bool(meta.get("isHideSalary"))
    factor = annual_factor(((sal.get("type") or {}).get("salaryType")) or "Monthly")
    smin = None if hidden else scale(positive(num(sal.get("minimum"))), factor)
    smax = None if hidden else scale(positive(num(sal.get("maximum"))), factor)
    addr = job.get("address") or {}
    if addr.get("isOverseas"):
        location = addr.get("overseasCountry") or "Overseas"
    else:
        districts = addr.get("districts") or []
        region = districts[0].get("region") if districts else None
        location = f"Singapore{f' ({region})' if region else ''}"
    company = (job.get("hiringCompany") or {}).get("name") if not meta.get("isHideHiringEmployerName") else None
    company = company or (job.get("postedCompany") or {}).get("name") or "Unknown"
    flex = " ".join(str(x) for x in (job.get("flexibleWorkArrangements") or []))
    uuid = job.get("uuid") or ""
    return NormalizedPosting(
        source="mycareersfuture",
        external_id=uuid or meta.get("jobPostId"),
        url=meta.get("jobDetailsUrl") or f"https://www.mycareersfuture.gov.sg/job/{uuid}",
        title=(job.get("title") or "").strip(),
        company=company.strip(),
        location=location,
        is_remote="remote" in flex.lower() or "work from home" in flex.lower(),
        salary_min=smin,
        salary_max=smax,
        currency="SGD" if (smin or smax) else None,
        description=html_to_text(job.get("description")) or None,
        posted_at=parse_iso(meta.get("newPostingDate") or meta.get("createdAt")),
        raw=compact_raw(job, ("description", "postedCompany", "skills")),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    async def one(kw: str, _loc: str | None):
        params = {"search": kw, "limit": min(q.per_query, MAX_LIMIT), "page": 0, "sortBy": "new_posting_date"}
        data = await request(client, "GET", URL, params=params)
        results = data.get("results") or []
        mapped = [map_mcf(j) for j in results if j.get("title")]
        return recent(mapped, q, grace_hours=24), len(results)

    # Singapore is one city: only keywords are iterated.
    return await run_queries(q.pairs(with_location=False), one)


SOURCE = SourceDef(id="mycareersfuture", label="MyCareersFuture", fetch=fetch, countries=frozenset({"SG"}))
