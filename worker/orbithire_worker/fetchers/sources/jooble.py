"""Jooble (https://jooble.org/api/about) - aggregator, free key on request.

POST https://jooble.org/api/{key}  {"keywords", "location", "page", "ResultOnPage"}
-> {"totalCount", "jobs": [{id, title, location, snippet, salary, source, type,
    link, company, updated}]}. Salary is free text.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import html_to_text, is_remote_text, parse_iso, parse_salary_text
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, run_queries

URL = "https://jooble.org/api/{key}"
ENV = ("JOOBLE_API_KEY",)


def map_jooble(job: dict[str, Any], currency: str) -> NormalizedPosting:
    loc = (job.get("location") or "").strip() or None
    smin, smax, cur = parse_salary_text(job.get("salary"), currency)
    title = html_to_text(job.get("title"))
    return NormalizedPosting(
        source="jooble",
        external_id=str(job.get("id")) if job.get("id") is not None else None,
        url=job.get("link") or "",
        title=title,
        company=(job.get("company") or "Unknown").strip() or "Unknown",
        location=loc,
        is_remote=is_remote_text(loc, job.get("type")),
        salary_min=smin,
        salary_max=smax,
        currency=cur if (smin or smax) else None,
        description=html_to_text(job.get("snippet")) or None,
        posted_at=parse_iso(job.get("updated")),
        raw=compact_raw(job, ("snippet",)),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    key = q.env["JOOBLE_API_KEY"]
    country = q.country.name

    async def one(kw: str, loc: str | None):
        where = country if not loc else (loc if country.lower() in loc.lower() else f"{loc}, {country}")
        body = {"keywords": kw, "location": where, "page": "1", "ResultOnPage": str(q.per_query)}
        data = await request(client, "POST", URL.format(key=key), json=body, redact=key)
        jobs = data.get("jobs") or []
        mapped = [map_jooble(j, q.country.currency) for j in jobs if j.get("title") and j.get("link")]
        return recent(mapped, q, grace_hours=24), len(jobs)

    return await run_queries(q.pairs(), one)


SOURCE = SourceDef(id="jooble", label="Jooble", fetch=fetch, env=ENV)
