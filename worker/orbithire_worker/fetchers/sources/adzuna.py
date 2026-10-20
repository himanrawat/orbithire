"""Adzuna (https://developer.adzuna.com/) - official API, free key (app_id + app_key).

GET https://api.adzuna.com/v1/api/jobs/{cc}/search/1
    ?app_id&app_key&what&where&results_per_page&max_days_old&sort_by=date
Salaries are annual in the country's currency; `salary_is_predicted == "1"`
(Adzuna's estimate) is dropped.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import html_to_text, is_remote_text, num, parse_iso, positive
from ..countries import COUNTRIES
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, run_queries

URL = "https://api.adzuna.com/v1/api/jobs/{cc}/search/1"
ENV = ("ADZUNA_APP_ID", "ADZUNA_APP_KEY")


def map_adzuna(job: dict[str, Any], currency: str) -> NormalizedPosting:
    loc = (job.get("location") or {}).get("display_name")
    predicted = str(job.get("salary_is_predicted") or "0") == "1"
    smin = None if predicted else positive(num(job.get("salary_min")))
    smax = None if predicted else positive(num(job.get("salary_max")))
    title = html_to_text(job.get("title"))
    return NormalizedPosting(
        source="adzuna",
        external_id=str(job.get("id")),
        url=job.get("redirect_url") or "",
        title=title,
        company=((job.get("company") or {}).get("display_name") or "Unknown").strip(),
        location=loc,
        is_remote=is_remote_text(loc, title),
        salary_min=smin,
        salary_max=smax,
        currency=currency if (smin or smax) else None,
        description=html_to_text(job.get("description")) or None,
        posted_at=parse_iso(job.get("created")),
        raw=compact_raw(job),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    cc = q.country.adzuna
    app_id, app_key = q.env["ADZUNA_APP_ID"], q.env["ADZUNA_APP_KEY"]

    async def one(kw: str, loc: str | None):
        params: dict[str, Any] = {
            "app_id": app_id,
            "app_key": app_key,
            "what": kw,
            "results_per_page": q.per_query,
            "max_days_old": q.days_old,
            "sort_by": "date",
        }
        if loc:
            params["where"] = loc
        data = await request(client, "GET", URL.format(cc=cc), params=params, redact=app_key)
        results = data.get("results") or []
        return [map_adzuna(j, q.country.currency) for j in results if j.get("title")], len(results)

    return await run_queries(q.pairs(), one)


SOURCE = SourceDef(
    id="adzuna",
    label="Adzuna",
    fetch=fetch,
    countries=frozenset(c.code for c in COUNTRIES.values() if c.adzuna),
    env=ENV,
)
