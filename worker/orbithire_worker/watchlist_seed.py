"""Shared US company watchlist seed (data/us_watchlist.csv).

    uv run python -m orbithire_worker.watchlist_seed --sql     # print the seed migration
    uv run python -m orbithire_worker.watchlist_seed --apply   # upsert into company_watchlist

Every board token in the CSV was checked against the ATS's public job-board API
(HTTP 200 with open jobs, mostly US locations) when it was added. The seed
migration (supabase/migrations/20261024000201_us_watchlist_seed.sql) is generated
from the CSV; tests/test_watchlist_seed.py keeps the two in sync.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from .fetchers.models import ATS_NAMES

DATA_FILE = Path(__file__).parent / "data" / "us_watchlist.csv"
_TOKEN = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
_COUNTRY = re.compile(r"^[A-Z]{2}$")


@dataclass(frozen=True)
class WatchlistEntry:
    name: str
    ats: str
    board_token: str
    country: str = "US"
    priority: int = 2
    legal_basis: str = "public_employer_ats_feed"


class WatchlistDataError(ValueError):
    pass


def _entry(row: dict[str, str], line: int) -> WatchlistEntry:
    name = (row.get("name") or "").strip()
    ats = (row.get("ats") or "").strip()
    token = (row.get("board_token") or "").strip()
    country = (row.get("country") or "US").strip().upper()
    priority = (row.get("priority") or "2").strip()
    if not name or ats not in ATS_NAMES or not _TOKEN.match(token):
        raise WatchlistDataError(f"line {line}: invalid name/ats/board_token")
    if not _COUNTRY.match(country) or priority not in ("1", "2"):
        raise WatchlistDataError(f"line {line}: invalid country/priority")
    return WatchlistEntry(
        name=name,
        ats=ats,
        board_token=token,
        country=country,
        priority=int(priority),
        legal_basis=(row.get("legal_basis") or "public_employer_ats_feed").strip(),
    )


def load_entries(path: Path = DATA_FILE) -> list[WatchlistEntry]:
    """Parse and validate the CSV; raises WatchlistDataError on bad or duplicate rows."""
    with path.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    entries = [_entry(r, i + 2) for i, r in enumerate(rows)]
    seen: set[tuple[str, str]] = set()
    for e in entries:
        key = (e.ats, e.board_token.lower())
        if key in seen:
            raise WatchlistDataError(f"duplicate board {e.ats}:{e.board_token}")
        seen.add(key)
    return entries


def _q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


SQL_HEADER = """-- Seed: shared US company watchlist (NextMilestone PRD area 9).
-- GENERATED from worker/orbithire_worker/data/us_watchlist.csv by
--   uv run python -m orbithire_worker.watchlist_seed --sql
-- Do not edit by hand. Re-running is safe (upsert by ats + board_token).
"""


def render_seed_sql(entries: list[WatchlistEntry]) -> str:
    values = ",\n".join(
        f"  ({_q(e.name)}, {_q(e.ats)}, {_q(e.board_token)}, {_q(e.country)}, {e.priority}, {_q(e.legal_basis)})"
        for e in entries
    )
    return (
        f"{SQL_HEADER}\n"
        "INSERT INTO company_watchlist (name, ats, board_token, country, priority, legal_basis) VALUES\n"
        f"{values}\n"
        "ON CONFLICT (ats, board_token) DO UPDATE SET\n"
        "  name = EXCLUDED.name, country = EXCLUDED.country, priority = EXCLUDED.priority,\n"
        "  legal_basis = EXCLUDED.legal_basis;\n"
    )


UPSERT_SQL = """
INSERT INTO company_watchlist (name, ats, board_token, country, priority, legal_basis)
SELECT * FROM unnest(%s::text[], %s::text[], %s::text[], %s::text[], %s::smallint[], %s::text[])
ON CONFLICT (ats, board_token) DO UPDATE SET
  name = EXCLUDED.name, country = EXCLUDED.country, priority = EXCLUDED.priority,
  legal_basis = EXCLUDED.legal_basis
"""


async def apply_entries(database_url: str, entries: list[WatchlistEntry]) -> int:
    import psycopg

    cols = (
        [e.name for e in entries], [e.ats for e in entries], [e.board_token for e in entries],
        [e.country for e in entries], [e.priority for e in entries], [e.legal_basis for e in entries],
    )
    async with await psycopg.AsyncConnection.connect(database_url, autocommit=True) as conn:
        cur = await conn.execute(UPSERT_SQL, cols)
        return cur.rowcount


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--sql", action="store_true", help="print the seed migration SQL")
    group.add_argument("--apply", action="store_true", help="upsert the CSV into company_watchlist")
    parser.add_argument("--database-url", default=None)
    args = parser.parse_args(argv)
    entries = load_entries()
    if args.sql:
        sys.stdout.write(render_seed_sql(entries))
        return 0
    from .settings import get_settings

    n = asyncio.run(apply_entries(args.database_url or get_settings().database_url, entries))
    print(f"upserted {n} watchlist boards")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
