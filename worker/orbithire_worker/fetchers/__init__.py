"""Job fetchers (pure: no DB access).

Public API used by the Wave 2 `fetch_jobs` handler:

    await fetch_search(spec: SearchSpec) -> FetchResult      # JobSpy boards
    await fetch_company(company: WatchedCompany) -> FetchResult  # ATS APIs
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Iterable
from typing import Any

import httpx

from .ats import AtsError, fetch_ats, html_to_text
from .filters import title_matches
from .jobspy_source import scrape_search
from .models import (
    FetchResult,
    NormalizedPosting,
    SearchSpec,
    WatchedCompany,
    normalize_location,
)
from .portals import PortalsConfig, detect_ats, load_portals, parse_portals

__all__ = [
    "AtsError",
    "FetchResult",
    "NormalizedPosting",
    "PortalsConfig",
    "SearchSpec",
    "WatchedCompany",
    "dedupe",
    "detect_ats",
    "fetch_company",
    "fetch_search",
    "html_to_text",
    "load_portals",
    "parse_portals",
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
    spec: SearchSpec, *, scrape: Callable[..., Any] | None = None, **kwargs: Any
) -> FetchResult:
    """Run a JobSpy search (in a worker thread). Never raises for site failures;
    see `FetchResult.errors` (keyed by site)."""
    res = await asyncio.to_thread(scrape_search, spec, scrape=scrape, **kwargs)
    postings, filtered, dupes = _finish(
        res.postings, spec.title_include, spec.title_exclude, spec.remote_ok
    )
    return FetchResult(
        postings=postings,
        errors=res.errors,
        counts=res.counts,
        filtered_out=filtered,
        duplicates=dupes,
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
    return FetchResult(
        postings=postings,
        counts={source: len(raw)},
        filtered_out=filtered,
        duplicates=dupes,
    )
