"""JobSpy wrapper: keyword x location x site queries with per-site error isolation.

Synchronous (JobSpy is blocking); the async facade runs it in a thread.
"""

from __future__ import annotations

import inspect
import logging
import math
import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any

from .models import NormalizedPosting, SearchSpec

log = logging.getLogger(__name__)

# Delay between consecutive JobSpy calls (seconds, uniform random).
DELAY_RANGE = (2.0, 5.0)
# Stop querying a site after this many consecutive failures (likely blocked).
MAX_CONSECUTIVE_FAILURES = 2

_ANNUAL_FACTOR = {"yearly": 1, "monthly": 12, "weekly": 52, "daily": 260, "hourly": 2080}
# Sites that report Indian salaries without always setting a currency.
_DEFAULT_CURRENCY = {"naukri": "INR"}


@dataclass
class JobSpyResult:
    postings: list[NormalizedPosting] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)  # site -> message(s)
    counts: dict[str, int] = field(default_factory=dict)  # site -> raw rows


def _scrape_jobs() -> Callable[..., Any]:
    from jobspy import scrape_jobs  # imported lazily: heavy (pandas, numpy)

    return scrape_jobs


def _default_kwargs(scrape: Callable[..., Any]) -> dict[str, Any]:
    """Version-dependent JobSpy kwargs.

    - python-jobspy >=1.2 renamed linkedin_fetch_description -> fetch_description.
    - curl_cffi's bundled CA store fails Naukri's GlobalSign R46 chain
      ("self signed certificate in certificate chain"); certifi's bundle works.
    """
    try:
        params = inspect.signature(scrape).parameters
    except (TypeError, ValueError):
        params = {}
    out: dict[str, Any] = {}
    if "fetch_description" in params:
        out["fetch_description"] = True
    else:
        out["linkedin_fetch_description"] = True
    if "ca_cert" in params:
        try:
            import certifi

            out["ca_cert"] = certifi.where()
        except ImportError:
            pass
    return out


# --------------------------------------------------------------------------- #
# Row mapping
# --------------------------------------------------------------------------- #


def _clean(v: Any) -> Any:
    """NaN / NaT / pd.NA -> None; numpy scalars -> python."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        import pandas as pd

        if v is pd.NaT or (not isinstance(v, (list, dict, str)) and pd.isna(v)):
            return None
    except (ImportError, TypeError, ValueError):
        pass
    if hasattr(v, "item") and not isinstance(v, (str, bytes)):
        try:
            return v.item()
        except (ValueError, AttributeError):
            return v
    return v


def _jsonable(v: Any) -> Any:
    v = _clean(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    return str(v)


def _to_datetime(v: Any) -> datetime | None:
    v = _clean(v)
    if v is None:
        return None
    if hasattr(v, "to_pydatetime"):
        v = v.to_pydatetime()
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=UTC)
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day, tzinfo=UTC)
    if isinstance(v, str):
        try:
            return _to_datetime(datetime.fromisoformat(v))
        except ValueError:
            return None
    return None


def _float(v: Any) -> float | None:
    v = _clean(v)
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None


def map_row(row: dict[str, Any], site: str | None = None) -> NormalizedPosting | None:
    """Map one JobSpy DataFrame row (as dict) to a NormalizedPosting.

    Returns None for rows missing a title or URL.
    """
    r = {k: _clean(v) for k, v in row.items()}
    source = (r.get("site") or site or "jobspy").lower()
    title = (r.get("title") or "").strip()
    url = r.get("job_url") or r.get("job_url_direct")
    if not title or not url:
        return None

    interval = (r.get("interval") or "yearly").lower()
    factor = _ANNUAL_FACTOR.get(interval, 1)
    smin, smax = _float(r.get("min_amount")), _float(r.get("max_amount"))
    smin = None if smin is None else round(smin * factor, 2)
    smax = None if smax is None else round(smax * factor, 2)
    currency = r.get("currency")
    if not currency and (smin or smax):
        currency = _DEFAULT_CURRENCY.get(source)

    location = r.get("location") or None
    wfh = (r.get("work_from_home_type") or "").lower()
    is_remote = bool(r.get("is_remote")) or "remote" in wfh or (
        "remote" in (location or "").lower()
    )

    raw = {k: _jsonable(v) for k, v in r.items() if k != "description" and v is not None}
    return NormalizedPosting(
        source=source,
        external_id=str(r["id"]) if r.get("id") else None,
        url=str(url),
        title=title,
        company=(r.get("company") or "Unknown").strip(),
        location=location,
        is_remote=is_remote,
        salary_min=smin,
        salary_max=smax,
        currency=currency,
        description=r.get("description") or None,
        posted_at=_to_datetime(r.get("date_posted")),
        raw=raw,
    )


def map_dataframe(df: Any, site: str | None = None) -> list[NormalizedPosting]:
    if df is None or len(df) == 0:
        return []
    out = []
    for row in df.to_dict("records"):
        p = map_row(row, site)
        if p is not None:
            out.append(p)
    return out


# --------------------------------------------------------------------------- #
# Scraping
# --------------------------------------------------------------------------- #


def scrape_search(
    spec: SearchSpec,
    *,
    scrape: Callable[..., Any] | None = None,
    sleep: Callable[[float], None] = time.sleep,
    delay_range: tuple[float, float] = DELAY_RANGE,
    jobspy_kwargs: dict[str, Any] | None = None,
) -> JobSpyResult:
    """Run spec.keywords x spec.locations for each site, one JobSpy call per site.

    Each site is queried separately so one site failing (exception or JobSpy's
    reported error) never affects the others. `jobspy_kwargs` is passed through
    to scrape_jobs (e.g. {"proxies": [...]} if LinkedIn rate-limits, "ca_cert").
    """
    scrape = scrape or _scrape_jobs()
    desc_kwargs = {**_default_kwargs(scrape), **(jobspy_kwargs or {})}
    result = JobSpyResult()
    locations: list[str | None] = list(spec.locations) or [None]
    queries = [(kw, loc) for kw in spec.keywords for loc in locations]
    first_call = True

    for site in spec.sites:
        site_errors: list[str] = []
        consecutive = 0
        result.counts.setdefault(site, 0)
        for kw, loc in queries:
            if consecutive >= MAX_CONSECUTIVE_FAILURES:
                site_errors.append("skipped remaining queries after repeated failures")
                break
            if not first_call:
                sleep(random.uniform(*delay_range))
            first_call = False
            try:
                df = scrape(
                    site_name=[site],
                    search_term=kw,
                    location=loc,
                    hours_old=spec.hours_old,
                    results_wanted=spec.results_wanted,
                    country_indeed=spec.country_indeed,
                    verbose=0,
                    **desc_kwargs,
                )
            except Exception as e:  # noqa: BLE001 - isolate per site
                log.warning("jobspy %s %r @ %r failed: %s", site, kw, loc, e)
                site_errors.append(f"{kw!r}@{loc!r}: {type(e).__name__}: {e}")
                consecutive += 1
                continue
            reported = (getattr(df, "attrs", {}) or {}).get("errors") or {}
            postings = map_dataframe(df, site)
            if reported.get(site):
                site_errors.append(f"{kw!r}@{loc!r}: {reported[site]}")
                consecutive = consecutive + 1 if not postings else 0
            else:
                consecutive = 0
            result.counts[site] += len(postings)
            result.postings.extend(postings)
        if site_errors:
            result.errors[site] = "; ".join(site_errors)[:2000]
    return result
