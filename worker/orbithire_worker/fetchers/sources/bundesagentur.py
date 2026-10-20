"""Bundesagentur fuer Arbeit Jobsuche (Germany) - public, fixed client id.

GET https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs
    ?was&wo&size&page=1&veroeffentlichtseit=<days>   header X-API-Key: jobboerse-jobsuche
(verified live 2026-10; /pc/v4/jobs now returns 403). The list has no
description; the job page is https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import parse_iso
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, run_queries

URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs"
DETAIL_URL = "https://www.arbeitsagentur.de/jobsuche/jobdetail/{refnr}"
HEADERS = {"X-API-Key": "jobboerse-jobsuche"}
MAX_SIZE = 50


def map_ba(job: dict[str, Any]) -> NormalizedPosting:
    refnr = job.get("referenznummer") or job.get("refnr") or ""
    locs = job.get("stellenlokationen") or []
    addr = (locs[0].get("adresse") if locs else None) or job.get("arbeitsort") or {}
    city = (addr.get("ort") or "").strip()
    region = (addr.get("region") or "").strip().title()
    if region.lower() == city.lower():
        region = ""
    location = ", ".join(p for p in (city, region, "Germany" if addr else "") if p) or None
    title = (job.get("stellenangebotsTitel") or job.get("titel") or job.get("beruf") or "").strip()
    return NormalizedPosting(
        source="bundesagentur",
        external_id=refnr,
        url=DETAIL_URL.format(refnr=refnr),
        title=title,
        company=(job.get("firma") or job.get("arbeitgeber") or "Unknown").strip(),
        location=location,
        is_remote=False,
        description=None,
        posted_at=parse_iso(job.get("datumErsteVeroeffentlichung") or job.get("aktuelleVeroeffentlichungsdatum")),
        raw=compact_raw(job, ()),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    async def one(kw: str, loc: str | None):
        params: dict[str, Any] = {
            "was": kw,
            "size": min(q.per_query, MAX_SIZE),
            "page": 1,
            "veroeffentlichtseit": min(q.days_old, 100),
            "angebotsart": 1,  # ARBEIT (jobs; not training/self-employment)
        }
        if loc:
            params["wo"] = loc
        data = await request(client, "GET", URL, params=params, headers=HEADERS)
        results = data.get("ergebnisliste") or data.get("stellenangebote") or []
        return [map_ba(j) for j in results if (j.get("referenznummer") or j.get("refnr"))], len(results)

    return await run_queries(q.pairs(), one)


SOURCE = SourceDef(
    id="bundesagentur", label="Bundesagentur für Arbeit", fetch=fetch, countries=frozenset({"DE"})
)
