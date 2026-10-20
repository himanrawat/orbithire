"""Parse career-ops `portals.yml` into watched companies + default search filters.

Real structure (career-ops):

    title_filter: {positive: [..], negative: [..], seniority_boost: [..]}
    search_queries: [{name, query, enabled}]        # WebSearch queries, ignored here
    tracked_companies:
      - {name, careers_url, api?, scan_method?, scan_query?, notes?, enabled}
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from .models import AtsName, SearchSpec, WatchedCompany

_ATS_PATTERNS: list[tuple[AtsName, re.Pattern[str]]] = [
    # boards-api.greenhouse.io/v1/boards/<token>/jobs
    ("greenhouse", re.compile(r"^boards-api(\.eu)?\.greenhouse\.io$")),
    # boards.greenhouse.io/<token>, job-boards(.eu).greenhouse.io/<token>
    ("greenhouse", re.compile(r"^(job-)?boards(\.eu)?\.greenhouse\.io$")),
    ("lever", re.compile(r"^(jobs|api)(\.eu)?\.lever\.co$")),
    ("ashby", re.compile(r"^(jobs|api)\.ashbyhq\.com$")),
    # apply.workable.com/<slug>, apply.workable.com/api/v1/widget/accounts/<slug>, <slug>.workable.com
    ("workable", re.compile(r"^(apply\.)?workable\.com$|^[a-z0-9-]+\.workable\.com$")),
    # jobs|careers.smartrecruiters.com/<Company>, api.smartrecruiters.com/v1/companies/<Company>/postings
    ("smartrecruiters", re.compile(r"^(jobs|careers|api)\.smartrecruiters\.com$")),
    # <slug>.recruitee.com
    ("recruitee", re.compile(r"^[a-z0-9-]+\.recruitee\.com$")),
    # <slug>.jobs.personio.de / .com
    ("personio", re.compile(r"^[a-z0-9-]+\.jobs\.personio\.(de|com)$")),
    # <slug>.teamtailor.com, <slug>.na.teamtailor.com
    ("teamtailor", re.compile(r"^[a-z0-9-]+\.(na\.)?teamtailor\.com$")),
]

_SUBDOMAIN_RESERVED = {"www", "app", "api", "apply", "jobs", "careers", "help", "support", "na"}


def _after(segments: list[str], key: str) -> str | None:
    if key in segments and segments.index(key) + 1 < len(segments):
        return segments[segments.index(key) + 1]
    return None


def _token_for(ats: str, host: str, segments: list[str], query: str) -> str | None:
    sub = host.split(".", 1)[0]
    if ats == "greenhouse":
        if host.startswith("boards-api"):
            return _after(segments, "boards")  # /v1/boards/<token>/jobs
        if segments and segments[0] == "embed":  # /embed/job_board?for=<token>
            q = dict(p.split("=", 1) for p in query.split("&") if "=" in p)
            return q.get("for")
        return segments[0] if segments else None
    if ats == "lever":
        if host.startswith("api."):
            return _after(segments, "postings")  # /v0/postings/<token>
        return segments[0] if segments else None
    if ats == "ashby":
        if host.startswith("api."):
            return _after(segments, "job-board")  # /posting-api/job-board/<token>
        return segments[0] if segments else None
    if ats == "workable":
        if host in ("apply.workable.com", "workable.com"):
            if segments and segments[0] == "api":
                return _after(segments, "accounts")
            # apply.workable.com/j/<shortcode> is a single job, not a board
            return segments[0] if segments and segments[0] not in ("j", "api") else None
        return None if sub in _SUBDOMAIN_RESERVED else sub
    if ats == "smartrecruiters":
        if host.startswith("api."):
            return _after(segments, "companies")
        return segments[0] if segments else None
    if ats in ("recruitee", "personio", "teamtailor"):
        return None if sub in _SUBDOMAIN_RESERVED else sub
    return None


def detect_ats(url: str | None) -> tuple[AtsName | None, str | None, str]:
    """Return (ats, board_token, region) inferred from a careers / API URL.

    region: Greenhouse/Lever "eu" hosts; Personio "eu" = .de, "us" = .com;
    Teamtailor "us" = <slug>.na.teamtailor.com.
    """
    if not url:
        return None, None, "us"
    raw = url.strip()
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    segments = [s for s in parsed.path.split("/") if s]
    region = "eu" if ".eu." in f".{host}" else "us"
    for ats, pattern in _ATS_PATTERNS:
        if not pattern.match(host):
            continue
        if ats == "personio":
            region = "eu" if host.endswith(".de") else "us"
        elif ats == "teamtailor":
            region = "us" if ".na.teamtailor.com" in host else "eu"
        token = _token_for(ats, host, segments, parsed.query)
        if token:
            return ats, token, region
    return None, None, region


@dataclass
class PortalsConfig:
    companies: list[WatchedCompany] = field(default_factory=list)
    positive: list[str] = field(default_factory=list)
    negative: list[str] = field(default_factory=list)
    seniority_boost: list[str] = field(default_factory=list)

    def default_search(
        self,
        keywords: list[str] | None = None,
        locations: list[str] | None = None,
        **overrides: Any,
    ) -> SearchSpec:
        """A default SearchSpec seeded with the portals.yml title filters.

        JobSpy search terms default to a handful of the positive keywords
        (each one is a separate query per site, so keep it small).
        """
        kws = keywords or self.positive[:3]
        return SearchSpec(
            name="Default (imported from portals.yml)",
            keywords=kws,
            locations=locations or ["India"],
            title_include=list(self.positive),
            title_exclude=list(self.negative),
            **overrides,
        )


def _str_list(v: Any) -> list[str]:
    return [str(x).strip() for x in (v or []) if x is not None and str(x).strip()]


def parse_portals(data: dict[str, Any], include_disabled: bool = True) -> PortalsConfig:
    tf = data.get("title_filter") or {}
    cfg = PortalsConfig(
        positive=_str_list(tf.get("positive")),
        negative=_str_list(tf.get("negative")),
        seniority_boost=_str_list(tf.get("seniority_boost")),
    )
    seen: set[str] = set()
    for entry in data.get("tracked_companies") or []:
        if not isinstance(entry, dict) or not entry.get("name"):
            continue
        enabled = entry.get("enabled", True) is not False
        if not enabled and not include_disabled:
            continue
        name = str(entry["name"]).strip()
        careers_url = entry.get("careers_url")
        ats, token, region = detect_ats(entry.get("api"))
        c_ats, c_token, c_region = detect_ats(careers_url)
        if not ats:
            ats, token = c_ats, c_token
        # careers on job-boards.eu.greenhouse.io -> try the EU API host first
        if c_region == "eu" and c_ats == ats:
            region = "eu"
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        cfg.companies.append(
            WatchedCompany(
                company=name,
                ats=ats,
                board_token=token,
                careers_url=careers_url,
                enabled=enabled,
                region=region,  # type: ignore[arg-type]
            )
        )
    return cfg


def load_portals(path: str | Path, include_disabled: bool = True) -> PortalsConfig:
    with open(path, encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    return parse_portals(data, include_disabled=include_disabled)
