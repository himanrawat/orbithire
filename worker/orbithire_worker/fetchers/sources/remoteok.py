"""Remote OK (https://remoteok.com/api) - remote jobs feed, no key.

GET https://remoteok.com/api -> [legal notice, job, job, ...] (~100 newest).
ToS: link back to the Remote OK job URL and mention "Remote OK" as the source
(we keep its URL and source "remoteok"); do not use their logo. One request
per run; keywords are matched locally against title + tags.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..common import fix_mojibake, from_epoch, html_to_text, keyword_hit, num, parse_iso, positive
from ..http import request
from ..models import NormalizedPosting
from .base import SourceDef, SourceOutput, SourceQuery, compact_raw, recent, remote_eligible

URL = "https://remoteok.com/api"


def map_remoteok(job: dict[str, Any]) -> NormalizedPosting:
    smin, smax = positive(num(job.get("salary_min"))), positive(num(job.get("salary_max")))
    loc = (job.get("location") or "").strip()
    return NormalizedPosting(
        source="remoteok",
        external_id=str(job.get("id")),
        url=job.get("url") or f"https://remoteok.com/remote-jobs/{job.get('slug') or job.get('id')}",
        title=fix_mojibake((job.get("position") or "").strip()) or "",
        company=fix_mojibake((job.get("company") or "Unknown").strip()) or "Unknown",
        location=f"Remote ({loc})" if loc else "Remote",
        is_remote=True,
        salary_min=smin,
        salary_max=smax,
        currency="USD" if (smin or smax) else None,  # Remote OK salaries are USD/yr
        description=html_to_text(fix_mojibake(job.get("description"))) or None,
        posted_at=parse_iso(job.get("date")) or from_epoch(job.get("epoch")),
        raw=compact_raw(job, ("description", "company_logo", "logo")),
    )


async def fetch(client: httpx.AsyncClient, q: SourceQuery) -> SourceOutput:
    data = await request(client, "GET", URL)
    jobs = [j for j in (data if isinstance(data, list) else []) if isinstance(j, dict) and j.get("id")]
    out = SourceOutput(raw_count=len(jobs))
    for j in jobs:
        text = f"{j.get('position') or ''} {' '.join(j.get('tags') or [])}"
        if j.get("position") and keyword_hit(text, q.keywords) and remote_eligible(j.get("location"), q.country):
            out.postings.append(map_remoteok(j))
    out.postings = recent(out.postings, q)[: q.per_query * 2]
    return out


SOURCE = SourceDef(id="remoteok", label="Remote OK", fetch=fetch, remote_only=True)
