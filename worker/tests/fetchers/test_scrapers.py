"""Tier 3 scrapers (Wellfound, Instahyre, Cutshort, Seek): mapping, salary parsing,
robots.txt, 403/429 stop, bot challenge, kill switch, country fit, volume caps.

Fixtures in fixtures/scrapers/ are trimmed real responses fetched once (2026-10).
"""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
import respx

from orbithire_worker.fetchers import SearchSpec, fetch_api_sources
from orbithire_worker.fetchers.common import parse_salary_text
from orbithire_worker.fetchers.countries import country_info
from orbithire_worker.fetchers.sources import (
    API_SOURCE_ENV,
    API_SOURCES,
    _scraper,
    cutshort,
    instahyre,
    seek,
    wellfound,
)
from orbithire_worker.fetchers.sources._scraper import (
    SCRAPER_UA,
    RobotsRules,
    ScraperBlocked,
    is_challenge,
    scraper_disabled,
)
from orbithire_worker.fetchers.sources.base import SourceQuery

FIX = Path(__file__).parent / "fixtures" / "scrapers"


def fx(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


def run(coro):
    return asyncio.run(coro)


def spec(country="IN", sources=(), **kw):
    kw.setdefault("keywords", ["software engineer"])
    kw.setdefault("locations", [])
    kw.setdefault("sites", [])
    return SearchSpec(country=country, sources=list(sources), **kw)


def fetch(country, sources, env=None, **kw):
    return run(fetch_api_sources(spec(country, sources, **kw), env={} if env is None else env))


def query(country="IN", keywords=("software engineer",), locations=(), **kw):
    info = country_info(country)
    return SourceQuery(keywords=list(keywords), locations=list(locations) or [info.name], country=info, **kw)


@pytest.fixture
def delays(monkeypatch):
    seen: list[float] = []

    async def record(s: float) -> None:
        seen.append(s)

    monkeypatch.setattr(_scraper, "_sleep", record)
    return seen


def html(body: str, status: int = 200) -> httpx.Response:
    return httpx.Response(status, text=body, headers={"content-type": "text/html"})


def robots(router, host: str, body: str, status: int = 200):
    return router.get(f"https://{host}/robots.txt").mock(return_value=httpx.Response(status, text=body))


# --------------------------------------------------------------------------- #
# Registry, kill switch, country fit
# --------------------------------------------------------------------------- #


def test_registry_flags():
    for sid in ("wellfound", "instahyre", "cutshort", "seek"):
        assert API_SOURCES[sid].scraper
    assert API_SOURCES["wellfound"].countries is None
    assert API_SOURCES["instahyre"].countries == {"IN"}
    assert API_SOURCES["cutshort"].countries == {"IN"}
    assert API_SOURCES["seek"].countries == {"AU", "NZ"}
    assert API_SOURCES["seek"].blocked.startswith("blocked: requires browser")
    assert not API_SOURCES["adzuna"].scraper
    assert {"JOB_SCRAPERS_ENABLED", "SCRAPER_DISABLE"} <= set(API_SOURCE_ENV)


def test_scraper_disabled_env():
    assert scraper_disabled("wellfound", {}) is None
    assert scraper_disabled("wellfound", {"JOB_SCRAPERS_ENABLED": "true"}) is None
    assert "JOB_SCRAPERS_ENABLED" in scraper_disabled("wellfound", {"JOB_SCRAPERS_ENABLED": "false"})
    assert scraper_disabled("wellfound", {"JOB_SCRAPERS_ENABLED": "0"})
    assert scraper_disabled("seek", {"SCRAPER_DISABLE": "seek, Wellfound"})
    assert scraper_disabled("wellfound", {"SCRAPER_DISABLE": "seek,wellfound"})
    assert scraper_disabled("cutshort", {"SCRAPER_DISABLE": "seek,wellfound"}) is None


def test_kill_switch_makes_no_requests():
    with respx.mock(assert_all_called=False) as router:
        any_route = router.route()
        res = fetch("IN", ["wellfound", "instahyre", "cutshort"], env={"JOB_SCRAPERS_ENABLED": "false"})
    assert not any_route.called
    assert set(res.skipped) == {"wellfound", "instahyre", "cutshort"}
    assert all("JOB_SCRAPERS_ENABLED" in v for v in res.skipped.values())
    assert res.errors == {} and res.postings == []


def test_per_source_disable():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.instahyre.com", fx("robots_instahyre.txt"))
        router.get("https://www.instahyre.com/api/v1/job_search").mock(
            return_value=httpx.Response(200, text=fx("instahyre.json"))
        )
        wf = router.route(host="wellfound.com")
        res = fetch("IN", ["wellfound", "instahyre"], env={"SCRAPER_DISABLE": "wellfound"})
    assert not wf.called
    assert res.skipped["wellfound"] == "disabled by SCRAPER_DISABLE"
    assert res.counts["instahyre"] == 6


def test_country_fit():
    with respx.mock(assert_all_called=False) as router:
        any_route = router.route()
        gb = fetch("GB", ["instahyre", "cutshort", "seek"])
        india = fetch("IN", ["seek"])
        au = fetch("AU", ["seek", "instahyre"])
    assert not any_route.called
    assert gb.skipped == {
        "instahyre": "not available for United Kingdom",
        "cutshort": "not available for United Kingdom",
        "seek": "not available for United Kingdom",
    }
    assert india.skipped["seek"] == "not available for India"
    assert au.skipped["seek"].startswith("blocked: requires browser")
    assert au.skipped["instahyre"] == "not available for Australia"


# --------------------------------------------------------------------------- #
# robots.txt
# --------------------------------------------------------------------------- #


def test_robots_wellfound_rules():
    r = RobotsRules.parse(fx("robots_wellfound.txt"))
    assert r.allowed("/role/l/software-engineer/india")
    assert r.allowed("/role/r/frontend-engineer")
    assert not r.allowed("/search")
    assert not r.allowed("/search/jobs?q=x")
    assert not r.allowed("/role/l/x/india?jobId=12")
    assert not r.allowed("/jobs/applications")


def test_robots_seek_wildcards_and_allow():
    r = RobotsRules.parse(fx("robots_seek.txt"))
    assert r.allowed("/react-developer-jobs/in-Sydney-NSW")
    assert not r.allowed("/api/jobsearch/v5/search?keywords=react")
    assert not r.allowed("/react-developer-jobs?page=2")  # Disallow: *?
    assert r.allowed("/jobs?keywords=react")  # Allow: *?keywords (longer)
    assert not r.allowed("/job/12345")


def test_robots_cutshort_and_instahyre():
    c = RobotsRules.parse(fx("robots_cutshort.txt"))
    assert c.allowed("/jobs/reactjs-jobs-in-pune")
    assert not c.allowed("/jobs/x?free_text=react")
    assert not c.allowed("/view/j/abc")
    assert RobotsRules.parse(fx("robots_instahyre.txt")).allowed("/api/v1/job_search?skills=python&offset=0")


def test_robots_specific_group_and_ties():
    text = "User-agent: *\nDisallow: /\n\nUser-agent: OrbitHire\nDisallow: /private\nAllow: /private/ok$\n"
    r = RobotsRules.parse(text)
    assert r.allowed("/jobs") and not r.allowed("/private/x") and r.allowed("/private/ok")
    assert not r.allowed("/private/ok/more")
    assert RobotsRules.parse("User-agent: *\nDisallow: /a\nAllow: /a\n").allowed("/a")  # tie -> allow
    assert RobotsRules.parse("User-agent: *\nDisallow:\n").allowed("/anything")


def test_robots_disallow_skips_without_request():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "cutshort.io", "User-agent: *\nDisallow: /jobs/\n")
        page = router.route(host="cutshort.io", path__startswith="/jobs/")
        res = fetch("IN", ["cutshort"], keywords=["python developer"])
    assert not page.called
    assert res.skipped["cutshort"].startswith("disallowed by robots.txt: /jobs/python-jobs")
    assert "cutshort" not in res.errors


