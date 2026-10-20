"""USAJOBS (https://developer.usajobs.gov/) - US federal jobs, free key.

GET https://data.usajobs.gov/api/search?Keyword&LocationName&ResultsPerPage&DatePosted=<days>
Headers: Host: data.usajobs.gov, User-Agent: <the email used to request the key>,
Authorization-Key: <key>.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import num, parse_iso, positive, scale
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, run_queries

URL = "https://data.usajobs.gov/api/search"
ENV = ("USAJOBS_API_KEY", "USAJOBS_USER_AGENT")
# PositionRemuneration.RateIntervalCode -> annual factor
_RATE = {"PA": 1, "PM": 12, "BW": 26, "PW": 52, "PD": 260, "PH": 2080, "FB": 1, "ST": 1}


def map_usajobs(item: dict[str, Any]) -> NormalizedPosting:
    d = item.get("MatchedObjectDescriptor") or {}
    pay = (d.get("PositionRemuneration") or [{}])[0] or {}
    factor = _RATE.get(str(pay.get("RateIntervalCode") or "PA").upper())
    smin = scale(positive(num(pay.get("MinimumRange"))), factor) if factor else None
    smax = scale(positive(num(pay.get("MaximumRange"))), factor) if factor else None
    details = ((d.get("UserArea") or {}).get("Details")) or {}
    remote = bool(details.get("RemoteIndicator"))
    location = d.get("PositionLocationDisplay") or ", ".join(
        loc.get("LocationName", "") for loc in (d.get("PositionLocation") or [])[:3]
    ) or None
    desc_parts = [
        details.get("JobSummary"),
        d.get("QualificationSummary"),
        "\n".join(details.get("MajorDuties") or []) if isinstance(details.get("MajorDuties"), list) else None,
    ]
    return NormalizedPosting(
        source="usajobs",
        external_id=str(item.get("MatchedObjectId") or d.get("PositionID")),
        url=d.get("PositionURI") or (d.get("ApplyURI") or [""])[0],
        title=(d.get("PositionTitle") or "").strip(),
        company=(d.get("OrganizationName") or d.get("DepartmentName") or "US Government").strip(),
        location=location,
        is_remote=remote or "anywhere" in (location or "").lower() or "remote" in (location or "").lower(),
        salary_min=smin,
        salary_max=smax,
        currency="USD" if (smin or smax) else None,
        description="\n\n".join(p.strip() for p in desc_parts if p and p.strip()) or None,
        posted_at=parse_iso(d.get("PublicationStartDate")),
        raw={k: v for k, v in d.items() if k not in ("UserArea", "QualificationSummary")},
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    headers = {
        "Host": "data.usajobs.gov",
        "User-Agent": q.env["USAJOBS_USER_AGENT"],
        "Authorization-Key": q.env["USAJOBS_API_KEY"],
    }

    async def one(kw: str, loc: str | None):
        params: dict[str, Any] = {
            "Keyword": kw,
            "ResultsPerPage": q.per_query,
            "DatePosted": min(q.days_old, 60),
        }
        if loc:
            params["LocationName"] = loc
        data = await request(client, "GET", URL, params=params, headers=headers)
        items = ((data.get("SearchResult") or {}).get("SearchResultItems")) or []
        return [map_usajobs(i) for i in items], len(items)

    return await run_queries(q.pairs(), one)


SOURCE = SourceDef(id="usajobs", label="USAJOBS", fetch=fetch, countries=frozenset({"US"}), env=ENV)
