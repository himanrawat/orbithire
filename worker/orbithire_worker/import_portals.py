"""One-off import of a career-ops `portals.yml` for one OrbitHire user.

    uv run python -m orbithire_worker.import_portals \\
        --user-email you@example.com --path ~/Projects/career-ops/portals.yml

Creates/updates watched_companies (companies whose careers/api URL points at a
Greenhouse, Lever or Ashby board; others are listed as skipped) and a job_search
named "Default (imported from portals.yml)" with keywords = the first positive
title keywords, include_keywords = title_filter.positive and exclude_keywords =
title_filter.negative. Re-running is idempotent.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

import psycopg

from .fetchers.portals import load_portals
from .jobs_db import import_portals_config
from .settings import get_settings


async def _run(args: argparse.Namespace) -> dict:
    cfg = load_portals(args.path, include_disabled=True)
    url = args.database_url or get_settings().database_url
    async with await psycopg.AsyncConnection.connect(url, autocommit=True) as conn:
        cur = await conn.execute(
            "SELECT id FROM profiles WHERE lower(email) = lower(%s) LIMIT 1", (args.user_email,)
        )
        row = await cur.fetchone()
        if row is None:
            cur = await conn.execute(
                "SELECT id FROM auth.users WHERE lower(email) = lower(%s) LIMIT 1", (args.user_email,)
            )
            row = await cur.fetchone()
        if row is None:
            raise SystemExit(f"no user with email {args.user_email!r}")
        user_id = str(row[0])
        if args.dry_run:
            return {
                "user_id": user_id,
                "dry_run": True,
                "companies": len(cfg.companies),
                "with_ats": sum(1 for c in cfg.companies if c.ats and c.board_token),
                "positive": len(cfg.positive),
                "negative": len(cfg.negative),
            }
        res = await import_portals_config(
            conn,
            user_id,
            cfg,
            keywords=args.keyword or None,
            locations=args.location or None,
            sites=args.site or None,
            results_wanted=args.results_wanted,
        )
        return {"user_id": user_id, **res}


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--user-email", required=True)
    p.add_argument("--path", required=True, help="path to portals.yml")
    p.add_argument("--database-url", help="defaults to DATABASE_URL / settings")
    p.add_argument("--keyword", action="append", help="JobSpy search term (repeatable); default: first 3 positive keywords")
    p.add_argument("--location", action="append", help="repeatable; default: India")
    p.add_argument("--site", action="append", help="repeatable; default: linkedin, naukri")
    p.add_argument("--results-wanted", type=int, default=20)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args(argv)
    out = asyncio.run(_run(args))
    json.dump(out, sys.stdout, indent=2, default=str)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
