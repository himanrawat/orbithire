"""Database access for job ingestion (job_searches, watched_companies,
job_postings, job_matches). Used by the `fetch_jobs` handler and the
`import_portals` CLI. All functions take an open psycopg connection (service role).
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .fetchers.models import NormalizedPosting, WatchedCompany
from .fetchers.portals import PortalsConfig, detect_ats

EXPIRE_AFTER_DAYS = 14
# Mirrors the enforce_job_search_limit() trigger (migration 025) and
# MAX_JOB_SEARCHES in lib/jobs/types.ts.
MAX_JOB_SEARCHES = 3


# --------------------------------------------------------------------------- #
# Loading searches / watchlist
# --------------------------------------------------------------------------- #


async def load_search(conn: AsyncConnection, user_id: str, search_id: str) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT * FROM job_searches WHERE id = %s AND user_id = %s", (search_id, user_id)
        )
        return await cur.fetchone()


async def load_watchlist(conn: AsyncConnection, user_id: str) -> list[WatchedCompany]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """SELECT company, ats, board_token, careers_url
                 FROM watched_companies
                WHERE user_id = %s AND enabled
                ORDER BY company""",
            (user_id,),
        )
        rows = await cur.fetchall()
    out = []
    for r in rows:
        # watched_companies has no region column: EU Greenhouse/Lever boards are
        # recognised from their careers URL (job-boards.eu.greenhouse.io/...).
        _, _, region = detect_ats(r["careers_url"])
        out.append(
            WatchedCompany(
                company=r["company"],
                ats=r["ats"],
                board_token=r["board_token"],
                careers_url=r["careers_url"],
                region=region,  # type: ignore[arg-type]
            )
        )
    return out


async def load_title_filters(conn: AsyncConnection, user_id: str) -> tuple[list[str], list[str]]:
    """Union of include/exclude title keywords over the user's enabled searches
    (used to filter watchlist boards, which return every open job)."""
    async with conn.cursor() as cur:
        await cur.execute(
            """SELECT COALESCE(array_agg(DISTINCT i) FILTER (WHERE i IS NOT NULL), '{}'),
                      COALESCE(array_agg(DISTINCT e) FILTER (WHERE e IS NOT NULL), '{}')
                 FROM job_searches s
                 LEFT JOIN LATERAL unnest(s.include_keywords) AS i ON TRUE
                 LEFT JOIN LATERAL unnest(s.exclude_keywords) AS e ON TRUE
                WHERE s.user_id = %s AND s.enabled""",
            (user_id,),
        )
        row = await cur.fetchone()
    return (list(row[0]) if row else [], list(row[1]) if row else [])


# --------------------------------------------------------------------------- #
# Postings + matches
# --------------------------------------------------------------------------- #

UPSERT_POSTING_SQL = """
INSERT INTO job_postings AS jp (
    dedupe_key, source, external_id, url, title, company, location, is_remote,
    salary_min, salary_max, currency, salary_interval, description, posted_at, raw
) VALUES (
    %(dedupe_key)s, %(source)s, %(external_id)s, %(url)s, %(title)s, %(company)s,
    %(location)s, %(is_remote)s, %(salary_min)s, %(salary_max)s, %(currency)s,
    %(salary_interval)s, %(description)s, %(posted_at)s, %(raw)s
)
ON CONFLICT (dedupe_key) DO UPDATE SET
    last_seen_at    = now(),
    is_active       = TRUE,
    description     = CASE WHEN COALESCE(jp.description, '') = '' THEN EXCLUDED.description
                           ELSE jp.description END,
    salary_min      = CASE WHEN jp.salary_min IS NULL AND jp.salary_max IS NULL THEN EXCLUDED.salary_min
                           ELSE jp.salary_min END,
    salary_max      = CASE WHEN jp.salary_min IS NULL AND jp.salary_max IS NULL THEN EXCLUDED.salary_max
                           ELSE jp.salary_max END,
    currency        = CASE WHEN jp.salary_min IS NULL AND jp.salary_max IS NULL THEN EXCLUDED.currency
                           ELSE jp.currency END,
    salary_interval = CASE WHEN jp.salary_min IS NULL AND jp.salary_max IS NULL THEN EXCLUDED.salary_interval
                           ELSE jp.salary_interval END,
    posted_at       = COALESCE(jp.posted_at, EXCLUDED.posted_at)