def test_robots_5xx_means_disallow_all():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.instahyre.com", "oops", status=503)
        api = router.get("https://www.instahyre.com/api/v1/job_search")
        res = fetch("IN", ["instahyre"])
    assert not api.called
    assert "instahyre" in res.skipped


def test_robots_403_stops():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", "no", status=403)
        page = router.route(host="wellfound.com", path__startswith="/role/")
        res = fetch("DE", ["wellfound"])
    assert not page.called
    assert res.errors["wellfound"].startswith("stopped: robots.txt answered HTTP 403")


# --------------------------------------------------------------------------- #
# Politeness: delays, UA, stop on 403/429, challenge, volume caps
# --------------------------------------------------------------------------- #


def test_delays_user_agent_and_two_query_cap(delays):
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        page = router.route(host="wellfound.com", path__startswith="/role/").mock(
            return_value=html(fx("wellfound_location.html"))
        )
        res = fetch("IN", ["wellfound"], keywords=["software engineer", "backend engineer", "data engineer"],
                    locations=["Bangalore", "Pune"])
    assert page.call_count == 2  # max 2 queries per source per run
    assert len(delays) == 2 and all(2.0 <= d <= 5.0 for d in delays)  # before each request after robots.txt
    for call in router.calls:
        assert call.request.headers["user-agent"] == SCRAPER_UA
        assert "cookie" not in call.request.headers
    assert res.counts["wellfound"] > 0


