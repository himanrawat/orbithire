"""`fetch_jobs` task: fetch postings for one job_search or a user's ATS watchlist.

payload:
  {"user_id": <uuid>, "search_id": <uuid>}   JobSpy boards + API sources of that job_search
  {"user_id": <uuid>, "watchlist": true}     every enabled watched_company (ATS APIs)
  (+ informational "trigger": "cron" | "manual")

Steps: fetch (pure fetchers) -> upsert job_postings by dedupe_key -> create
job_matches (status 'new', prefilter_pass NULL) -> expire postings not seen for
14 days (their new/shortlisted matches -> 'expired') -> enqueue `rank_jobs`
with payload {"user_id"} (skipped if one is already queued for the user).

If every source failed and nothing was fetched the task raises (-> retry with
backoff); partial source failures are reported in the result. Sources skipped
for configuration reasons (missing API key, not available for the search's
country) and scrapers that were blocked or rate-limited never cause a retry.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any

from .. import fetchers, jobs_db
from ..fetchers import FetchResult, SearchSpec, WatchedCompany
from ..fetchers.sources import MISSING_KEY
from ..registry import Task, TaskContext, handler

log = logging.getLogger(__name__)

ATS_CONCURRENCY = 4


def source_env() -> dict[str, str]:
    """API keys for the job sources: process env, falling back to worker/.env
    (pydantic-settings reads .env for Settings but does not export it)."""
    from dotenv import dotenv_values

    file_vals: dict[str, str | None] = {}
    env_path = Path(".env")
    if env_path.is_file():
        file_vals = dotenv_values(env_path)
    out = {}
    for k in fetchers.API_SOURCE_ENV:
        v = os.environ.get(k) or file_vals.get(k)
        if v:
            out[k] = v
    return out


class FetchJobsError(RuntimeError):
    pass


def search_spec_from_row(row: dict[str, Any]) -> SearchSpec:
    return SearchSpec(
        name=row.get("name"),
        keywords=[k for k in (row.get("keywords") or []) if k.strip()],
        locations=[loc for loc in (row.get("locations") or []) if loc.strip()],
        sites=list(row.get("sites") or []),
        sources=list(row.get("sources") or []),
        country=(row.get("country") or "IN").upper(),
        remote_ok=bool(row.get("remote_ok", True)),
        hours_old=int(row.get("hours_old") or 24),
        results_wanted=int(row.get("results_wanted") or 20),
        title_include=list(row.get("include_keywords") or []),
        title_exclude=list(row.get("exclude_keywords") or []),
    )


async def fetch_watchlist(
    companies: list[WatchedCompany],
    include: list[str],
    exclude: list[str],
    concurrency: int = ATS_CONCURRENCY,
) -> tuple[FetchResult, dict[str, Any]]:
    """Fetch all companies with bounded concurrency; merge into one FetchResult."""
    sem = asyncio.Semaphore(concurrency)
    client = fetchers.ats.make_client()

    async def one(c: WatchedCompany) -> tuple[WatchedCompany, FetchResult]:
        async with sem:
            try:
                return c, await fetchers.fetch_company(
                    c, include=include, exclude=exclude, client=client
                )
            except Exception as e:  # noqa: BLE001 - never let one board kill the batch
                return c, FetchResult(errors={c.ats or "ats": f"{type(e).__name__}: {e}"})

    try:
        results = await asyncio.gather(*(one(c) for c in companies))
    finally:
        await client.aclose()

    merged = FetchResult()
    per_company: dict[str, Any] = {}
    for c, r in results:
        merged.postings.extend(r.postings)
        merged.filtered_out += r.filtered_out
        merged.duplicates += r.duplicates
        for src, n in r.counts.items():
            merged.counts[src] = merged.counts.get(src, 0) + n
        err = "; ".join(r.errors.values()) or None
        if err:
            merged.errors[c.company] = err
        per_company[c.company] = {
            "ats": c.ats,
            "fetched": sum(r.counts.values()),
            "kept": len(r.postings),
            **({"error": err} if err else {}),
        }
    unique, dupes = fetchers.dedupe(merged.postings)
    merged.postings = unique
    merged.duplicates += dupes
    return merged, per_company


@handler("fetch_jobs")
async def fetch_jobs(task: Task, ctx: TaskContext) -> dict[str, Any]:
    payload = task.payload or {}
    user_id = str(payload.get("user_id") or task.user_id or "")
    if not user_id:
        raise FetchJobsError("fetch_jobs: payload.user_id is required")
    search_id = payload.get("search_id")
    watchlist = bool(payload.get("watchlist"))
    if not search_id and not watchlist:
        raise FetchJobsError("fetch_jobs: payload needs search_id or watchlist=true")

    result: dict[str, Any] = {"user_id": user_id}
    async with ctx.pool.connection() as conn:
        if search_id:
            row = await jobs_db.load_search(conn, user_id, str(search_id))
            if row is None:
                return {**result, "skipped": "search not found", "search_id": str(search_id)}
            spec = search_spec_from_row(row)
            result.update(kind="search", search_id=str(search_id), search_name=row.get("name"))
            if not spec.keywords or not (spec.sites or spec.sources):
                return {**result, "skipped": "search has no keywords or sources"}
            result["country"] = spec.country
        else:
            companies = await jobs_db.load_watchlist(conn, user_id)
            include, exclude = await jobs_db.load_title_filters(conn, user_id)
            result.update(kind="watchlist", companies_total=len(companies))
            if not companies:
                return {**result, "skipped": "no enabled watched companies"}

    # Network part: no DB connection held.
    if search_id:
        fetched = await fetchers.fetch_search(spec, env=source_env())
        result["sources"] = {
            s: {
                "fetched": fetched.counts.get(s, 0),
                **({"error": fetched.errors[s]} if s in fetched.errors else {}),
                **({"skipped": fetched.skipped[s]} if s in fetched.skipped else {}),
            }
            for s in sorted(set(fetched.counts) | set(fetched.errors) | set(fetched.skipped))
        }
    else:
        fetched, per_company = await fetch_watchlist(companies, include, exclude)
        result["sources"] = {
            src: {"fetched": n} for src, n in sorted(fetched.counts.items())
        }
        result["companies"] = per_company
        result["companies_failed"] = sum(1 for v in per_company.values() if "error" in v)
    result["errors"] = fetched.errors
    if fetched.skipped:
        result["skipped_sources"] = fetched.skipped
    result["filtered_out"] = fetched.filtered_out
    result["duplicates_in_batch"] = fetched.duplicates
    result["postings_kept"] = len(fetched.postings)

    raw_total = sum(fetched.counts.values())
    if fetched.errors and raw_total == 0 and not fetched.postings:
        if search_id:
            # config problems (missing key / bad country) and scrapers that were
            # blocked or rate-limited (403/429, bot challenge) won't fix themselves
            # on a quick retry
            real = {
                s: v for s, v in result["sources"].items()
                if "skipped" not in v
                and not str(v.get("error", "")).startswith((MISSING_KEY, "blocked:", "stopped:"))
                and s != "country"
            }
            all_failed = bool(real) and all("error" in v for v in real.values())
        else:
            all_failed = result["companies_failed"] == len(companies)
        if all_failed:
            raise FetchJobsError(f"all sources failed: {fetched.errors}"[:3000])

    async with ctx.pool.connection() as conn:
        stats = await jobs_db.upsert_postings_and_matches(
            conn, user_id, str(search_id) if search_id else None, fetched.postings
        )
        result.update(stats.as_dict())
        result["expired"] = await jobs_db.expire_stale(conn)
        rank_id, created = await jobs_db.enqueue_rank_jobs(conn, user_id)
        result["rank_task_id"] = str(rank_id) if rank_id else None
        result["rank_task_created"] = created

    log.info(
        "fetch_jobs %s user=%s kept=%d new_postings=%d new_matches=%d errors=%s",
        result.get("kind"), user_id, len(fetched.postings), stats.postings_inserted,
        stats.matches_created, list(fetched.errors),
    )
    return result