RETURNING id, (xmax = 0) AS inserted
"""

# New match -> 'new'. A match that had expired (posting gone for 14 days) and is
# seen again is revived to 'new'; any other existing match is left untouched.
UPSERT_MATCH_SQL = """
INSERT INTO job_matches AS m (user_id, job_posting_id, search_id, status, prefilter_pass)
VALUES (%(user_id)s, %(posting_id)s, %(search_id)s, 'new', NULL)
ON CONFLICT (user_id, job_posting_id) DO UPDATE
    SET status = 'new', prefilter_pass = NULL
  WHERE m.status = 'expired'
RETURNING (xmax = 0) AS inserted
"""


@dataclass
class UpsertStats:
    postings_inserted: int = 0
    postings_updated: int = 0
    matches_created: int = 0
    matches_revived: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "postings_inserted": self.postings_inserted,
            "postings_updated": self.postings_updated,
            "matches_created": self.matches_created,
            "matches_revived": self.matches_revived,
        }


def _posting_params(p: NormalizedPosting) -> dict[str, Any]:
    has_salary = p.salary_min is not None or p.salary_max is not None
    return {
        "dedupe_key": p.dedupe_key(),
        "source": p.source,
        "external_id": p.external_id,
        "url": p.url,
        "title": p.title,
        "company": p.company,
        "location": p.location,
        "is_remote": p.is_remote,
        "salary_min": p.salary_min,
        "salary_max": p.salary_max,
        "currency": p.currency,
        # fetchers annualise salaries
        "salary_interval": "yearly" if has_salary else None,
        "description": (p.description or None),
        "posted_at": p.posted_at,
        "raw": Jsonb(p.raw or {}),
    }


async def upsert_postings_and_matches(
    conn: AsyncConnection,
    user_id: str,
    search_id: str | None,
    postings: Sequence[NormalizedPosting],
) -> UpsertStats:
    """Upsert postings by dedupe_key and create the user's matches, in one transaction."""
    stats = UpsertStats()
    seen: set[str] = set()
    async with conn.transaction():
        async with conn.cursor() as cur:
            for p in postings:
                params = _posting_params(p)
                if params["dedupe_key"] in seen:
                    continue
                seen.add(params["dedupe_key"])
                await cur.execute(UPSERT_POSTING_SQL, params)
                posting_id, inserted = await cur.fetchone()  # type: ignore[misc]
                if inserted:
                    stats.postings_inserted += 1
                else:
                    stats.postings_updated += 1
                await cur.execute(
                    UPSERT_MATCH_SQL,
                    {"user_id": user_id, "posting_id": posting_id, "search_id": search_id},
                )
                row = await cur.fetchone()
                if row is not None:
                    if row[0]:
                        stats.matches_created += 1
                    else:
                        stats.matches_revived += 1
    return stats


EXPIRE_SQL = """
WITH gone AS (
    UPDATE job_postings
       SET is_active = FALSE
     WHERE is_active
       AND last_seen_at < now() - make_interval(days => %(days)s)
    RETURNING id
), expired AS (
    UPDATE job_matches m
       SET status = 'expired'
      FROM job_postings p
     WHERE p.id = m.job_posting_id
       AND m.status IN ('new', 'shortlisted')
       AND (p.id IN (SELECT id FROM gone) OR NOT p.is_active)
    RETURNING m.id
)
SELECT (SELECT count(*) FROM gone), (SELECT count(*) FROM expired)
"""


async def expire_stale(conn: AsyncConnection, days: int = EXPIRE_AFTER_DAYS) -> dict[str, int]:
    """Postings not seen for `days` -> inactive; their new/shortlisted matches -> expired."""
    cur = await conn.execute(EXPIRE_SQL, {"days": days})
    postings, matches = await cur.fetchone()  # type: ignore[misc]
    return {"postings": int(postings), "matches": int(matches)}


