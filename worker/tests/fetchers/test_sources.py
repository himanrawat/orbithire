"""Tier 1 job APIs: mapping, salary/currency, missing keys, country gating, retries."""

import asyncio
import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import respx

from orbithire_worker.fetchers import SearchSpec, fetch_api_sources, fetch_search
from orbithire_worker.fetchers.countries import country_info
from orbithire_worker.fetchers.sources import API_SOURCES, adzuna, base, jooble, reed, usajobs
from orbithire_worker.fetchers.sources.base import SourceQuery, remote_eligible

from .conftest import load_fixture

KEYS = {
    "ADZUNA_APP_ID": "aid",
    "ADZUNA_APP_KEY": "secret-adzuna",
    "JOOBLE_API_KEY": "secret-jooble",
    "REED_API_KEY": "secret-reed",
    "USAJOBS_API_KEY": "secret-usa",
    "USAJOBS_USER_AGENT": "me@example.com",
}


@pytest.fixture(autouse=True)
def _no_cutoff(monkeypatch):
    """Fixture dates are fixed; disable the recency window except where tested."""
    monkeypatch.setattr(SourceQuery, "cutoff", lambda self, grace_hours=48: datetime(2000, 1, 1, tzinfo=UTC))


def run(coro):
    return asyncio.run(coro)


def spec(country="IN", sources=(), **kw):
    kw.setdefault("keywords", ["python developer"])
    kw.setdefault("locations", [])
    kw.setdefault("sites", [])
    return SearchSpec(country=country, sources=list(sources), **kw)


def fetch(country, sources, env=None, **kw):
    return run(fetch_api_sources(spec(country, sources, **kw), env=KEYS if env is None else env))


# --------------------------------------------------------------------------- #
# Registry / gating
# --------------------------------------------------------------------------- #


def test_registry_ids_match_migration():
    sql = open(
        __import__("pathlib").Path(__file__).resolve().parents[3]
        / "supabase/migrations/20250101000028_scraper_sources.sql"
    ).read()
    for sid in API_SOURCES:
        assert f"'{sid}'" in sql


def test_missing_key_is_reported_and_no_request_made():
    with respx.mock(assert_all_called=False) as router:
        route = router.route(host="api.adzuna.com")
        res = fetch("GB", ["adzuna", "reed", "jooble", "usajobs"], env={})
    assert not route.called
    assert res.errors["adzuna"].startswith("missing API key")
    assert "ADZUNA_APP_KEY" in res.errors["adzuna"]
    assert res.errors["reed"].startswith("missing API key")
    assert res.errors["jooble"].startswith("missing API key")
    # USAJobs is US only -> skipped (not an error) for GB
    assert "usajobs" in res.skipped and "usajobs" not in res.errors
    assert res.postings == []


def test_country_gating_and_remote_only():
    res = fetch("IN", ["reed", "bundesagentur", "mycareersfuture", "remotive", "nope"], remote_ok=False)
    assert res.skipped["reed"] == "not available for India"
    assert res.skipped["bundesagentur"] == "not available for India"
    assert res.skipped["mycareersfuture"] == "not available for India"
    assert "remote-only" in res.skipped["remotive"]
    assert res.skipped["nope"] == "unknown source"


# --------------------------------------------------------------------------- #
# Keyed APIs (recorded shapes from the official docs)
# --------------------------------------------------------------------------- #

ADZUNA_PAYLOAD = {
    "count": 2,
    "results": [
        {
            "id": "4711",
            "title": "Senior <strong>Python</strong> Developer",
            "description": "We need a <strong>Python</strong> developer...",
            "redirect_url": "https://www.adzuna.co.uk/jobs/land/ad/4711",
            "created": "2026-10-19T10:00:00Z",
            "company": {"display_name": "Acme Ltd"},
            "location": {"display_name": "London, UK", "area": ["UK", "London"]},
            "salary_min": 60000,
            "salary_max": 75000,
            "salary_is_predicted": "0",
        },
        {
            "id": "4712",
            "title": "Python Engineer (Remote)",
            "description": "...",
            "redirect_url": "https://www.adzuna.co.uk/jobs/land/ad/4712",
            "created": "2026-10-18T10:00:00Z",
            "company": {"display_name": "Beta"},
            "location": {"display_name": "UK"},
            "salary_min": 50000,
            "salary_max": 50000,
            "salary_is_predicted": "1",
        },
    ],
}


