"""Shared types for the Tier 1 job APIs (one module per source in this package)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from ..countries import CountryInfo, is_country_name
from ..models import NormalizedPosting

# Per-source bounds so a whole search run stays well under the 5-minute fetch timeout.
MAX_QUERIES = 4  # keyword x location pairs per source
MAX_PER_QUERY = 50  # results per query (results_wanted is capped to this)
# Feed-style boards (no server-side date filter, or delayed like Remotive's 24h):
# accept postings up to this much older than hours_old (DB upsert dedupes repeats).
FEED_GRACE_HOURS = 48


@dataclass
class SourceQuery:
    keywords: list[str]
    locations: list[str]  # never empty: defaults to the country name
    country: CountryInfo
    hours_old: int = 24
    results_wanted: int = 20
    remote_ok: bool = True
    env: Mapping[str, str] = field(default_factory=dict)

    @property
    def per_query(self) -> int:
        return max(1, min(self.results_wanted, MAX_PER_QUERY))

    @property
    def days_old(self) -> int:
        return max(1, -(-self.hours_old // 24))

    def cities(self) -> list[str | None]:
        """Locations with the bare country name mapped to None (= whole country)."""
        out: list[str | None] = []
        for loc in self.locations or [None]:
            v = None if is_country_name(loc, self.country.code) else loc
            if v not in out:
                out.append(v)
        return out or [None]

    def pairs(self, with_location: bool = True, limit: int = MAX_QUERIES) -> list[tuple[str, str | None]]:
        locs = self.cities() if with_location else [None]
        return [(k, loc) for k in self.keywords for loc in locs][:limit]

    def cutoff(self, grace_hours: int = FEED_GRACE_HOURS) -> datetime:
        return datetime.now(UTC) - timedelta(hours=self.hours_old + grace_hours)


@dataclass
class SourceOutput:
    postings: list[NormalizedPosting] = field(default_factory=list)
    raw_count: int = 0
    errors: list[str] = field(default_factory=list)  # partial (per-query) failures
    # set (with no postings / errors) when the source chose not to query, e.g. every
    # path disallowed by robots.txt -> FetchResult.skipped[id]
    skipped: str | None = None


FetchFn = Callable[[httpx.AsyncClient, SourceQuery], Awaitable[SourceOutput]]


@dataclass(frozen=True)
class SourceDef:
    id: str
    label: str
    fetch: FetchFn
    # ISO-2 countries served; None = any country
    countries: frozenset[str] | None = None
    # env vars that must all be set (else errors[id] = "missing API key ...")
    env: tuple[str, ...] = ()
    remote_only: bool = False
    # extra seconds of budget (feeds that page through big payloads)
    timeout: float = 90.0
    # Tier 3 scraper (opt-in; JOB_SCRAPERS_ENABLED / SCRAPER_DISABLE apply)
    scraper: bool = False
    # set when the source can't work with plain HTTP: always skipped with this reason
    blocked: str | None = None


async def run_queries(
    pairs: list[tuple[str, str | None]],
    one: Callable[[str, str | None], Awaitable[tuple[list[NormalizedPosting], int]]],
) -> SourceOutput:
    """Run per-(keyword, location) queries sequentially (they share one host);
    per-query errors are collected. Raises the last error if every query failed."""
    out = SourceOutput()
    last: Exception | None = None
    ok = 0
    for kw, loc in pairs:
        try:
            postings, raw = await one(kw, loc)
        except Exception as e:  # noqa: BLE001 - isolate queries
            last = e
            out.errors.append(f"{kw!r}@{loc or 'any'}: {e}")
            continue
        ok += 1
        out.postings.extend(postings)
        out.raw_count += raw
    if ok == 0 and last is not None:
        raise last
    return out


def recent(postings: list[NormalizedPosting], q: SourceQuery, grace_hours: int = FEED_GRACE_HOURS) -> list[NormalizedPosting]:
    cut = q.cutoff(grace_hours)
    return [p for p in postings if p.posted_at is None or p.posted_at >= cut]


_REGION_WORDS = {
    "europe": ("europe", "emea", "eu ", "eea", "cet", "cest"),
    "uk": ("europe", "emea", "uk", "united kingdom", "gmt", "bst"),
    "india": ("apac", "asia", "india", "ist"),
    "apac": ("apac", "asia", "oceania", "anz"),
    "north_america": ("americas", "north america", "usa", "us ", "u.s.", "canada"),
}
_ANYWHERE = ("worldwide", "anywhere", "global", "remote", "")


def remote_eligible(location: str | None, country: CountryInfo) -> bool:
    """Is a remote job restricted to `location` (e.g. Remotive's
    candidate_required_location) open to candidates in `country`?"""
    loc = f" {(location or '').strip().lower()} "
    if loc.strip() in _ANYWHERE:
        return True
    names = {country.name.lower(), country.jobspy.lower(), country.code.lower()}
    if country.code == "GB":
        names |= {"uk", "united kingdom", "britain"}
    if country.code == "US":
        names |= {"usa", "united states", "us"}
    if any(f" {n} " in loc or f" {n}," in loc or f",{n} " in loc or n in loc and len(n) > 3 for n in names):
        return True
    if any(w in loc for w in ("worldwide", "anywhere", "global")):
        return True
    return any(w in loc for w in _REGION_WORDS.get(country.region, ()))


def compact_raw(job: Mapping[str, Any], drop: tuple[str, ...] = ("description",)) -> dict[str, Any]:
    return {k: v for k, v in job.items() if k not in drop}
