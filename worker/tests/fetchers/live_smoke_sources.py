"""Live smoke test for the keyless job sources + Tier 2 ATS boards.

NOT collected by pytest (filename doesn't start with test_). Tiny volume: at most
5 results per source, one query each. Run from worker/:

    uv run python tests/fetchers/live_smoke_sources.py
"""

from __future__ import annotations

import asyncio
import time

from orbithire_worker.fetchers import SearchSpec, WatchedCompany, fetch_api_sources, fetch_company
from orbithire_worker.fetchers.http import make_client

# (source, country, keyword, location)
SOURCES = [
    ("arbeitnow", "DE", "developer", None),
    ("bundesagentur", "DE", "python", "Berlin"),
    ("mycareersfuture", "SG", "python developer", None),
    ("remotive", "GB", "python", None),
    ("remoteok", "US", "engineer", None),
    ("himalayas", "IN", "python", None),
    ("jobicy", "GB", "python", None),
]

COMPANIES = [
    WatchedCompany(company="bunq", ats="recruitee", board_token="bunq"),
    WatchedCompany(company="Personio", ats="personio", board_token="personio", region="eu"),
    WatchedCompany(company="Ubisoft", ats="smartrecruiters", board_token="Ubisoft2"),
    WatchedCompany(company="Skroutz", ats="workable", board_token="skroutz"),
    WatchedCompany(company="Polestar", ats="teamtailor", board_token="polestar"),
]


def show(label, res, started):
    print(f"\n== {label} ({time.monotonic() - started:.1f}s) counts={res.counts} kept={len(res.postings)}"
          + (f" skipped={res.skipped}" if res.skipped else ""))
    for src, err in res.errors.items():
        print(f"   error[{src}]: {err[:300]}")
    for p in res.postings[:2]:
        sal = f" | {p.salary_min:.0f}-{p.salary_max:.0f} {p.currency}" if p.salary_min and p.salary_max else ""
        print(f"   [{p.source}] {p.title[:60]} @ {p.company[:30]} | {p.location} | {p.posted_at}{sal}"
              f" | desc={len(p.description or '')}ch | {p.url[:80]}")


async def main() -> None:
    async with make_client() as client:
        for sid, country, kw, loc in SOURCES:
            spec = SearchSpec(
                keywords=[kw], locations=[loc] if loc else [], sites=[], sources=[sid],
                country=country, hours_old=24 * 7, results_wanted=5,
            )
            t = time.monotonic()
            res = await fetch_api_sources(spec, client=client, env={})
            res.postings = res.postings[:5]
            show(f"{sid} ({country})", res, t)
        for c in COMPANIES:
            t = time.monotonic()
            # SmartRecruiters: narrow titles so only a few detail calls are made
            include = ["R&D Engineer"] if c.ats == "smartrecruiters" else None
            res = await fetch_company(c, client=client, include=include)
            res.postings = res.postings[:5]
            show(f"{c.ats}:{c.board_token}", res, t)


if __name__ == "__main__":
    asyncio.run(main())