@respx.mock
def test_adzuna_mapping_currency_and_params():
    route = respx.get(url__startswith="https://api.adzuna.com/v1/api/jobs/gb/search/1").mock(
        return_value=httpx.Response(200, json=ADZUNA_PAYLOAD)
    )
    res = fetch("GB", ["adzuna"], locations=["London", "United Kingdom"], hours_old=48)
    assert res.errors == {}
    assert res.counts == {"adzuna": 4}  # 2 queries (London, whole country) x 2 rows
    params = [dict(c.request.url.params) for c in route.calls]
    assert params[0]["what"] == "python developer" and params[0]["where"] == "London"
    assert "where" not in params[1]  # bare country name -> whole country
    assert params[0]["max_days_old"] == "2" and params[0]["app_key"] == "secret-adzuna"
    a, b = res.postings[:2]
    assert a.source == "adzuna" and a.title == "Senior Python Developer" and a.company == "Acme Ltd"
    assert (a.salary_min, a.salary_max, a.currency) == (60000, 75000, "GBP")
    assert b.is_remote and (b.salary_min, b.currency) == (None, None)  # predicted salary dropped
    assert a.posted_at == datetime(2026, 10, 19, 10, tzinfo=UTC)


@respx.mock
def test_adzuna_country_endpoint_and_currency_india():
    route = respx.get(url__startswith="https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(200, json=ADZUNA_PAYLOAD)
    )
    res = fetch("IN", ["adzuna"])
    assert route.called and res.postings[0].currency == "INR"


@respx.mock
def test_adzuna_key_never_in_error():
    respx.get(url__startswith="https://api.adzuna.com/").mock(return_value=httpx.Response(401))
    res = fetch("GB", ["adzuna"])
    assert "401" in res.errors["adzuna"] and "secret-adzuna" not in res.errors["adzuna"]


@respx.mock
def test_jooble_post_body_and_salary_text():
    route = respx.post("https://jooble.org/api/secret-jooble").mock(
        return_value=httpx.Response(
            200,
            json={
                "totalCount": 2,
                "jobs": [
                    {
                        "id": -123, "title": "Python Developer", "location": "Bengaluru, Karnataka",
                        "snippet": "&nbsp;...build <b>APIs</b>...", "salary": "₹ 12 - 18 LPA",
                        "source": "naukri.com", "type": "Full-time", "link": "https://jooble.org/desc/-123",
                        "company": "Acme", "updated": "2026-10-19T08:00:00.0000000",
                    },
                    {
                        "id": 9, "title": "Backend Engineer", "location": "Remote", "snippet": "",
                        "salary": "", "link": "https://jooble.org/desc/9", "company": "",
                        "updated": "2026-10-19T08:00:00",
                    },
                ],
            },
        )
    )
    res = fetch("IN", ["jooble"], locations=["Bengaluru"])
    body = json.loads(route.calls[0].request.content)
    assert body["keywords"] == "python developer" and body["location"] == "Bengaluru, India"
    a, b = res.postings
    assert (a.salary_min, a.salary_max, a.currency) == (1_200_000, 1_800_000, "INR")
    assert a.description == "...build APIs..."
    assert b.is_remote and b.company == "Unknown" and b.salary_min is None


@respx.mock
def test_jooble_key_redacted_from_errors():
    respx.post("https://jooble.org/api/secret-jooble").mock(return_value=httpx.Response(400))
    res = fetch("IN", ["jooble"])
    assert "secret-jooble" not in res.errors["jooble"] and "***" in res.errors["jooble"]


@respx.mock
def test_reed_basic_auth_and_mapping():
    route = respx.get(url__startswith="https://www.reed.co.uk/api/1.0/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {
                        "jobId": 555, "employerName": "Acme Recruitment", "jobTitle": "Python Developer",
                        "locationName": "Manchester", "minimumSalary": 45000.0, "maximumSalary": 55000.0,
                        "currency": "GBP", "date": "18/10/2026", "jobDescription": "<p>Great role</p>",
                        "jobUrl": "https://www.reed.co.uk/jobs/python-developer/555",
                    }
                ],
                "totalResults": 1,
            },
        )
    )
    res = fetch("GB", ["reed"], locations=["Manchester"])
    req = route.calls[0].request
    assert req.headers["authorization"].startswith("Basic ")
    import base64

    assert base64.b64decode(req.headers["authorization"][6:]) == b"secret-reed:"
    assert req.url.params["locationName"] == "Manchester"
    p = res.postings[0]
    assert (p.source, p.external_id, p.company, p.location) == ("reed", "555", "Acme Recruitment", "Manchester")
    assert (p.salary_min, p.salary_max, p.currency) == (45000, 55000, "GBP")
    assert p.posted_at == datetime(2026, 10, 18, tzinfo=UTC) and p.description == "Great role"


