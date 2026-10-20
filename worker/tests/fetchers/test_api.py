"""Tests for the public facade: fetch_search / fetch_company."""

import asyncio

import httpx
import respx

from orbithire_worker.fetchers import FetchResult, SearchSpec, WatchedCompany, fetch_company, fetch_search

from .conftest import load_fixture
from .test_jobspy_source import LI_ROW, NK_ROW, fake_df

GH = "https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=true"


def test_fetch_search_filters_and_dedupes():
    junior = dict(LI_ROW, id="li-2", title="Junior Frontend Engineer", job_url="https://li/2")
    remote = dict(LI_ROW, id="li-3", title="Frontend Engineer", location="Remote", job_url="https://li/3")

    def fake_scrape(**kw):
        site = kw["site_name"][0]
        if site == "linkedin":
            return fake_df([LI_ROW, junior, remote])
        if site == "naukri":
            return fake_df([NK_ROW])
        raise RuntimeError("indeed down")

    spec = SearchSpec(
        keywords=["frontend"], locations=["Bangalore"], sites=["linkedin", "naukri", "indeed"],
        title_include=["Frontend"], title_exclude=["Junior"], remote_ok=False,
    )
    res = asyncio.run(fetch_search(spec, scrape=fake_scrape, sleep=lambda s: None))
    assert isinstance(res, FetchResult)
    assert res.counts == {"linkedin": 3, "naukri": 1, "indeed": 0}
    assert "indeed down" in res.errors["indeed"]
    assert res.filtered_out == 2  # junior + remote (remote_ok=False)
    assert res.duplicates == 1  # LinkedIn + Naukri same job
    assert len(res.postings) == 1
    # kept the one with a description
    assert res.postings[0].source == "linkedin"


@respx.mock
def test_fetch_company_ok_with_title_filter():
    respx.get(GH).mock(return_value=httpx.Response(200, json=load_fixture("greenhouse_vercel.json")))
    res = asyncio.run(
        fetch_company(
            WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel"),
            include=["Engineer"], exclude=["DevRel"],
        )
    )
    assert res.errors == {}
    assert res.counts == {"greenhouse": 3}
    assert [p.title for p in res.postings] == ["Design Engineer"]
    assert res.filtered_out == 2


@respx.mock
def test_fetch_company_error_is_captured():
    respx.get(GH).mock(return_value=httpx.Response(404))
    res = asyncio.run(fetch_company(WatchedCompany(company="Vercel", ats="greenhouse", board_token="vercel")))
    assert res.postings == [] and "404" in res.errors["greenhouse"]


def test_fetch_company_without_ats():
    res = asyncio.run(fetch_company(WatchedCompany(company="Retool", careers_url="https://retool.com/careers")))
    assert "ats" in res.errors and res.postings == []