def test_429_stops_source_and_reports():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        page = router.route(host="wellfound.com", path__startswith="/role/").mock(
            return_value=httpx.Response(429, text="slow down")
        )
        res = fetch("IN", ["wellfound"], keywords=["software engineer", "backend engineer"])
    assert page.call_count == 1  # no retry, no second query
    assert res.errors["wellfound"].startswith("stopped: HTTP 429")
    assert res.postings == []


def test_403_after_a_success_keeps_postings_and_stops():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        page = router.route(host="wellfound.com", path__startswith="/role/").mock(
            side_effect=[html(fx("wellfound_location.html")), httpx.Response(403, text="forbidden")]
        )
        res = fetch("IN", ["wellfound"], keywords=["software engineer", "backend engineer"], remote_ok=False)
    assert page.call_count == 2
    assert "stopped: HTTP 403" in res.errors["wellfound"]
    assert res.postings  # first page kept


def test_cloudflare_challenge_is_blocked():
    assert is_challenge(fx("seek_challenge.html"))
    assert not is_challenge(fx("cutshort_listing.html"))
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.seek.com.au", fx("robots_seek.txt"))
        page = router.get("https://www.seek.com.au/react-developer-jobs/in-Sydney").mock(
            return_value=html(fx("seek_challenge.html"), status=403)
        )
        with pytest.raises(ScraperBlocked, match="blocked: requires browser"):
            run(_seek_probe(query("AU", ["react developer"], ["Sydney"])))
    assert page.call_count == 1


async def _seek_probe(q):
    async with httpx.AsyncClient() as client:
        return await seek.fetch(client, q)


def test_seek_hosts_and_paths():
    assert seek.HOSTS == {"AU": "https://www.seek.com.au", "NZ": "https://www.seek.co.nz"}
    assert seek.listing_path("React Developer", "new south wales") == "/react-developer-jobs/in-New-South-Wales"
    assert seek.listing_path("python", None) == "/python-jobs"


def test_results_capped_at_30():
    base = json.loads(fx("instahyre.json"))
    objs = [dict(base["objects"][0], id=1000 + i, public_url=f"https://www.instahyre.com/job-{1000 + i}/") for i in range(35)]
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.instahyre.com", fx("robots_instahyre.txt"))
        router.get("https://www.instahyre.com/api/v1/job_search").mock(
            return_value=httpx.Response(200, json={"meta": {}, "objects": objs})
        )
        res = fetch("IN", ["instahyre"], keywords=["frontend developer"], results_wanted=100)
    assert res.counts["instahyre"] == 35
    assert len(res.postings) == 30


# --------------------------------------------------------------------------- #
# Wellfound
# --------------------------------------------------------------------------- #


def test_wellfound_plan():
    q = query("IN", ["Senior Frontend Developer"], remote_ok=True)
    assert wellfound.plan(q) == [
        ("/role/l/frontend-engineer/india", "Senior Frontend Developer", "location"),
        ("/role/r/frontend-engineer", "Senior Frontend Developer", "remote"),
    ]
    q = query("US", ["full stack developer"], ["Bengaluru", "Remote"], remote_ok=False)
    assert [p for p, _, _ in wellfound.plan(q)] == ["/role/l/full-stack-engineer/bangalore", "/role/r/full-stack-engineer"]
    assert wellfound.role_slug("python dev") == "python-engineer"


