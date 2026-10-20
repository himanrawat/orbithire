"""Live smoke test (NOT collected by pytest: filename doesn't start with test_).

Hits one real Greenhouse board and a tiny JobSpy LinkedIn + Naukri query.
Keep volume tiny. Run from worker/:

    PYTHONPATH=. uv run --python 3.12 --no-project --with python-jobspy --with httpx \
        --with pyyaml --with pydantic python tests/fetchers/live_smoke.py [portals.yml]
"""

from __future__ import annotations

import asyncio
import sys
import time
from collections import Counter

from orbithire_worker.fetchers import (
    SearchSpec,
    WatchedCompany,
    fetch_company,
    fetch_search,
    load_portals,
)


def show(label, res, started):
    print(f"\n== {label} ({time.monotonic() - started:.1f}s)")
    print("counts:", res.counts, "| kept:", len(res.postings),
          "| filtered:", res.filtered_out, "| dupes:", res.duplicates)
    for src, err in res.errors.items():
        print(f"error[{src}]: {err[:300]}")
    for p in res.postings[:3]:
        sal = f" {p.salary_min}-{p.salary_max} {p.currency}" if p.salary_min else ""
        print(f"  [{p.source}] {p.title} @ {p.company} | {p.location} | remote={p.is_remote}"
              f" | {p.posted_at}{sal} | desc={len(p.description or '')}ch | {p.dedupe_key()[:10]}")


async def main() -> None:
    if len(sys.argv) > 1:
        cfg = load_portals(sys.argv[1])
        print("portals:", len(cfg.companies), "companies;",
              Counter(c.ats or "none" for c in cfg.companies))

    t = time.monotonic()
    res = await fetch_company(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel"))
    show("greenhouse:vercel", res, t)

    t = time.monotonic()
    spec = SearchSpec(
        keywords=["frontend developer"], locations=["Bengaluru"],
        sites=["linkedin", "naukri"], hours_old=72, results_wanted=5,
    )
    res = await fetch_search(spec)
    show("jobspy linkedin+naukri", res, t)


if __name__ == "__main__":
    asyncio.run(main())
