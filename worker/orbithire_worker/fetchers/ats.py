"""Async clients for public ATS job-board APIs.

Greenhouse, Lever and Ashby live here; Workable, SmartRecruiters, Recruitee,
Personio and Teamtailor in `ats_more.py`. All share `http.request` (retries).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from .common import annual_factor as _annual_factor
from .common import html_to_text
from .common import is_remote_text as _is_remote_text
from .common import num as _num
from .common import parse_iso as _parse_iso
from .common import scale as _scale
from .filters import title_matches  # re-exported for callers
from .http import MAX_ATTEMPTS, USER_AGENT, SourceError, make_client, request
from .models import NormalizedPosting, WatchedCompany

__all__ = [
    "AtsError",
    "MAX_ATTEMPTS",
    "USER_AGENT",
    "fetch_ashby",
    "fetch_ats",
    "fetch_greenhouse",
    "fetch_lever",
    "html_to_text",
    "make_client",
    "title_matches",
]

GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
GREENHOUSE_EU_URL = "https://boards-api.eu.greenhouse.io/v1/boards/{token}/jobs?content=true"
LEVER_URL = "https://api.lever.co/v0/postings/{token}?mode=json"
LEVER_EU_URL = "https://api.eu.lever.co/v0/postings/{token}?mode=json"
ASHBY_URL = "https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true"


class AtsError(SourceError):
    pass


async def _get_json(client: httpx.AsyncClient, url: str) -> Any:
    return await request(client, "GET", url, error_cls=AtsError)


# --------------------------------------------------------------------------- #
# Greenhouse
# --------------------------------------------------------------------------- #


def map_greenhouse(job: dict[str, Any], company: str) -> NormalizedPosting:
    location = (job.get("location") or {}).get("name")
    return NormalizedPosting(
        source="greenhouse",
        external_id=str(job["id"]),
        url=job.get("absolute_url") or "",
        title=(job.get("title") or "").strip(),
        company=job.get("company_name") or company,
        location=location,
        is_remote=_is_remote_text(location),
        description=html_to_text(job.get("content")),
        posted_at=_parse_iso(job.get("first_published") or job.get("updated_at")),
        raw={k: v for k, v in job.items() if k != "content"},
    )


async def fetch_greenhouse(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    if region == "eu":
        try:
            data = await _get_json(client, GREENHOUSE_EU_URL.format(token=token))
        except AtsError:
            data = await _get_json(client, GREENHOUSE_URL.format(token=token))
    else:
        data = await _get_json(client, GREENHOUSE_URL.format(token=token))
    return [map_greenhouse(j, company) for j in data.get("jobs", [])]


# --------------------------------------------------------------------------- #
# Lever
# --------------------------------------------------------------------------- #


def map_lever(job: dict[str, Any], company: str) -> NormalizedPosting:
    cats = job.get("categories") or {}
    location = cats.get("location") or ", ".join(cats.get("allLocations") or []) or None
    parts = [job.get("descriptionPlain") or html_to_text(job.get("description"))]
    for lst in job.get("lists") or []:
        body = html_to_text(lst.get("content"))
        parts.append(f"{lst.get('text', '').strip()}\n{body}".strip())
    parts.append(job.get("additionalPlain") or html_to_text(job.get("additional")))
    sal = job.get("salaryRange") or {}
    factor = _annual_factor(sal.get("interval"))
    created = job.get("createdAt")
    return NormalizedPosting(
        source="lever",
        external_id=str(job["id"]),
        url=job.get("hostedUrl") or job.get("applyUrl") or "",
        title=(job.get("text") or "").strip(),
        company=company,
        location=location,
        is_remote=job.get("workplaceType") == "remote" or _is_remote_text(location),
        salary_min=_scale(_num(sal.get("min")), factor),
        salary_max=_scale(_num(sal.get("max")), factor),
        currency=sal.get("currency") or None,
        description="\n\n".join(p.strip() for p in parts if p and p.strip()),
        posted_at=datetime.fromtimestamp(created / 1000, UTC) if created else None,
        raw={
            k: v
            for k, v in job.items()
            if k not in ("description", "descriptionPlain", "lists", "additional", "additionalPlain")
        },
    )


async def fetch_lever(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    url = (LEVER_EU_URL if region == "eu" else LEVER_URL).format(token=token)
    data = await _get_json(client, url)
    if not isinstance(data, list):
        raise AtsError(f"unexpected Lever payload: {str(data)[:200]}")
    return [map_lever(j, company) for j in data]


# --------------------------------------------------------------------------- #
# Ashby
# --------------------------------------------------------------------------- #


def _ashby_salary(job: dict[str, Any]) -> tuple[float | None, float | None, str | None]:
    comp = job.get("compensation") or {}
    for c in comp.get("summaryComponents") or []:
        if (c.get("compensationType") or "").lower() == "salary":
            factor = _annual_factor(c.get("interval"))
            return (
                _scale(_num(c.get("minValue")), factor),
                _scale(_num(c.get("maxValue")), factor),
                c.get("currencyCode"),
            )
    return None, None, None


def map_ashby(job: dict[str, Any], company: str) -> NormalizedPosting:
    location = job.get("location")
    smin, smax, cur = _ashby_salary(job)
    return NormalizedPosting(
        source="ashby",
        external_id=str(job.get("id") or job.get("jobUrl")),
        url=job.get("jobUrl") or job.get("applyUrl") or "",
        title=(job.get("title") or "").strip(),
        company=company,
        location=location,
        is_remote=bool(job.get("isRemote")) or job.get("workplaceType") == "Remote"
        or _is_remote_text(location),
        salary_min=smin,
        salary_max=smax,
        currency=cur,
        description=job.get("descriptionPlain") or html_to_text(job.get("descriptionHtml")),
        posted_at=_parse_iso(job.get("publishedAt")),
        raw={k: v for k, v in job.items() if k not in ("descriptionHtml", "descriptionPlain")},
    )


async def fetch_ashby(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    data = await _get_json(client, ASHBY_URL.format(token=token))
    return [map_ashby(j, company) for j in data.get("jobs", []) if j.get("isListed", True)]


_FETCHERS: dict[str, Any] = {"greenhouse": fetch_greenhouse, "lever": fetch_lever, "ashby": fetch_ashby}


async def fetch_ats(
    company: WatchedCompany, client: httpx.AsyncClient | None = None
) -> list[NormalizedPosting]:
    """Fetch all open postings for one watched company. Raises AtsError."""
    if not company.ats or not company.board_token:
        raise AtsError(f"{company.company}: no supported ATS / board token")
    from .ats_more import EXTRA_FETCHERS

    fetcher = _FETCHERS.get(company.ats) or EXTRA_FETCHERS.get(company.ats)
    if fetcher is None:
        raise AtsError(f"{company.company}: unsupported ATS {company.ats!r}")
    if client is None:
        async with make_client() as own:
            return await fetcher(own, company.board_token, company.company, company.region)
    return await fetcher(client, company.board_token, company.company, company.region)