def test_wellfound_mapping_location_page():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        router.get("https://wellfound.com/role/l/software-engineer/india").mock(
            return_value=html(fx("wellfound_location.html"))
        )
        res = fetch("IN", ["wellfound"], remote_ok=False)
    assert res.counts["wellfound"] == 9
    by_id = {p.external_id: p for p in res.postings}
    sardine = by_id["4844774"]
    assert sardine.source == "wellfound"
    assert sardine.title == "Software Engineer - Backend"
    assert sardine.company == "Sardine"
    assert sardine.url == "https://wellfound.com/jobs/4844774-software-engineer-backend"
    assert sardine.is_remote and sardine.location == "India (Remote)"
    assert (sardine.salary_min, sardine.salary_max, sardine.currency) == (3_000_000, 5_000_000, "INR")
    assert sardine.posted_at == datetime(2026, 10, 14, 23, 21, 26, tzinfo=UTC)
    assert sardine.description and len(sardine.description) > 50
    assert sardine.raw["startup"]["name"] == "Sardine" and "description" not in sardine.raw
    # "₹10L – ₹20L • 0.05% – 0.1%": equity part ignored
    clear = by_id["1720070"]
    assert (clear.salary_min, clear.salary_max, clear.currency) == (1_000_000, 2_000_000, "INR")
    nosal = by_id["4824775"]
    assert nosal.salary_min is None and nosal.currency is None
    assert all(p.raw["orbithire_country"] == "IN" for p in res.postings)


def test_wellfound_remote_page_filters_by_country():
    def go(country):
        with respx.mock(assert_all_called=False) as router:
            robots(router, "wellfound.com", fx("robots_wellfound.txt"))
            router.get("https://wellfound.com/role/r/software-engineer").mock(
                return_value=html(fx("wellfound_remote.html"))
            )
            return fetch(country, ["wellfound"], locations=["Remote"])

    us = go("US")
    assert us.postings and all(p.is_remote for p in us.postings)
    assert all(p.currency in (None, "USD") for p in us.postings)
    assert any(p.salary_min == 114_000 and p.salary_max == 148_000 for p in us.postings)
    india = go("IN")  # these remote jobs only accept US candidates
    assert india.counts["wellfound"] > 0 and india.postings == []


def test_wellfound_unknown_role_filters_locally():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        router.get("https://wellfound.com/role/r/zzz-engineer").mock(return_value=html(fx("wellfound_generic.html")))
        res = fetch("US", ["wellfound"], keywords=["zzz developer"], locations=["Remote"])
    assert res.counts["wellfound"] > 0
    assert res.postings == []  # generic page: nothing matches the keyword


def test_wellfound_layout_change_is_an_error():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "wellfound.com", fx("robots_wellfound.txt"))
        router.route(host="wellfound.com", path__startswith="/role/").mock(return_value=html("<html>nothing</html>"))
        res = fetch("IN", ["wellfound"], remote_ok=False)
    assert "no __NEXT_DATA__" in res.errors["wellfound"]


# --------------------------------------------------------------------------- #
# Instahyre
# --------------------------------------------------------------------------- #


def test_instahyre_mapping_and_city_filter():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.instahyre.com", fx("robots_instahyre.txt"))
        api = router.get("https://www.instahyre.com/api/v1/job_search").mock(
            return_value=httpx.Response(200, text=fx("instahyre.json"))
        )
        res = fetch("IN", ["instahyre"], keywords=["Frontend Developer"], locations=["Bengaluru"])
    assert api.calls[0].request.url.params["skills"] == "Frontend Developer"
    assert res.counts["instahyre"] == 6
    assert len(res.postings) == 5  # the Noida job is filtered out
    p = res.postings[0]
    assert p.source == "instahyre" and p.title == "Frontend Developer" and p.company == "Big Assets Infra"
    assert p.url == "https://www.instahyre.com/job-442064-frontend-developer-at-big-assets-infra-bangalore/"
    assert p.external_id == "442064" and p.location == "Bangalore"
    assert p.description is None and p.salary_min is None and p.posted_at is None
    assert p.raw["employer"]["company_name"] == "Big Assets Infra"


def test_instahyre_whole_country_and_wfh():
    job = {"id": 1, "title": "X", "locations": "Work From Home,Pune", "employer": {"company_name": "A"}}
    assert instahyre.map_instahyre(job).is_remote
    assert instahyre.location_ok(job, ["Chennai"], remote_ok=True)
    assert not instahyre.location_ok(job, ["Chennai"], remote_ok=False)
    assert instahyre.location_ok(job, [], remote_ok=False)


def test_instahyre_unexpected_payload():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "www.instahyre.com", fx("robots_instahyre.txt"))
        router.get("https://www.instahyre.com/api/v1/job_search").mock(return_value=httpx.Response(200, json={"x": 1}))
        res = fetch("IN", ["instahyre"])
    assert "unexpected payload" in res.errors["instahyre"]


