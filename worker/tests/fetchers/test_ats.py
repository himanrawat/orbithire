import asyncio

import httpx
import pytest
import respx

from orbithire_worker.fetchers import ats
from orbithire_worker.fetchers.ats import AtsError, fetch_ats, html_to_text
from orbithire_worker.fetchers.models import WatchedCompany

from .conftest import load_fixture

GH = "https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=true"
GH_EU = "https://boards-api.eu.greenhouse.io/v1/boards/polyai/jobs?content=true"
GH_EU_FALLBACK = "https://boards-api.greenhouse.io/v1/boards/polyai/jobs?content=true"
LEVER = "https://api.lever.co/v0/postings/qonto?mode=json"
ASHBY = "https://api.ashbyhq.com/posting-api/job-board/lovable?includeCompensation=true"


def run(coro):
    return asyncio.run(coro)


@respx.mock
def test_greenhouse_mapping():
    route = respx.get(GH).mock(return_value=httpx.Response(200, json=load_fixture("greenhouse_vercel.json")))
    jobs = run(fetch_ats(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel")))
    assert route.called
    assert route.calls[0].request.headers["user-agent"].startswith("OrbitHire/")
    assert len(jobs) == 3
    j = jobs[1]
    assert j.source == "greenhouse"
    assert j.title == "Design Engineer"
    assert j.company == "Vercel"
    assert j.location == "Remote - United States"
    assert j.is_remote is True
    assert j.url.startswith("https://job-boards.greenhouse.io/vercel/jobs/")
    assert j.external_id and j.external_id.isdigit()
    assert j.posted_at is not None and j.posted_at.tzinfo is not None
    # escaped HTML content -> clean text
    assert "<" not in j.description and "&lt;" not in j.description
    assert "Vercel" in j.description
    assert "content" not in j.raw
    assert jobs[0].is_remote is False  # "Hybrid - London"


@respx.mock
def test_lever_mapping_and_salary_annualised():
    respx.get(LEVER).mock(return_value=httpx.Response(200, json=load_fixture("lever_qonto.json")))
    jobs = run(fetch_ats(WatchedCompany(company="Qonto", ats="lever", board_token="qonto")))
    assert len(jobs) == 2
    a, b = jobs
    assert a.source == "lever" and a.company == "Qonto"
    assert a.location == "Paris" and a.is_remote is False
    assert a.url.startswith("https://jobs.lever.co/qonto/")
    assert a.posted_at is not None
    assert a.description and "<" not in a.description
    # fixture salaryRange: EUR 5000-6000 per month
    assert (b.salary_min, b.salary_max, b.currency) == (60000, 72000, "EUR")


@respx.mock
def test_ashby_mapping_compensation_and_unlisted():
    respx.get(ASHBY).mock(return_value=httpx.Response(200, json=load_fixture("ashby_lovable.json")))
    jobs = run(fetch_ats(WatchedCompany(company="Lovable", ats="ashby", board_token="lovable")))
    titles = [j.title for j in jobs]
    assert "Unlisted role" not in titles
    assert len(jobs) == 2
    first, comp = jobs
    assert first.location == "Stockholm" and first.is_remote is False
    assert first.url.startswith("https://jobs.ashbyhq.com/lovable/")
    assert first.description and first.posted_at is not None
    assert comp.salary_min == 181000 and comp.salary_max == 246500 and comp.currency == "USD"


@respx.mock
def test_retries_on_429_then_succeeds():
    route = respx.get(GH).mock(
        side_effect=[
            httpx.Response(429, headers={"retry-after": "1"}),
            httpx.Response(503),
            httpx.Response(200, json={"jobs": []}),
        ]
    )
    jobs = run(fetch_ats(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel")))
    assert jobs == [] and route.call_count == 3


@respx.mock
def test_gives_up_after_max_attempts():
    route = respx.get(GH).mock(return_value=httpx.Response(500))
    with pytest.raises(AtsError, match="giving up"):
        run(fetch_ats(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel")))
    assert route.call_count == ats.MAX_ATTEMPTS


@respx.mock
def test_retries_on_transport_error():
    route = respx.get(GH).mock(side_effect=[httpx.ConnectTimeout("t"), httpx.Response(200, json={"jobs": []})])
    run(fetch_ats(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel")))
    assert route.call_count == 2


@respx.mock
def test_404_is_not_retried():
    route = respx.get(LEVER).mock(return_value=httpx.Response(404, json={"ok": False}))
    with pytest.raises(AtsError, match="404"):
        run(fetch_ats(WatchedCompany(company="Qonto", ats="lever", board_token="qonto")))
    assert route.call_count == 1


@respx.mock
def test_greenhouse_eu_falls_back_to_us_host():
    respx.get(GH_EU).mock(return_value=httpx.Response(404))
    us = respx.get(GH_EU_FALLBACK).mock(return_value=httpx.Response(200, json={"jobs": []}))
    run(fetch_ats(WatchedCompany(company="PolyAI", ats="greenhouse", board_token="polyai", region="eu")))
    assert us.called


def test_no_ats_raises():
    with pytest.raises(AtsError):
        run(fetch_ats(WatchedCompany(company="Retool", careers_url="https://retool.com/careers")))


def test_html_to_text():
    html = "&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;We build &amp;amp; ship.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;React&lt;/li&gt;&lt;li&gt;TS&lt;/li&gt;&lt;/ul&gt;"
    assert html_to_text(html) == "About\n\nWe build & ship.\n\n- React\n- TS"
    assert html_to_text("<p>a&nbsp;b</p><script>x()</script>") == "a b"
    assert html_to_text(None) == ""
