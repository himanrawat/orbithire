"""Async clients for public ATS job-board APIs: Greenhouse, Lever, Ashby."""

from __future__ import annotations

import asyncio
import html
import random
import re
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any

import httpx

from .filters import title_matches  # re-exported for callers
from .models import NormalizedPosting, WatchedCompany

__all__ = [
    "AtsError",
    "USER_AGENT",
    "fetch_ashby",
    "fetch_ats",
    "fetch_greenhouse",
    "fetch_lever",
    "html_to_text",
    "make_client",
    "title_matches",
]

USER_AGENT = "OrbitHire/0.1 (job-board API client; low volume)"
DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
MAX_ATTEMPTS = 3
MAX_RETRY_AFTER = 30.0

GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
GREENHOUSE_EU_URL = "https://boards-api.eu.greenhouse.io/v1/boards/{token}/jobs?content=true"
LEVER_URL = "https://api.lever.co/v0/postings/{token}?mode=json"
LEVER_EU_URL = "https://api.eu.lever.co/v0/postings/{token}?mode=json"
ASHBY_URL = "https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true"

_sleep = asyncio.sleep  # patched in tests


class AtsError(Exception):
    pass


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=DEFAULT_TIMEOUT,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=True,
    )


# --------------------------------------------------------------------------- #
# HTML -> text
# --------------------------------------------------------------------------- #

_BLOCK_TAGS = {
    "p", "div", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "section", "article", "tr", "table", "blockquote", "pre", "hr",
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skip += 1
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK_TAGS and tag != "li":
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def html_to_text(content: str | None) -> str:
    """Convert (possibly entity-escaped, as Greenhouse returns) HTML to clean text."""
    if not content:
        return ""
    if "&lt;" in content and "<" not in content:
        content = html.unescape(content)
    parser = _TextExtractor()
    parser.feed(content)
    parser.close()
    text = "".join(parser.parts).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n- *\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# --------------------------------------------------------------------------- #
# HTTP with retries
# --------------------------------------------------------------------------- #


async def _get_json(client: httpx.AsyncClient, url: str) -> Any:
    last: str = ""
    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = await client.get(url)
        except httpx.TransportError as e:
            last = f"{type(e).__name__}: {e}"
            delay = 2**attempt + random.random()
        else:
            if resp.status_code == 404:
                raise AtsError(f"board not found (404): {url}")
            if resp.status_code == 429 or resp.status_code >= 500:
                last = f"HTTP {resp.status_code}"
                delay = 2**attempt + random.random()
                ra = resp.headers.get("retry-after")
                if ra and ra.isdigit():
                    delay = min(float(ra), MAX_RETRY_AFTER)
            elif resp.status_code >= 400:
                raise AtsError(f"HTTP {resp.status_code}: {url}")
            else:
                try:
                    return resp.json()
                except ValueError as e:
                    raise AtsError(f"invalid JSON from {url}") from e
        if attempt < MAX_ATTEMPTS - 1:
            await _sleep(delay)
    raise AtsError(f"giving up after {MAX_ATTEMPTS} attempts ({last}): {url}")


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

_INTERVAL_FACTOR = {"year": 1, "month": 12, "week": 52, "day": 260, "hour": 2080}


def _annual_factor(interval: str | None) -> int:
    s = (interval or "year").lower()
    for key, factor in _INTERVAL_FACTOR.items():
        if key in s:
            return factor
    return 1


def _num(v: Any) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def _scale(v: float | None, factor: int) -> float | None:
    return None if v is None else round(v * factor, 2)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _is_remote_text(*texts: str | None) -> bool:
    return any(t and "remote" in t.lower() for t in texts)


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


_FETCHERS = {"greenhouse": fetch_greenhouse, "lever": fetch_lever, "ashby": fetch_ashby}


async def fetch_ats(
    company: WatchedCompany, client: httpx.AsyncClient | None = None
) -> list[NormalizedPosting]:
    """Fetch all open postings for one watched company. Raises AtsError."""
    if not company.ats or not company.board_token:
        raise AtsError(f"{company.company}: no supported ATS / board token")
    fetcher = _FETCHERS[company.ats]
    if client is None:
        async with make_client() as own:
            return await fetcher(own, company.board_token, company.company, company.region)
    return await fetcher(client, company.board_token, company.company, company.region)