ENQUEUE_RANK_SQL = """
WITH existing AS (
    SELECT id FROM tasks
     WHERE type = 'rank_jobs' AND user_id = %(user_id)s AND status = 'queued'
     LIMIT 1
), ins AS (
    INSERT INTO tasks (type, payload, user_id)
    SELECT 'rank_jobs', jsonb_build_object('user_id', %(user_id)s::text), %(user_id)s
     WHERE NOT EXISTS (SELECT 1 FROM existing)
    RETURNING id
)
SELECT id, TRUE FROM ins
UNION ALL
SELECT id, FALSE FROM existing
"""


async def enqueue_rank_jobs(conn: AsyncConnection, user_id: str) -> tuple[UUID | None, bool]:
    """Enqueue rank_jobs {user_id} unless one is already queued for the user.
    Returns (task_id, created)."""
    cur = await conn.execute(ENQUEUE_RANK_SQL, {"user_id": user_id})
    row = await cur.fetchone()
    return (row[0], bool(row[1])) if row else (None, False)


# --------------------------------------------------------------------------- #
# portals.yml import
# --------------------------------------------------------------------------- #

IMPORTED_SEARCH_NAME = "Default (imported from portals.yml)"


async def import_portals_config(
    conn: AsyncConnection,
    user_id: str,
    cfg: PortalsConfig,
    *,
    keywords: Iterable[str] | None = None,
    locations: Iterable[str] | None = None,
    sites: Iterable[str] | None = None,
    results_wanted: int = 20,
) -> dict[str, Any]:
    """Upsert watched_companies (companies with a detectable Greenhouse/Lever/Ashby
    board) and create/update the imported default job_search."""
    added = updated = 0
    skipped: list[str] = []
    async with conn.transaction():
        for c in cfg.companies:
            if not c.ats or not c.board_token:
                skipped.append(c.company)
                continue
            cur = await conn.execute(
                """INSERT INTO watched_companies AS w (user_id, company, ats, board_token, careers_url, enabled)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (user_id, ats, board_token) DO UPDATE
                      SET company = EXCLUDED.company, careers_url = EXCLUDED.careers_url,
                          enabled = EXCLUDED.enabled
                   RETURNING (xmax = 0)""",
                (user_id, c.company, c.ats, c.board_token, c.careers_url, c.enabled),
            )
            (inserted,) = await cur.fetchone()  # type: ignore[misc]
            if inserted:
                added += 1
            else:
                updated += 1

        spec = cfg.default_search(
            keywords=list(keywords) if keywords else None,
            locations=list(locations) if locations else None,
        )
        site_list = list(sites) if sites else ["linkedin", "naukri"]
        cur = await conn.execute(
            "SELECT id FROM job_searches WHERE user_id = %s AND name = %s LIMIT 1",
            (user_id, IMPORTED_SEARCH_NAME),
        )
        row = await cur.fetchone()
        values = (
            spec.keywords, spec.title_include, spec.title_exclude, spec.locations, site_list,
            results_wanted,
        )
        if row:
            search_id = row[0]
            await conn.execute(
                """UPDATE job_searches SET keywords = %s, include_keywords = %s,
                          exclude_keywords = %s, locations = %s, sites = %s, results_wanted = %s
                    WHERE id = %s""",
                (*values, search_id),
            )
            search_created = False
        else:
            cur = await conn.execute("SELECT count(*) FROM job_searches WHERE user_id = %s", (user_id,))
            (n_searches,) = await cur.fetchone()  # type: ignore[misc]
            search_id = None
            search_created = False
            if n_searches < MAX_JOB_SEARCHES:
                cur = await conn.execute(
                    """INSERT INTO job_searches (user_id, name, keywords, include_keywords,
                              exclude_keywords, locations, sites, results_wanted)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                    (user_id, IMPORTED_SEARCH_NAME, *values),
                )
                (search_id,) = await cur.fetchone()  # type: ignore[misc]
                search_created = True
    return {
        "companies_added": added,
        "companies_updated": updated,
        "companies_skipped": skipped,
        "search_id": str(search_id) if search_id else None,
        "search_created": search_created,
        **({} if search_id else {"search_skipped": f"job search limit reached ({MAX_JOB_SEARCHES})"}),
        "keywords": spec.keywords,
        "include_keywords": len(spec.title_include),
        "exclude_keywords": len(spec.title_exclude),
    }
