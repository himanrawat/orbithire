"""Job fetchers (pure: no DB access).

Public API used by the `fetch_jobs` handler:

    await fetch_search(spec: SearchSpec) -> FetchResult      # JobSpy boards + job APIs
    await fetch_company(company: WatchedCompany) -> FetchResult  # ATS boards
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Callable, Iterable, Mapping
from typing import Any

import httpx

from .ats import AtsError, fetch_ats, html_to_text
from .ats_more import enrich_smartrecruiters
from .countries import COUNTRIES, UnsupportedCountry, country_info, split_sites
from .filters import title_matches
from .jobspy_source import scrape_search
from .models import (
    ATS_NAMES,
    FetchResult,
    NormalizedPosting,
    SearchSpec,
    WatchedCompany,
    normalize_location,
)
from .portals import PortalsConfig, detect_ats, load_portals, parse_portals
from .source_registry import SOURCES, attribution_for, policy_block
from .sources import API_SOURCE_ENV, API_SOURCES, fetch_api_sources

__all__ = [
    "API_SOURCES",
    "API_SOURCE_ENV",
    "ATS_NAMES",
    "AtsError",
    "COUNTRIES",
    "UnsupportedCountry",
    "country_info",
    "fetch_api_sources",
    "FetchResult",
    "NormalizedPosting",
    "PortalsConfig",
    "SOURCES",
    "SearchSpec",
    "WatchedCompany",
    "attribution_for",
    "dedupe",
    "detect_ats",
    "fetch_company",
    "fetch_search",
    "html_to_text",
    "load_portals",
    "parse_portals",
    "policy_block",
    "title_matches",
]


def dedupe(postings: Iterable[NormalizedPosting]) -> tuple[list[NormalizedPosting], int]:
    """In-batch dedupe by dedupe_key; keeps the first, upgrading to one with a
    description / salary if a later duplicate has it. Returns (unique, dropped)."""
    by_key: dict[str, NormalizedPosting] = {}
    dropped = 0
    for p in postings:
        key = p.dedupe_key()
        cur = by_key.get(key)
        if cur is None:
            by_key[key] = p
            continue
        dropped += 1
        score = lambda x: (bool(x.description), x.salary_min is not None)  # noqa: E731
        if score(p) > score(cur):
            by_key[key] = p
    return list(by_key.values()), dropped


def gate_sites(
    sites: list[str], env: Mapping[str, str]
) -> tuple[list[str], dict[str, str]]:
    """Drop JobSpy boards blocked by the production gates (source_registry)."""
    keep: list[str] = []
    skipped: dict[str, str] = {}
    for site in sites:
        why = policy_block(site, env)
        if why:
            skipped[site] = why
        else:
            keep.append(site)
    return keep, skipped


def _finish(
    postings: list[NormalizedPosting],
    include: list[str],
    exclude: list[str],
    remote_ok: bool = True,
) -> tuple[list[NormalizedPosting], int, int]:
    kept = []
    for p in postings:
        if not title_matches(p.title, include, exclude):
            continue
        if not remote_ok and normalize_location(p.location, p.is_remote) == "remote":
            continue
        kept.append(p)
    filtered = len(postings) - len(kept)
    unique, dupes = dedupe(kept)
    return unique, filtered, dupes


async def fetch_search(
    spec: SearchSpec,
    *,
    scrape: Callable[..., Any] | None = None,
    client: httpx.AsyncClient | None = None,
    env: Mapping[str, str] | None = None,
    **kwargs: Any,
) -> FetchResult:
    """Run a search: JobSpy boards (sequential, in a worker thread) concurrently
    with the API sources (bounded concurrency). Never raises for source failures;
    see `FetchResult.errors` / `.skipped` (keyed by site / source id)."""
    try:
        country_info(spec.country)
    except UnsupportedCountry as e:
        return FetchResult(errors={"country": str(e)})
    sites, skipped = split_sites(list(spec.sites), spec.country)
    sites, gated = gate_sites(sites, os.environ if env is None else env)
    skipped.update(gated)

    async def jobspy() -> FetchResult:
        if not sites:
            return FetchResult()
        res = await asyncio.to_thread(
            scrape_search, spec.model_copy(update={"sites": sites}), scrape=scrape, **kwargs
        )
        return FetchResult(postings=res.postings, errors=res.errors, counts=res.counts)

    async def apis() -> FetchResult:
        if not spec.sources:
            return FetchResult()
        return await fetch_api_sources(spec, client=client, env=env)

    a, b = await asyncio.gather(jobspy(), apis())
    raw = a.postings + b.postings
    postings, filtered, dupes = _finish(raw, spec.title_include, spec.title_exclude, spec.remote_ok)
    return FetchResult(
        postings=postings,
        errors={**a.errors, **b.errors},
        counts={**a.counts, **b.counts},
        filtered_out=filtered,
        duplicates=dupes,
        skipped={**skipped, **b.skipped},
    )


async def fetch_company(
    company: WatchedCompany,
    *,
    include: list[str] | None = None,
    exclude: list[str] | None = None,
    client: httpx.AsyncClient | None = None,
) -> FetchResult:
    """Fetch a watched company's ATS board. Errors land in `errors[<ats or 'ats'>]`."""
    source = company.ats or "ats"
    try:
        raw = await fetch_ats(company, client=client)
    except AtsError as e:
        return FetchResult(errors={source: str(e)}, counts={source: 0})
    except httpx.HTTPError as e:
        return FetchResult(errors={source: f"{type(e).__name__}: {e}"}, counts={source: 0})
    postings, filtered, dupes = _finish(raw, include or [], exclude or [])
    if company.ats == "smartrecruiters" and company.board_token and postings:
        # list endpoint has no descriptions: fetch details for the kept ones (capped)
        if client is None:
            from .http import make_client

            async with make_client() as own:
                await enrich_smartrecruiters(own, company.board_token, postings)
        else:
            await enrich_smartrecruiters(client, company.board_token, postings)
    return FetchResult(
        postings=postings,
        counts={source: len(raw)},
        filtered_out=filtered,
        duplicates=dupes,
    )
