"""Database access for the shared job supply (company_watchlist, job_observations,
source_runs, job_supply_settings) and fan-out of matches. Used by the
`fetch_watchlist` handler. Every write is batched: no per-row round trips.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .fanout import PlannedMatch, SearchTarget, WatcherTarget
from .fetchers.models import NormalizedPosting, WatchedCompany
from .fetchers.portals import detect_ats
from .jobs_db import UPSERT_POSTING_SQL, _posting_params

DEFAULT_SETTINGS: dict[str, Any] = {
    "fanout_enabled": False,
    "per_user_watchlist": True,
    "priority_interval_minutes": 30,
    "standard_interval_hours": 24,
    "boards_per_run": 120,
    "max_matches_per_user_run": 100,
}


@dataclass(frozen=True)
class Board:
    """One board to fetch this run: a shared watchlist entry or a user-watched board."""

    company: str
    ats: str
    board_token: str
    country: str | None = None  # None for user-only boards
    priority: int = 2
    careers_url: str | None = None
    shared: bool = True

    @property
    def key(self) -> str:
        return f"{self.ats}:{self.board_token}"

    def to_watched(self) -> WatchedCompany:
        _, _, region = detect_ats(self.careers_url)
        return WatchedCompany(
            company=self.company, ats=self.ats, board_token=self.board_token,  # type: ignore[arg-type]
            careers_url=self.careers_url, region=region,  # type: ignore[arg-type]
        )


@dataclass
class BoardResult:
    board: Board
    fetched: int = 0
    postings: list[NormalizedPosting] = field(default_factory=list)
    error: str | None = None


async def _rows(conn: AsyncConnection, sql: str, params: Any = None) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchall()


# --------------------------------------------------------------------------- #
# Settings + boards
# --------------------------------------------------------------------------- #


async def load_supply_settings(conn: AsyncConnection) -> dict[str, Any]:
    rows = await _rows(conn, "SELECT * FROM job_supply_settings WHERE id = 1")
    return {**DEFAULT_SETTINGS, **(rows[0] if rows else {})}


CLAIM_BOARDS_SQL = """
WITH due AS (
    SELECT id FROM company_watchlist
     WHERE active
       AND (last_fetched_at IS NULL
            OR (priority = 1 AND last_fetched_at < now() - make_interval(mins => %(prio_min)s))
            OR (priority <> 1 AND last_fetched_at < now() - make_interval(hours => %(std_hours)s)))
     ORDER BY priority, last_fetched_at NULLS FIRST
     LIMIT %(limit)s
     FOR UPDATE SKIP LOCKED
)
UPDATE company_watchlist c
   SET last_fetched_at = now()
  FROM due
 WHERE c.id = due.id
RETURNING c.name, c.ats, c.board_token, c.country, c.priority
"""


async def claim_due_boards(conn: AsyncConnection, settings: dict[str, Any]) -> list[Board]:
    """Mark due shared boards as fetched now (so overlapping runs skip them) and return them,
    priority boards first."""
    rows = await _rows(conn, CLAIM_BOARDS_SQL, {
        "prio_min": int(settings["priority_interval_minutes"]),
        "std_hours": int(settings["standard_interval_hours"]),
        "limit": int(settings["boards_per_run"]),
    })
    boards = [Board(company=r["name"], ats=r["ats"], board_token=r["board_token"], country=r["country"],
                    priority=r["priority"]) for r in rows]
    return sorted(boards, key=lambda b: b.priority)


USER_BOARDS_SQL = """
SELECT w.ats, w.board_token, min(w.company) AS company, min(w.careers_url) AS careers_url
  FROM watched_companies w
 WHERE w.enabled
   AND NOT EXISTS (SELECT 1 FROM company_watchlist c
                    WHERE c.active AND c.ats = w.ats AND lower(c.board_token) = lower(w.board_token))
   AND NOT EXISTS (SELECT 1 FROM source_runs r
                    WHERE r.source = w.ats AND r.source_board = w.board_token
                      AND r.started_at > now() - make_interval(hours => %(std_hours)s))
 GROUP BY w.ats, w.board_token
 ORDER BY w.ats, w.board_token
 LIMIT %(limit)s
"""


async def load_user_boards(conn: AsyncConnection, settings: dict[str, Any], limit: int) -> list[Board]:
    """Users' own watched boards not on the shared list and not fetched within the daily interval."""
    if limit <= 0:
        return []
    rows = await _rows(conn, USER_BOARDS_SQL, {"std_hours": int(settings["standard_interval_hours"]),
                                               "limit": limit})
    return [Board(company=r["company"], ats=r["ats"], board_token=r["board_token"],
                  careers_url=r["careers_url"], shared=False) for r in rows]