USAJOBS_PAYLOAD = {
    "SearchResult": {
        "SearchResultCount": 1,
        "SearchResultItems": [
            {
                "MatchedObjectId": "800001",
                "MatchedObjectDescriptor": {
                    "PositionID": "IT-26-1",
                    "PositionTitle": "IT Specialist (APPSW)",
                    "PositionURI": "https://www.usajobs.gov:443/GetJob/ViewDetails/800001",
                    "ApplyURI": ["https://www.usajobs.gov:443/GetJob/ViewDetails/800001?PostingChannelID="],
                    "PositionLocationDisplay": "Washington, District of Columbia",
                    "PositionLocation": [{"LocationName": "Washington, District of Columbia"}],
                    "OrganizationName": "Bureau of the Fiscal Service",
                    "DepartmentName": "Department of the Treasury",
                    "QualificationSummary": "One year of specialized experience...",
                    "PositionRemuneration": [
                        {"MinimumRange": "45.10", "MaximumRange": "58.63", "RateIntervalCode": "PH"}
                    ],
                    "PublicationStartDate": "2026-10-17T00:00:00.0000",
                    "UserArea": {"Details": {"JobSummary": "Build software.", "RemoteIndicator": False}},
                },
            }
        ],
    }
}


@respx.mock
def test_usajobs_headers_and_hourly_salary():
    route = respx.get(url__startswith="https://data.usajobs.gov/api/search").mock(
        return_value=httpx.Response(200, json=USAJOBS_PAYLOAD)
    )
    res = fetch("US", ["usajobs"], locations=["Washington, DC"])
    req = route.calls[0].request
    assert req.headers["authorization-key"] == "secret-usa"
    assert req.headers["user-agent"] == "me@example.com"
    assert req.headers["host"] == "data.usajobs.gov"
    p = res.postings[0]
    assert p.company == "Bureau of the Fiscal Service" and p.title == "IT Specialist (APPSW)"
    assert (p.salary_min, p.salary_max, p.currency) == (93808.0, 121950.4, "USD")
    assert "Build software." in p.description


# --------------------------------------------------------------------------- #
# Public APIs (fixtures recorded live 2026-10)
# --------------------------------------------------------------------------- #


@respx.mock
def test_bundesagentur_header_and_mapping():
    route = respx.get(url__startswith="https://rest.arbeitsagentur.de/").mock(
        return_value=httpx.Response(200, json=load_fixture("bundesagentur.json"))
    )
    res = fetch("DE", ["bundesagentur"], locations=["Berlin"], hours_old=72)
    req = route.calls[0].request
    assert req.headers["x-api-key"] == "jobboerse-jobsuche"
    assert req.url.params["wo"] == "Berlin" and req.url.params["veroeffentlichtseit"] == "3"
    assert "/pc/v6/jobs" in str(req.url)
    p = res.postings[0]
    assert p.source == "bundesagentur" and p.company == "Apimiel GmbH"
    assert p.url == "https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1003883299-S"
    assert p.location == "Berlin, Germany" and p.posted_at is not None


@respx.mock
def test_arbeitnow_feed_keyword_and_city_filter():
    respx.get(url__startswith="https://www.arbeitnow.com/api/job-board-api").mock(
        return_value=httpx.Response(200, json=load_fixture("arbeitnow.json"))
    )
    res = fetch("DE", ["arbeitnow"], keywords=["frontend"], locations=["Berlin"])
    assert res.counts == {"arbeitnow": 3}
    titles = sorted(p.title for p in res.postings)
    # Berlin match + the remote one (Hamburg, remote) ; the Munich simulation job is dropped
    assert titles == ["Frontend Developer (m/w/d)", "Senior React Frontend Engineer"]
    assert all(p.url.startswith("https://www.arbeitnow.com/") for p in res.postings)


@respx.mock
def test_arbeitnow_uk_endpoint():
    route = respx.get(url__startswith="https://www.arbeitnow.co.uk/api/job-board-api").mock(
        return_value=httpx.Response(200, json={"data": [], "links": {}})
    )
    fetch("GB", ["arbeitnow"])
    assert route.called


@respx.mock
def test_mycareersfuture_monthly_salary_annualised():
    route = respx.get(url__startswith="https://api.mycareersfuture.gov.sg/v2/jobs").mock(
        return_value=httpx.Response(200, json=load_fixture("mycareersfuture.json"))
    )
    res = fetch("SG", ["mycareersfuture"], locations=["Singapore", "Jurong"])
    assert route.call_count == 1  # Singapore: keywords only
    assert route.calls[0].request.url.params["sortBy"] == "new_posting_date"
    p = res.postings[0]
    assert (p.salary_min, p.salary_max, p.currency) == (72000, 78000, "SGD")
    assert p.location.startswith("Singapore") and p.url.startswith("https://www.mycareersfuture.gov.sg/job/")
    assert p.description and "<" not in p.description


