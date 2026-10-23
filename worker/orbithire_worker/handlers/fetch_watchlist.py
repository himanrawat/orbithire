"""`fetch_watchlist` task: fetch each due shared board once, store every source
observation, dedupe into job_postings and fan matches out to users.

payload: {"trigger": "cron" | "manual"} (informational)

Steps:
  1. claim due company_watchlist boards (priority boards every 30 min, others
     daily; job_supply_settings) and, when the legacy per-user watchlist path is
     off, users' own watched boards not fetched in the last day
  2. fetch them with bounded concurrency (no title filter: users filter later)
  3. upsert job_postings by dedupe_key, upsert job_observations, write source_runs
  4. plan fan-out (fanout.py) against every enabled job_search (+ board watchers)
  5. fanout_enabled: insert job_matches and enqueue rank_jobs for those users;
     otherwise shadow mode: only report how many matches would be created
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .. import fetchers, jobs_db, supply_db
from ..fanout import FanoutPosting, plan_fanout
from ..registry import Task, TaskContext, handler
from ..supply_db import Board, BoardResult

log = logging.getLogger(__name__)

BOARD_CONCURRENCY = 8


class FetchWatchlistError(RuntimeError):
    pass


async def fetch_boards(boards: list[Board], concurrency: int = BOARD_CONCURRENCY) -> list[BoardResult]:
    """Fetch every board once; one failing board never affects the others."""
    sem = asyncio.Semaphore(concurrency)
    client = fetchers.ats.make_client()

    async def one(board: Board) -> BoardResult:
        async with sem:
            try:
                res = await fetchers.fetch_company(board.to_watched(), client=client)
            except Exception as e:  # noqa: BLE001 - isolate boards
                return BoardResult(board=board, error=f"{type(e).__name__}: {e}"[:500])
            err = "; ".join(res.errors.values()) or None
            return BoardResult(board=board, fetched=sum(res.counts.values()), postings=res.postings, error=err)

    try:
        return await asyncio.gather(*(one(b) for b in boards))
    finally:
        await client.aclose()


def fanout_postings(results: list[BoardResult], ids: dict[str, Any]) -> list[FanoutPosting]:
    out: list[FanoutPosting] = []
    seen: set[str] = set()
    for res in results:
        for p in res.postings:
            key = p.dedupe_key()
            pid = ids.get(key)
            if pid is None or key in seen:
                continue
            seen.add(key)
            out.append(FanoutPosting(
                posting_id=str(pid), title=p.title, board_key=res.board.key,
                location=p.location, is_remote=p.is_remote, country=res.board.country,
            ))
    return out


def new_postings_by_board(results: list[BoardResult], inserted_keys: set[str]) -> dict[str, int]:
    return {
        r.board.key: sum(1 for p in r.postings if p.dedupe_key() in inserted_keys) for r in results
    }


async def _claim(ctx: TaskContext) -> tuple[dict[str, Any], list[Board]]:
    async with ctx.pool.connection() as conn:
        settings = await supply_db.load_supply_settings(conn)
        boards = await supply_db.claim_due_boards(conn, settings)
        if not settings["per_user_watchlist"]:
            room = int(settings["boards_per_run"]) - len(boards)
            boards += await supply_db.load_user_boards(conn, settings, room)
    return settings, boards


async def _store_and_fan_out(
    ctx: TaskContext, task: Task, settings: dict[str, Any], results: list[BoardResult]
) -> dict[str, Any]:
    all_postings = [p for r in results for p in r.postings]
    async with ctx.pool.connection() as conn:
        async with conn.transaction():
            ids, inserted_keys = await supply_db.upsert_postings(conn, all_postings)
            observed = await supply_db.record_observations(conn, supply_db.observation_rows(results, ids))
            await supply_db.record_board_results(conn, task.id, results, new_postings_by_board(results, inserted_keys))
        watchers = {} if settings["per_user_watchlist"] else await supply_db.load_watchers(
            conn, [r.board.key for r in results])
        searches = await supply_db.load_search_targets(conn)
        plan = plan_fanout(fanout_postings(results, ids), searches, watchers,
                           max_per_user=int(settings["max_matches_per_user_run"]))
        out: dict[str, Any] = {
            "postings_unique": len(ids), "postings_inserted": len(inserted_keys), "observations": observed,
            "matches_planned": len(plan.matches), "users_matched": len(plan.users),
            "matches_capped": sum(plan.capped.values()), "fanout": bool(settings["fanout_enabled"]),
        }
        if not settings["fanout_enabled"]:
            return out
        created, revived, users = await supply_db.insert_matches(conn, plan.matches)
        out.update(matches_created=created, matches_revived=revived,
                   rank_tasks_created=await supply_db.enqueue_rank_for_users(conn, users),
                   expired=await jobs_db.expire_stale(conn))
    return out


@handler("fetch_watchlist")
async def fetch_watchlist(task: Task, ctx: TaskContext) -> dict[str, Any]:
    settings, boards = await _claim(ctx)
    result: dict[str, Any] = {"boards": len(boards), "priority_boards": sum(b.priority == 1 for b in boards)}
    if not boards:
        return {**result, "skipped": "no boards due"}

    results = await fetch_boards(boards)  # network: no DB connection held
    failed = {r.board.key: r.error for r in results if r.error}
    result.update(
        fetched=sum(r.fetched for r in results), kept=sum(len(r.postings) for r in results),
        boards_failed=len(failed), errors=dict(list(failed.items())[:50]),
    )
    if len(failed) == len(results):
        async with ctx.pool.connection() as conn:
            await supply_db.record_board_results(conn, task.id, results, {})
        raise FetchWatchlistError(f"all {len(results)} boards failed: {list(failed.items())[:5]}"[:3000])

    result.update(await _store_and_fan_out(ctx, task, settings, results))
    log.info("fetch_watchlist boards=%d kept=%d inserted=%s planned=%s fanout=%s",
             len(boards), result["kept"], result.get("postings_inserted"),
             result.get("matches_planned"), result.get("fanout"))
    return result
