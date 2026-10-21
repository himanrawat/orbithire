"""Live smoke test for the Tier 3 scrapers (Wellfound, Instahyre, Cutshort, SEEK).

NOT collected by pytest (filename doesn't start with test_). Tiny volume: one
search per source (<= 2 queries + robots.txt, 2-5 s apart, <= 5 results kept).
SEEK is registered as blocked, so it is probed directly (robots.txt + one page)
to re-check whether it still needs a browser. Run from worker/:

    uv run python tests/fetchers/live_smoke_scrapers.py
"""

from __future__ import annotations

import asyncio
import time

from orbithire_worker.fetchers import SearchSpec, fetch_api_sources
from orbithire_worker.fetchers.http import make_client
from orbithire_worker.fetchers.sources import build_query, seek
from orbithire_worker.fetchers.sources._scraper import ScraperHalt

# (source, country, keyword, location, remote_ok)
RUNS = [
    ("wellfound", "IN", "software engineer", "Bangalore", True),
    ("instahyre", "IN", "python developer", None, True),
    ("cutshort", "IN", "react developer", "Pune", False),
]
SEEK_PROBES = [("AU", "react developer", "Sydney"), ("NZ", "react developer", None)]


def verdict(res, sid: str) -> str:
    if sid in res.skipped:
        return f"SKIPPED ({res.skipped[sid]})"
    err = res.errors.get(sid, "")
    if err.startswith("blocked"):
        return "BLOCKED"
    if err.startswith("stopped"):
        return "STOPPED (403/429)"
    if res.counts.get(sid):
        return "WORKS" + (" (partial errors)" if err else "")
    return "FAILED" if err else "EMPTY"


async def main() -> None:
    summary: list[tuple[str, str]] = []
    async with make_client() as client:
        for sid, country, kw, loc, remote in RUNS:
            spec = SearchSpec(keywords=[kw], locations=[loc] if loc else [], sites=[], sources=[sid],
                              country=country, remote_ok=remote, results_wanted=5)
            started = time.monotonic()
            res = await fetch_api_sources(spec, client=client, env={})
            v = verdict(res, sid)
            summary.append((sid, v))
            print(f"\n== {sid} {country} {kw!r}@{loc or 'any'} ({time.monotonic() - started:.1f}s): {v}")
            print(f"   fetched={res.counts.get(sid, 0)} kept={len(res.postings)}"
                  + (f" error={res.errors[sid]}" if sid in res.errors else ""))
            for p in res.postings[:5]:
                sal = f" {p.currency} {p.salary_min:.0f}-{p.salary_max:.0f}" if p.salary_min and p.salary_max else ""
                posted = f" posted={p.posted_at:%Y-%m-%d}" if p.posted_at else ""
                remote_s = " remote" if p.is_remote else ""
                print(f"   - {p.title} @ {p.company} [{p.location}]{remote_s}{sal}{posted}")
                print(f"     {p.url} desc={len(p.description or '')} chars")
            await asyncio.sleep(2)

        for country, kw, loc in SEEK_PROBES:
            spec = SearchSpec(keywords=[kw], locations=[loc] if loc else [], sites=[], sources=["seek"], country=country)
            started = time.monotonic()
            try:
                out = await seek.fetch(client, build_query(spec, {}))
                v = f"SKIPPED ({out.skipped})" if out.skipped else f"NOT BLOCKED? {out.errors}"
            except ScraperHalt as e:
                v = str(e)
            except Exception as e:  # noqa: BLE001
                v = f"FAILED {type(e).__name__}: {e}"
            summary.append((f"seek-{country}", v))
            print(f"\n== seek {country} probe ({time.monotonic() - started:.1f}s): {v}")
            await asyncio.sleep(2)

    print("\nSUMMARY")
    for sid, v in summary:
        print(f"  {sid:12s} {v}")


if __name__ == "__main__":
    asyncio.run(main())