# --------------------------------------------------------------------------- #
# Cutshort
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("kw", "slug"),
    [
        ("React Developer", "reactjs"),
        ("Senior Frontend Engineer", "frontend-developer"),
        ("full stack developer", "fullstack-developer"),
        ("python developer", "python"),
        ("Node.js", "nodejs"),
        ("Data Scientist", "datascience"),
        ("Product Manager", "product-manager"),
        ("golang", "golang"),
    ],
)
def test_cutshort_keyword_slug(kw, slug):
    assert cutshort.keyword_slug(kw) == slug


def test_cutshort_plan():
    q = query("IN", ["react developer"], ["Bengaluru", "Gurugram", "Mysore"])
    assert cutshort.plan(q) == [
        ("/jobs/reactjs-jobs-in-bangalore-bengaluru", "react developer", None),
        ("/jobs/reactjs-jobs-in-delhi-ncr-gurgaon-noida", "react developer", None),
    ]
    q = query("IN", ["python"], ["Mysore"])
    assert cutshort.plan(q) == [("/jobs/python-jobs", "python", "Mysore")]
    assert cutshort.plan(query("IN", ["python"])) == [("/jobs/python-jobs", "python", None)]


def test_cutshort_mapping():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "cutshort.io", fx("robots_cutshort.txt"))
        router.get("https://cutshort.io/jobs/reactjs-jobs-in-bangalore-bengaluru").mock(
            return_value=html(fx("cutshort_listing.html"))
        )
        res = fetch("IN", ["cutshort"], keywords=["react developer"], locations=["Bangalore"])
    assert res.counts["cutshort"] == 4 and len(res.postings) == 4
    p = res.postings[0]
    assert p.source == "cutshort" and p.external_id == "6ac49374e34a0c3e5b63ea4c"
    assert p.title == "Sr. React.js Developer" and p.company == "Euphoric Thought Technologies"
    assert p.url.startswith("https://cutshort.io/job/Sr-React-js-Developer")
    assert p.location == "Bengaluru (Bangalore)" and not p.is_remote
    # "₹10L - ₹20L / yr" (what the site shows) -> INR annual
    assert (p.salary_min, p.salary_max, p.currency) == (1_000_000, 2_000_000, "INR")
    assert p.posted_at == datetime(2026, 10, 6, 6, 21, 40, 448000, tzinfo=UTC)
    assert p.description.startswith("Responsibilities:") and "<" not in p.description
    assert "sanitizedComment" not in p.raw and "createdBy" not in p.raw


def test_cutshort_unknown_slug_is_reported():
    with respx.mock(assert_all_called=False) as router:
        robots(router, "cutshort.io", fx("robots_cutshort.txt"))
        router.get("https://cutshort.io/jobs/zzz-jobs").mock(return_value=html(fx("cutshort_unknown.html")))
        res = fetch("IN", ["cutshort"], keywords=["zzz"])
    assert "no Cutshort listing page for 'zzz'" in res.errors["cutshort"]


def test_cutshort_remote_type():
    assert cutshort.map_cutshort({"_id": "a", "headline": "X", "remoteType": "fully_remote"}).is_remote
    assert not cutshort.map_cutshort({"_id": "a", "headline": "X", "remoteType": "remote_not_okay"}).is_remote
    j = {"_id": "a", "headline": "X", "salaryRange": {"currency": "INR", "min": 800000, "max": 1200000}}
    p = cutshort.map_cutshort(j)
    assert (p.salary_min, p.salary_max, p.currency) == (800000, 1200000, "INR")


# --------------------------------------------------------------------------- #
# Salary text (common.parse_salary_text) as these boards show it
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("₹10L - ₹20L / yr", (1_000_000, 2_000_000, "INR")),
        ("₹12L – ₹16L", (1_200_000, 1_600_000, "INR")),
        ("8-12 LPA", (800_000, 1_200_000, "INR")),
        ("₹1.2Cr – ₹1.5Cr", (12_000_000, 15_000_000, "INR")),
        ("$114k – $148k", (114_000, 148_000, "USD")),
        ("AU$90,000 – AU$110,000 per year", (90_000, 110_000, "AUD")),
        ("A$55 – A$65 per hour", (114_400, 135_200, "AUD")),
        ("NZ$85k - NZ$100k", (85_000, 100_000, "NZD")),
        ("€60k – €75k", (60_000, 75_000, "EUR")),
    ],
)
def test_salary_parsing(text, expected):
    assert parse_salary_text(text) == expected
