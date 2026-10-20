from datetime import date

import numpy as np
import pandas as pd

from orbithire_worker.fetchers.jobspy_source import map_dataframe, map_row, scrape_search
from orbithire_worker.fetchers.models import SearchSpec

# Columns as produced by python-jobspy 1.4 (JobPost.model_fields order, subset).
COLUMNS = [
    "id", "site", "job_url", "job_url_direct", "title", "company", "location",
    "date_posted", "job_type", "salary_source", "interval", "min_amount", "max_amount",
    "currency", "is_remote", "job_level", "description", "company_url",
    "work_from_home_type", "skills", "experience_range",
]


def fake_df(rows, errors=None):
    df = pd.DataFrame([{c: r.get(c, np.nan) for c in COLUMNS} for r in rows], columns=COLUMNS)
    df.attrs = {"errors": errors or {}, "warnings": {}}
    return df


LI_ROW = {
    "id": "li-4012345678", "site": "linkedin",
    "job_url": "https://www.linkedin.com/jobs/view/4012345678",
    "title": "Senior Frontend Engineer", "company": "Acme Pvt. Ltd.",
    "location": "Bengaluru, Karnataka, India", "date_posted": date(2026, 10, 19),
    "interval": "yearly", "min_amount": 2500000.0, "max_amount": 3500000.0, "currency": "INR",
    "is_remote": False, "description": "Build **React** apps.",
}
NK_ROW = {
    "id": "nk-191020500123", "site": "naukri",
    "job_url": "https://www.naukri.com/job-listings-191020500123",
    "title": "Senior Frontend Engineer", "company": "ACME",
    "location": "Bangalore", "date_posted": date(2026, 10, 20),
    "interval": "monthly", "min_amount": 200000.0, "max_amount": np.nan, "currency": np.nan,
    "is_remote": np.nan, "work_from_home_type": "Hybrid", "skills": "React, TypeScript",
    "experience_range": "5-8 Yrs",
}


def test_map_row_linkedin():
    p = map_dataframe(fake_df([LI_ROW]))[0]
    assert p.source == "linkedin" and p.external_id == "li-4012345678"
    assert p.salary_min == 2500000 and p.salary_max == 3500000 and p.currency == "INR"
    assert p.posted_at.isoformat() == "2026-10-19T00:00:00+00:00"
    assert p.is_remote is False
    assert "description" not in p.raw
    assert p.raw["date_posted"] == "2026-10-19"


def test_map_row_naukri_nan_and_monthly_salary():
    p = map_dataframe(fake_df([NK_ROW]))[0]
    assert p.salary_min == 2400000  # 200k/month * 12
    assert p.salary_max is None
    assert p.currency == "INR"  # default for naukri when missing
    assert p.is_remote is False
    assert p.description is None
    assert p.raw["skills"] == "React, TypeScript"
    assert all(v == v for v in p.raw.values() if isinstance(v, float))  # no NaN left


def test_cross_site_dedupe_key():
    li, nk = map_dataframe(fake_df([LI_ROW, NK_ROW]))
    assert li.dedupe_key() == nk.dedupe_key()


def test_rows_without_title_or_url_are_skipped():
    assert map_row({"site": "indeed", "title": np.nan, "job_url": "https://x"}) is None
    assert map_row({"site": "indeed", "title": "Dev", "job_url": None}) is None


def test_remote_detection():
    p = map_row({"site": "linkedin", "title": "Dev", "job_url": "https://x", "location": "Remote", "is_remote": np.nan})
    assert p.is_remote is True
    p = map_row({"site": "naukri", "title": "Dev", "job_url": "https://x", "work_from_home_type": "Remote"})
    assert p.is_remote is True


def test_empty_dataframe():
    assert map_dataframe(fake_df([])) == []


def test_scrape_search_isolates_site_failures():
    calls = []

    def fake_scrape(**kw):
        calls.append(kw)
        site = kw["site_name"][0]
        if site == "indeed":
            raise RuntimeError("boom")
        if site == "glassdoor":
            return fake_df([], errors={"glassdoor": "HTTP 429 (blocked?)"})
        return fake_df([LI_ROW if site == "linkedin" else NK_ROW])

    sleeps = []
    spec = SearchSpec(
        keywords=["frontend", "react"], locations=["Bangalore"],
        sites=["linkedin", "indeed", "naukri", "glassdoor"], results_wanted=5,
    )
    res = scrape_search(spec, scrape=fake_scrape, sleep=sleeps.append)

    assert res.counts == {"linkedin": 2, "indeed": 0, "naukri": 2, "glassdoor": 0}
    assert set(res.errors) == {"indeed", "glassdoor"}
    assert "boom" in res.errors["indeed"]
    assert "429" in res.errors["glassdoor"]
    assert len(res.postings) == 4
    # kwargs passed through to jobspy
    first = calls[0]
    assert first["site_name"] == ["linkedin"] and first["search_term"] == "frontend"
    assert first["location"] == "Bangalore" and first["hours_old"] == 24
    assert first["results_wanted"] == 5 and first["country_indeed"] == "india"
    assert first.get("fetch_description") is True or first.get("linkedin_fetch_description") is True
    # randomized delay between every call except the first
    assert len(sleeps) == len(calls) - 1 and all(2 <= s <= 5 for s in sleeps)


def test_scrape_search_stops_site_after_repeated_failures():
    calls = []

    def fake_scrape(**kw):
        calls.append(kw["site_name"][0])
        raise RuntimeError("blocked")

    spec = SearchSpec(keywords=["a", "b", "c"], locations=["X"], sites=["linkedin"])
    res = scrape_search(spec, scrape=fake_scrape, sleep=lambda s: None)
    assert calls == ["linkedin", "linkedin"]
    assert "skipped remaining" in res.errors["linkedin"]


def test_legacy_linkedin_fetch_description_kwarg():
    seen = {}

    def old_scrape(site_name=None, search_term=None, location=None, hours_old=None,
                   results_wanted=None, country_indeed=None, verbose=None,
                   linkedin_fetch_description=False):
        seen["lfd"] = linkedin_fetch_description
        return fake_df([])

    scrape_search(SearchSpec(keywords=["a"], sites=["linkedin"]), scrape=old_scrape, sleep=lambda s: None)
    assert seen["lfd"] is True


def test_modern_jobspy_kwargs_and_passthrough():
    seen = {}

    def new_scrape(site_name=None, search_term=None, location=None, hours_old=None,
                   results_wanted=None, country_indeed=None, verbose=None,
                   fetch_description=False, ca_cert=None, proxies=None):
        seen.update(fd=fetch_description, ca=ca_cert, proxies=proxies)
        return fake_df([])

    scrape_search(SearchSpec(keywords=["a"], sites=["naukri"]), scrape=new_scrape,
                  sleep=lambda s: None, jobspy_kwargs={"proxies": ["http://p:1"]})
    assert seen["fd"] is True
    assert seen["ca"] and seen["ca"].endswith(".pem")  # certifi bundle by default
    assert seen["proxies"] == ["http://p:1"]