# --------------------------------------------------------------------------- #
# Fan-out targets
# --------------------------------------------------------------------------- #


async def load_search_targets(conn: AsyncConnection) -> list[SearchTarget]:
    rows = await _rows(conn, """
        SELECT id, user_id, keywords, include_keywords, exclude_keywords, country, remote_ok
          FROM job_searches
         WHERE enabled AND cardinality(keywords) > 0
    """)
    return [
        SearchTarget(
            user_id=str(r["user_id"]), search_id=str(r["id"]),
            keywords=tuple(k for k in r["keywords"] or [] if k.strip()),
            include=tuple(k for k in r["include_keywords"] or [] if k.strip()),
            exclude=tuple(k for k in r["exclude_keywords"] or [] if k.strip()),
            country=(r["country"] or "US").upper(), remote_ok=bool(r["remote_ok"]),
        )
        for r in rows
    ]


WATCHERS_SQL = """
SELECT w.ats || ':' || w.board_token AS board_key, w.user_id,
       COALESCE(f.inc, '{}') AS include, COALESCE(f.exc, '{}') AS exclude
  FROM watched_companies w
  LEFT JOIN LATERAL (
        SELECT array_agg(DISTINCT i) FILTER (WHERE i IS NOT NULL) AS inc,
               array_agg(DISTINCT e) FILTER (WHERE e IS NOT NULL) AS exc
          FROM job_searches s
          LEFT JOIN LATERAL unnest(s.include_keywords) AS i ON TRUE
          LEFT JOIN LATERAL unnest(s.exclude_keywords) AS e ON TRUE
         WHERE s.user_id = w.user_id AND s.enabled
  ) f ON TRUE
 WHERE w.enabled AND (w.ats || ':' || w.board_token) = ANY(%s)
"""


async def load_watchers(conn: AsyncConnection, board_keys: Sequence[str]) -> dict[str, list[WatcherTarget]]:
    """Users who watch these boards, with the union of their searches' title filters."""
    if not board_keys:
        return {}
    out: dict[str, list[WatcherTarget]] = {}
    for r in await _rows(conn, WATCHERS_SQL, (list(board_keys),)):
        out.setdefault(r["board_key"], []).append(
            WatcherTarget(user_id=str(r["user_id"]), include=tuple(r["include"]), exclude=tuple(r["exclude"]))
        )
    return out


# --------------------------------------------------------------------------- #
# Postings + observations
# --------------------------------------------------------------------------- #


def raw_hash(p: NormalizedPosting) -> str:
    body = json.dumps(
        {"t": p.title, "l": p.location, "d": p.description, "u": p.url, "r": p.raw},
        sort_keys=True, default=str,
    )
    return hashlib.sha1(body.encode("utf-8")).hexdigest()


async def upsert_postings(
    conn: AsyncConnection, postings: Sequence[NormalizedPosting]
) -> tuple[dict[str, UUID], set[str]]:
    """Upsert unique postings by dedupe_key in one batch.
    Returns ({dedupe_key: id}, dedupe keys that were newly inserted)."""
    unique: dict[str, dict[str, Any]] = {}
    for p in postings:
        params = _posting_params(p)
        unique.setdefault(params["dedupe_key"], params)
    if not unique:
        return {}, set()
    ids: dict[str, UUID] = {}
    inserted: set[str] = set()
    keys = list(unique)
    async with conn.cursor() as cur:
        await cur.executemany(UPSERT_POSTING_SQL, [unique[k] for k in keys], returning=True)
        for key in keys:
            row = await cur.fetchone()
            if row is not None:
                ids[key] = row[0]
                if row[1]:
                    inserted.add(key)
            if not cur.nextset():
                break
    return ids, inserted


OBSERVATION_SQL = """
INSERT INTO job_observations AS o (job_posting_id, source, source_board, external_id, url, raw_hash)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (source, source_board, external_id) DO UPDATE SET
    job_posting_id = EXCLUDED.job_posting_id,
    url            = EXCLUDED.url,
    fetched_at     = now(),
    seen_count     = o.seen_count + 1,
    changed_at     = CASE WHEN o.raw_hash = EXCLUDED.raw_hash THEN o.changed_at ELSE now() END,
    raw_hash       = EXCLUDED.raw_hash
"""