@respx.mock
def test_remotive_attribution_eligibility_and_salary():
    respx.get(url__startswith="https://remotive.com/api/remote-jobs").mock(
        return_value=httpx.Response(200, json=load_fixture("remotive.json"))
    )
    res = fetch("IN", ["remotive"], keywords=["python"])
    # "USA Only" and "Europe" are not open to India; Worldwide is
    assert [p.location for p in res.postings] == ["Remote (Worldwide)"]
    assert res.postings[0].url.startswith("https://remotive.com/") and res.postings[0].source == "remotive"
    assert res.postings[0].salary_min is None  # "$1000 per task" ignored
    de = fetch("DE", ["remotive"], keywords=["python"])
    rails = next(p for p in de.postings if "Rails" in p.title)
    assert (rails.salary_min, rails.salary_max, rails.currency) == (120000, 150000, "USD")


@respx.mock
def test_remotive_queries_at_most_two_keywords():
    route = respx.get(url__startswith="https://remotive.com/api/remote-jobs").mock(
        return_value=httpx.Response(200, json={"jobs": []})
    )
    fetch("IN", ["remotive"], keywords=["a", "b", "c", "d"])
    assert route.call_count == 2


@respx.mock
def test_remoteok_skips_legal_row_and_filters():
    route = respx.get("https://remoteok.com/api").mock(
        return_value=httpx.Response(200, json=load_fixture("remoteok.json"))
    )
    res = fetch("IN", ["remoteok"], keywords=["python"])
    assert route.calls[0].request.headers["user-agent"].startswith("OrbitHire/")
    assert res.counts == {"remoteok": 3}
    # sales job filtered by keyword; US-only job not open to India
    assert [p.title for p in res.postings] == ["Senior Python Engineer"]
    p = res.postings[0]
    assert p.url.lower().startswith("https://remoteok.com/") and p.is_remote
    assert (p.salary_min, p.currency) == (120000, "USD")
    # display rule: credit Remote OK with a link back to its listing
    assert p.attribution == {"name": "Remote OK", "url": p.url, "home_url": "https://remoteok.com"}


@respx.mock
def test_himalayas_country_param_and_hourly_salary():
    route = respx.get(url__startswith="https://himalayas.app/jobs/api/search").mock(
        return_value=httpx.Response(200, json=load_fixture("himalayas.json"))
    )
    res = fetch("GB", ["himalayas"], keywords=["react"])
    params = route.calls[0].request.url.params
    assert params["country"] == "United Kingdom" and params["q"] == "react" and params["sort"] == "recent"
    lemon = res.postings[1]
    assert (lemon.salary_min, lemon.salary_max, lemon.currency) == (124800, 166400, "USD")
    assert "more)" in lemon.location and lemon.url.startswith("https://himalayas.app/")


@respx.mock
def test_jobicy_geo_and_salary_period():
    route = respx.get(url__startswith="https://jobicy.com/api/v2/remote-jobs").mock(
        return_value=httpx.Response(200, json=load_fixture("jobicy.json"))
    )
    res = fetch("IN", ["jobicy"], keywords=["python"])
    assert route.calls[0].request.url.params["geo"] == "apac"  # "india" is rejected by Jobicy
    a, b = res.postings
    assert (a.salary_min, a.salary_max, a.currency) == (121500, 178500, "USD")
    assert (b.salary_min, b.salary_max, b.currency) == (60000, 72000, "EUR")  # monthly x12


# --------------------------------------------------------------------------- #
# Isolation, retries, recency, concurrency with JobSpy
# --------------------------------------------------------------------------- #


@respx.mock
def test_one_source_failing_does_not_affect_others():
    respx.get(url__startswith="https://himalayas.app/").mock(return_value=httpx.Response(500))
    respx.get(url__startswith="https://jobicy.com/").mock(
        return_value=httpx.Response(200, json=load_fixture("jobicy.json"))
    )
    res = fetch("GB", ["himalayas", "jobicy"], keywords=["python"])
    assert "giving up" in res.errors["himalayas"] and res.counts["himalayas"] == 0
    assert "jobicy" not in res.errors and len(res.postings) == 2


