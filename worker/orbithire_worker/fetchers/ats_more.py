"""Tier 2 ATS boards: Workable, SmartRecruiters, Recruitee, Personio, Teamtailor.

Endpoints (verified live 2026-10):
  Workable         GET https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true
  SmartRecruiters  GET https://api.smartrecruiters.com/v1/companies/{id}/postings?limit=100&offset=N
                   (+ GET .../postings/{postingId} for the description, capped)
  Recruitee        GET https://{slug}.recruitee.com/api/offers/
  Personio         GET https://{slug}.jobs.personio.de/xml?language=en  (or .com)
  Teamtailor       GET https://{slug}.teamtailor.com/jobs.rss  (or {slug}.na.teamtailor.com)
"""

from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from .common import (
    annual_factor,
    html_to_text,
    is_remote_text,
    num,
    parse_iso,
    positive,
    scale,
)
from .http import SourceError, request
from .models import NormalizedPosting

WORKABLE_URL = "https://apply.workable.com/api/v1/widget/accounts/{token}?details=true"
SMARTRECRUITERS_URL = "https://api.smartrecruiters.com/v1/companies/{token}/postings"
SMARTRECRUITERS_DETAIL_URL = "https://api.smartrecruiters.com/v1/companies/{token}/postings/{id}"
RECRUITEE_URL = "https://{token}.recruitee.com/api/offers/"
PERSONIO_URL = "https://{token}.jobs.personio.{tld}/xml?language=en"
TEAMTAILOR_URL = "https://{token}.{cluster}teamtailor.com/jobs.rss"

# SmartRecruiters boards can be huge (Bosch: 5000+): cap pages and detail calls.
SMARTRECRUITERS_PAGE = 100
SMARTRECRUITERS_MAX_PAGES = 3
SMARTRECRUITERS_MAX_DETAILS = 25


def _err():
    from .ats import AtsError  # late import: ats imports this module lazily

    return AtsError


async def _get(client: httpx.AsyncClient, url: str, **kw: Any) -> Any:
    return await request(client, "GET", url, error_cls=_err(), **kw)


# --------------------------------------------------------------------------- #
# Workable
# --------------------------------------------------------------------------- #


def map_workable(job: dict[str, Any], company: str) -> NormalizedPosting:
    locs = job.get("locations") or []
    parts = [job.get("city"), job.get("state"), job.get("country")]
    if not any(parts) and locs:
        first = locs[0]
        parts = [first.get("city"), first.get("region"), first.get("country")]
    location = ", ".join(p for p in parts if p) or None
    remote = bool(job.get("telecommuting"))
    return NormalizedPosting(
        source="workable",
        external_id=str(job.get("shortcode") or job.get("url")),
        url=job.get("url") or job.get("shortlink") or "",
        title=(job.get("title") or "").strip(),
        company=company,
        location=location if not remote or location else "Remote",
        is_remote=remote or is_remote_text(location),
        description=html_to_text(job.get("description")) or None,
        posted_at=parse_iso(job.get("published_on") or job.get("created_at")),
        raw={k: v for k, v in job.items() if k != "description"},
    )