def observation_rows(
    results: Iterable[BoardResult], ids: dict[str, UUID]
) -> list[tuple[UUID, str, str, str, str, str]]:
    rows: dict[tuple[str, str, str], tuple[UUID, str, str, str, str, str]] = {}
    for res in results:
        for p in res.postings:
            pid = ids.get(p.dedupe_key())
            ext = p.external_id or p.url
            if pid is None or not ext:
                continue
            rows[(p.source, res.board.board_token, ext)] = (
                pid, p.source, res.board.board_token, ext, p.url, raw_hash(p),
            )
    return list(rows.values())


async def record_observations(conn: AsyncConnection, rows: Sequence[tuple[Any, ...]]) -> int:
    if rows:
        async with conn.cursor() as cur:
            await cur.executemany(OBSERVATION_SQL, rows)
    return len(rows)


BOARD_STATUS_SQL = """
UPDATE company_watchlist c
   SET last_success_at      = CASE WHEN u.err IS NULL THEN now() ELSE c.last_success_at END,
       last_error           = u.err,
       consecutive_failures = CASE WHEN u.err IS NULL THEN 0 ELSE c.consecutive_failures + 1 END
  FROM unnest(%s::text[], %s::text[], %s::text[]) AS u(ats, token, err)
 WHERE c.ats = u.ats AND c.board_token = u.token
"""

SOURCE_RUNS_SQL = """
INSERT INTO source_runs (task_id, source, source_board, fetched, kept, new_postings, error)
SELECT %s, * FROM unnest(%s::text[], %s::text[], %s::int[], %s::int[], %s::int[], %s::text[])
"""


async def record_board_results(
    conn: AsyncConnection, task_id: UUID | None, results: Sequence[BoardResult], new_by_board: dict[str, int]
) -> None:
    shared = [r for r in results if r.board.shared]
    if shared:
        await conn.execute(BOARD_STATUS_SQL, (
            [r.board.ats for r in shared], [r.board.board_token for r in shared],
            [r.error[:500] if r.error else None for r in shared],
        ))
    if results:
        await conn.execute(SOURCE_RUNS_SQL, (
            task_id,
            [r.board.ats for r in results], [r.board.board_token for r in results],
            [r.fetched for r in results], [len(r.postings) for r in results],
            [new_by_board.get(r.board.key, 0) for r in results],
            [r.error[:500] if r.error else None for r in results],
        ))


# --------------------------------------------------------------------------- #
# Matches + ranking
# --------------------------------------------------------------------------- #

INSERT_MATCHES_SQL = """
INSERT INTO job_matches AS m (user_id, job_posting_id, search_id, status, prefilter_pass)
SELECT u.user_id, u.posting_id, u.search_id, 'new', NULL
  FROM unnest(%s::uuid[], %s::uuid[], %s::uuid[]) AS u(user_id, posting_id, search_id)
ON CONFLICT (user_id, job_posting_id) DO UPDATE
    SET status = 'new', prefilter_pass = NULL
  WHERE m.status = 'expired'
RETURNING m.user_id, (xmax = 0) AS inserted
"""


async def insert_matches(conn: AsyncConnection, matches: Sequence[PlannedMatch]) -> tuple[int, int, list[str]]:
    """Create (or revive expired) matches in one statement.
    Returns (created, revived, user ids that got new work)."""
    if not matches:
        return 0, 0, []
    cur = await conn.execute(INSERT_MATCHES_SQL, (
        [m.user_id for m in matches], [m.posting_id for m in matches], [m.search_id for m in matches],
    ))
    rows = await cur.fetchall()
    created = sum(1 for r in rows if r[1])
    return created, len(rows) - created, sorted({str(r[0]) for r in rows})


ENQUEUE_RANK_MANY_SQL = """
INSERT INTO tasks (type, payload, user_id)
SELECT 'rank_jobs', jsonb_build_object('user_id', u::text), u
  FROM unnest(%s::uuid[]) AS u
 WHERE NOT EXISTS (SELECT 1 FROM tasks t
                    WHERE t.type = 'rank_jobs' AND t.user_id = u AND t.status = 'queued')
"""


async def enqueue_rank_for_users(conn: AsyncConnection, user_ids: Sequence[str]) -> int:
    if not user_ids:
        return 0
    cur = await conn.execute(ENQUEUE_RANK_MANY_SQL, (list(user_ids),))
    return cur.rowcount
