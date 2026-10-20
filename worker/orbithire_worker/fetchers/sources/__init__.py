"""Tier 1 job APIs (official / free), selected per job_search via `sources`.

    await fetch_api_sources(spec, client=..., env=...) -> FetchResult

Every source is isolated: a missing key, an unsupported country or a failure
only affects its own entry (`errors[source]` / `skipped[source]`). Sources run
concurrently (API_CONCURRENCY), each bounded by MAX_QUERIES requests and its
own timeout. Keep ids in sync with API_SOURCES in lib/jobs/types.ts and the
job_searches.sources CHECK constraint (migration 025).
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import Mapping

import httpx

from ..countries import country_info, default_location
from ..http import make_client
from ..models import FetchResult, SearchSpec
from . import (
    adzuna,
    arbeitnow,
    bundesagentur,
    himalayas,
    jobicy,
    jooble,
    mycareersfuture,
    reed,
    remoteok,
    remotive,
    usajobs,
)
from .base import SourceDef, SourceOutput, SourceQuery, remote_eligible

log = logging.getLogger(__name__)

__all__ = [
    "API_SOURCES",
    "API_SOURCE_ENV",
    "SourceDef",
    "SourceQuery",
    "build_query",
    "fetch_api_sources",
    "remote_eligible",
]

API_CONCURRENCY = 4

API_SOURCES: dict[str, SourceDef] = {
    m.SOURCE.id: m.SOURCE
    for m in (
        adzuna, jooble, reed, bundesagentur, arbeitnow, mycareersfuture, usajobs,
        remotive, remoteok, himalayas, jobicy,
    )
}

# Every env var any source reads (for .env loading in the handler).
API_SOURCE_ENV: tuple[str, ...] = tuple(sorted({e for s in API_SOURCES.values() for e in s.env}))

MISSING_KEY = "missing API key"


def build_query(spec: SearchSpec, env: Mapping[str, str]) -> SourceQuery:
    info = country_info(spec.country)
    return SourceQuery(
        keywords=list(spec.keywords),
        locations=list(spec.locations) or [default_location(info.code)],
        country=info,
        hours_old=spec.hours_old,
        results_wanted=spec.results_wanted,
        remote_ok=spec.remote_ok,
        env=env,
    )


async def _run_one(
    src: SourceDef, client: httpx.AsyncClient, q: SourceQuery, sem: asyncio.Semaphore
) -> tuple[str, SourceOutput | None, str | None]:
    async with sem:
        try:
            out = await asyncio.wait_for(src.fetch(client, q), timeout=src.timeout)
        except TimeoutError:
            return src.id, None, f"timed out after {src.timeout:.0f}s"
        except Exception as e:  # noqa: BLE001 - per-source isolation
            log.warning("source %s failed: %s", src.id, e)
            return src.id, None, f"{type(e).__name__}: {e}"[:1000]
    for p in out.postings:
        p.raw.setdefault("orbithire_country", q.country.code)
    return src.id, out, ("; ".join(out.errors)[:1000] if out.errors else None)


async def fetch_api_sources(
    spec: SearchSpec,
    *,
    client: httpx.AsyncClient | None = None,
    env: Mapping[str, str] | None = None,
    concurrency: int = API_CONCURRENCY,
) -> FetchResult:
    """Raw (unfiltered, not deduped) postings from spec.sources."""
    env = os.environ if env is None else env
    q = build_query(spec, env)
    res = FetchResult()
    runnable: list[SourceDef] = []
    for sid in dict.fromkeys(spec.sources):
        src = API_SOURCES.get(sid)
        if src is None:
            res.skipped[sid] = "unknown source"
        elif src.countries is not None and q.country.code not in src.countries:
            res.skipped[sid] = f"not available for {q.country.name}"
        elif src.remote_only and not spec.remote_ok:
            res.skipped[sid] = "remote-only board (remote jobs excluded)"
        elif missing := [e for e in src.env if not (env.get(e) or "").strip()]:
            res.errors[sid] = f"{MISSING_KEY} ({', '.join(missing)})"
            res.counts[sid] = 0
        else:
            runnable.append(src)
    if not runnable:
        return res

    own = client is None
    client = client or make_client()
    sem = asyncio.Semaphore(concurrency)
    try:
        results = await asyncio.gather(*(_run_one(s, client, q, sem) for s in runnable))
    finally:
        if own:
            await client.aclose()
    for sid, out, err in results:
        res.counts[sid] = out.raw_count if out else 0
        if out:
            res.postings.extend(out.postings)
        if err:
            res.errors[sid] = err
    return res