async def fetch_workable(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    data = await _get(client, WORKABLE_URL.format(token=token))
    jobs = data.get("jobs") if isinstance(data, dict) else None
    if jobs is None:
        raise _err()(f"unexpected Workable payload: {str(data)[:200]}")
    return [map_workable(j, data.get("name") or company) for j in jobs if j.get("title")]


# --------------------------------------------------------------------------- #
# SmartRecruiters
# --------------------------------------------------------------------------- #


def map_smartrecruiters(job: dict[str, Any], company: str, token: str) -> NormalizedPosting:
    loc = job.get("location") or {}
    location = loc.get("fullLocation") or ", ".join(
        p for p in (loc.get("city"), loc.get("region"), (loc.get("country") or "").upper()) if p
    ) or None
    remote = bool(loc.get("remote"))
    jid = str(job.get("id"))
    return NormalizedPosting(
        source="smartrecruiters",
        external_id=jid,
        url=job.get("postingUrl") or f"https://jobs.smartrecruiters.com/{token}/{jid}",
        title=(job.get("name") or "").strip(),
        company=(job.get("company") or {}).get("name") or company,
        location=location,
        is_remote=remote or is_remote_text(location),
        posted_at=parse_iso(job.get("releasedDate")),
        raw={k: v for k, v in job.items() if k not in ("customField", "jobAd")},
    )


def smartrecruiters_description(detail: dict[str, Any]) -> str | None:
    sections = ((detail.get("jobAd") or {}).get("sections")) or {}
    parts = []
    for key in ("jobDescription", "qualifications", "additionalInformation", "companyDescription"):
        sec = sections.get(key) or {}
        body = html_to_text(sec.get("text"))
        if body:
            parts.append(f"{sec.get('title') or ''}\n{body}".strip())
    return "\n\n".join(parts) or None


async def fetch_smartrecruiters(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    out: list[NormalizedPosting] = []
    for page in range(SMARTRECRUITERS_MAX_PAGES):
        data = await _get(
            client,
            SMARTRECRUITERS_URL.format(token=token),
            params={"limit": SMARTRECRUITERS_PAGE, "offset": page * SMARTRECRUITERS_PAGE},
        )
        content = data.get("content") if isinstance(data, dict) else None
        if content is None:
            raise _err()(f"unexpected SmartRecruiters payload: {str(data)[:200]}")
        out.extend(map_smartrecruiters(j, company, token) for j in content if j.get("name"))
        if len(content) < SMARTRECRUITERS_PAGE or len(out) >= int(data.get("totalFound") or 0):
            break
    if not out and page == 0 and int(data.get("totalFound") or 0) == 0:
        # SmartRecruiters returns 200 + empty list for unknown company ids.
        return []
    return out


async def enrich_smartrecruiters(
    client: httpx.AsyncClient, token: str, postings: list[NormalizedPosting],
    limit: int = SMARTRECRUITERS_MAX_DETAILS, concurrency: int = 4,
) -> None:
    """Fill descriptions for (already title-filtered) postings; failures are ignored."""
    sem = asyncio.Semaphore(concurrency)

    async def one(p: NormalizedPosting) -> None:
        async with sem:
            try:
                d = await _get(client, SMARTRECRUITERS_DETAIL_URL.format(token=token, id=p.external_id))
            except (SourceError, httpx.HTTPError):
                return
            p.description = smartrecruiters_description(d) if isinstance(d, dict) else None

    await asyncio.gather(*(one(p) for p in postings[:limit] if not p.description))


# --------------------------------------------------------------------------- #
# Recruitee
# --------------------------------------------------------------------------- #


def map_recruitee(job: dict[str, Any], company: str) -> NormalizedPosting:
    sal = job.get("salary") or {}
    factor = annual_factor(sal.get("period"))
    location = job.get("location") or ", ".join(
        p for p in (job.get("city"), job.get("country")) if p
    ) or None
    remote = bool(job.get("remote"))
    desc = "\n\n".join(
        t for t in (html_to_text(job.get("description")), html_to_text(job.get("requirements"))) if t
    )
    return NormalizedPosting(
        source="recruitee",
        external_id=str(job.get("id") or job.get("slug")),
        url=job.get("careers_url") or job.get("careers_apply_url") or "",
        title=(job.get("title") or "").strip(),
        company=job.get("company_name") or company,
        location=location,
        is_remote=remote or is_remote_text(location),
        salary_min=scale(positive(num(sal.get("min"))), factor),
        salary_max=scale(positive(num(sal.get("max"))), factor),
        currency=sal.get("currency") or None,
        description=desc or None,
        posted_at=parse_iso(job.get("published_at") or job.get("created_at")),
        raw={
            k: v for k, v in job.items()
            if k not in ("description", "requirements", "translations", "open_questions")
        },
    )


async def fetch_recruitee(
    client: httpx.AsyncClient, token: str, company: str, region: str = "us"
) -> list[NormalizedPosting]:
    data = await _get(client, RECRUITEE_URL.format(token=token))
    offers = data.get("offers") if isinstance(data, dict) else None
    if offers is None:
        raise _err()(f"unexpected Recruitee payload: {str(data)[:200]}")
    return [
        map_recruitee(j, company) for j in offers
        if j.get("title") and (j.get("status") in (None, "published"))
    ]


# --------------------------------------------------------------------------- #
# Personio (XML)
# --------------------------------------------------------------------------- #


def _xml_text(el: ET.Element | None, tag: str) -> str | None:
    if el is None:
        return None
    child = el.find(tag)
    return (child.text or "").strip() or None if child is not None else None


def parse_personio_xml(xml_text: str, token: str, company: str, tld: str = "de") -> list[NormalizedPosting]:
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError as e:
        raise _err()(f"invalid Personio XML: {e}") from e
    out = []
    for pos in root.findall("position"):
        pid = _xml_text(pos, "id")
        title = _xml_text(pos, "name")
        if not pid or not title:
            continue
        offices = [_xml_text(pos, "office")] + [
            (o.text or "").strip() for o in pos.findall("additionalOffices/office")
        ]
        offices = [o for o in offices if o]
        parts = []
        for jd in pos.findall("jobDescriptions/jobDescription"):
            body = html_to_text(_xml_text(jd, "value"))
            if body:
                parts.append(f"{_xml_text(jd, 'name') or ''}\n{body}".strip())
        location = ", ".join(offices) or None
        out.append(
            NormalizedPosting(
                source="personio",
                external_id=pid,
                url=f"https://{token}.jobs.personio.{tld}/job/{pid}",
                title=title,
                company=_xml_text(pos, "subcompany") or company,
                location=location,
                is_remote=is_remote_text(location, _xml_text(pos, "schedule")),
                description="\n\n".join(parts) or None,
                posted_at=parse_iso(_xml_text(pos, "createdAt")),
                raw={
                    "id": pid,
                    "department": _xml_text(pos, "department"),
                    "offices": offices,
                    "employmentType": _xml_text(pos, "employmentType"),
                    "seniority": _xml_text(pos, "seniority"),
                    "schedule": _xml_text(pos, "schedule"),
                    "yearsOfExperience": _xml_text(pos, "yearsOfExperience"),
                },
            )
        )
    return out


async def fetch_personio(
    client: httpx.AsyncClient, token: str, company: str, region: str = "eu"
) -> list[NormalizedPosting]:
    # region "us" = *.jobs.personio.com was configured; otherwise try .de, then .com
    tlds = ["com", "de"] if region == "us" else ["de", "com"]
    last: Exception | None = None
    for tld in tlds:
        try:
            text = await _get(client, PERSONIO_URL.format(token=token, tld=tld), expect="text")
        except SourceError as e:
            last = e
            if "404" in str(e):
                continue
            raise
        return parse_personio_xml(text, token, company, tld)
    raise last or _err()(f"Personio board {token!r} not found")


# --------------------------------------------------------------------------- #
# Teamtailor (RSS)
# --------------------------------------------------------------------------- #

_TT_NS = {"tt": "https://teamtailor.com/locations"}


def parse_teamtailor_rss(xml_text: str, company: str) -> list[NormalizedPosting]:
    try:
        root = ET.fromstring(xml_text.encode("utf-8") if isinstance(xml_text, str) else xml_text)
    except ET.ParseError as e:
        raise _err()(f"invalid Teamtailor RSS: {e}") from e
    channel = root.find("channel")
    feed_company = _xml_text(channel, "title") if channel is not None else None
    out = []
    for item in root.iter("item"):
        title = _xml_text(item, "title")
        link = _xml_text(item, "link")
        if not title or not link:
            continue
        locs = []
        for loc in item.findall("tt:locations/tt:location", _TT_NS):
            name = loc.findtext("tt:name", default="", namespaces=_TT_NS).strip()
            city = loc.findtext("tt:city", default="", namespaces=_TT_NS).strip()
            country = loc.findtext("tt:country", default="", namespaces=_TT_NS).strip()
            locs.append(name or ", ".join(p for p in (city, country) if p))
        locs = [x for x in locs if x]
        remote_status = (_xml_text(item, "remoteStatus") or "none").lower()
        is_remote = remote_status in ("fully", "remote", "full")
        location = "; ".join(locs) or ("Remote" if is_remote else None)
        posted = None
        pub = _xml_text(item, "pubDate")
        if pub:
            try:
                posted = parsedate_to_datetime(pub)
            except (TypeError, ValueError):
                posted = None
        out.append(
            NormalizedPosting(
                source="teamtailor",
                external_id=_xml_text(item, "guid") or link,
                url=link,
                title=title,
                company=_xml_text(item, "company_name") or feed_company or company,
                location=location,
                is_remote=is_remote or is_remote_text(location),
                description=html_to_text(_xml_text(item, "description")) or None,
                posted_at=posted,
                raw={
                    "guid": _xml_text(item, "guid"),
                    "remoteStatus": remote_status,
                    "department": item.findtext("tt:department", default=None, namespaces=_TT_NS),
                    "locations": locs,
                },
            )
        )
    return out


async def fetch_teamtailor(
    client: httpx.AsyncClient, token: str, company: str, region: str = "eu"
) -> list[NormalizedPosting]:
    # Most boards live on <slug>.teamtailor.com, North-American ones on
    # <slug>.na.teamtailor.com. WatchedCompany.region defaults to "us" whenever no
    # careers URL is known, so it can't be trusted here: try the main host, then NA.
    clusters = ["", "na."]
    last: Exception | None = None
    for cluster in clusters:
        try:
            text = await _get(
                client, TEAMTAILOR_URL.format(token=token, cluster=cluster), expect="text",
                headers={"Accept": "application/rss+xml, application/xml, text/xml"},
            )
        except SourceError as e:
            last = e
            if "404" in str(e):
                continue
            raise
        return parse_teamtailor_rss(text, company)
    raise last or _err()(f"Teamtailor board {token!r} not found")


EXTRA_FETCHERS: dict[str, Any] = {
    "workable": fetch_workable,
    "smartrecruiters": fetch_smartrecruiters,
    "recruitee": fetch_recruitee,
    "personio": fetch_personio,
    "teamtailor": fetch_teamtailor,
}