@respx.mock
def test_retry_on_429_then_success():
    route = respx.get(url__startswith="https://rest.arbeitsagentur.de/").mock(
        side_effect=[
            httpx.Response(429, headers={"retry-after": "1"}),
            httpx.ConnectTimeout("t"),
            httpx.Response(200, json=load_fixture("bundesagentur.json")),
        ]
    )
    res = fetch("DE", ["bundesagentur"])
    assert route.call_count == 3 and len(res.postings) == 2 and res.errors == {}


@respx.mock
def test_partial_query_failure_is_reported_but_keeps_results():
    respx.get(url__startswith="https://rest.arbeitsagentur.de/", params={"was": "bad"}).mock(
        return_value=httpx.Response(400)
    )
    respx.get(url__startswith="https://rest.arbeitsagentur.de/").mock(
        return_value=httpx.Response(200, json=load_fixture("bundesagentur.json"))
    )
    res = fetch("DE", ["bundesagentur"], keywords=["bad", "python"])
    assert len(res.postings) == 2 and "'bad'" in res.errors["bundesagentur"]


@respx.mock
def test_query_iteration_is_bounded():
    route = respx.get(url__startswith="https://rest.arbeitsagentur.de/").mock(
        return_value=httpx.Response(200, json={"ergebnisliste": []})
    )
    fetch("DE", ["bundesagentur"], keywords=["a", "b", "c"], locations=["Berlin", "Hamburg", "Munich"])
    assert route.call_count == base.MAX_QUERIES


def test_recency_window(monkeypatch):
    monkeypatch.undo()  # real cutoff
    q = SourceQuery(keywords=["x"], locations=["India"], country=country_info("IN"), hours_old=24)
    from orbithire_worker.fetchers.models import NormalizedPosting

    now = datetime.now(UTC)
    mk = lambda h: NormalizedPosting(source="s", url="u", title="t", company="c", posted_at=now - timedelta(hours=h))  # noqa: E731
    kept = base.recent([mk(1), mk(60), mk(100), NormalizedPosting(source="s", url="u", title="t", company="c")], q)
    assert len(kept) == 3  # 1h, 60h (< 24+48), undated


def test_remote_eligible():
    india, uk, us = country_info("IN"), country_info("GB"), country_info("US")
    assert remote_eligible("Worldwide", india) and remote_eligible("", india)
    assert remote_eligible("India", india) and remote_eligible("APAC", india)
    assert not remote_eligible("USA Only", india) and not remote_eligible("Europe", india)
    assert remote_eligible("Europe", uk) and remote_eligible("UK", uk)
    assert remote_eligible("USA Only", us) and not remote_eligible("Germany", us)


@respx.mock
def test_fetch_search_runs_jobspy_and_apis_and_dedupes_across_sources():
    """Same job on Reed and Adzuna (and LinkedIn via JobSpy) -> one posting."""
    respx.get(url__startswith="https://www.reed.co.uk/").mock(
        return_value=httpx.Response(200, json={"results": [{
            "jobId": 1, "employerName": "Acme Ltd", "jobTitle": "Python Developer",
            "locationName": "London", "date": "19/10/2026", "jobUrl": "https://reed/1",
            "minimumSalary": 50000, "maximumSalary": 60000, "currency": "GBP",
        }]})
    )
    respx.get(url__startswith="https://api.adzuna.com/").mock(
        return_value=httpx.Response(200, json={"results": [{
            "id": "9", "title": "Python Developer", "redirect_url": "https://adzuna/9",
            "company": {"display_name": "ACME Limited"}, "location": {"display_name": "London, UK"},
            "created": "2026-10-19T00:00:00Z", "description": "Longer description",
        }]})
    )
    calls = []

    def fake_scrape(**kw):
        import pandas as pd

        calls.append(kw)
        return pd.DataFrame([{
            "site": kw["site_name"][0], "id": "li-1", "title": "Python Developer", "company": "Acme",
            "location": "London, England, UK", "job_url": "https://li/1", "description": "desc",
        }])

    s = spec("GB", ["reed", "adzuna"], sites=["linkedin", "naukri"], locations=["London"])
    res = run(fetch_search(s, scrape=fake_scrape, sleep=lambda _s: None, env=KEYS))
    assert res.skipped == {"naukri": "not available for United Kingdom"}
    assert [c["site_name"] for c in calls] == [["linkedin"]]
    assert calls[0]["country_indeed"] == "uk" and calls[0]["location"] == "London"
    assert res.counts == {"linkedin": 1, "reed": 1, "adzuna": 1}
    assert len(res.postings) == 1 and res.duplicates == 2


def test_fetch_search_unsupported_country():
    res = run(fetch_search(spec("ZZ", ["remotive"]), env={}))
    assert "unsupported country" in res.errors["country"] and res.postings == []
