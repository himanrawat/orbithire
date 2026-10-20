"""Tier 2 ATS boards (fixtures recorded live 2026-10)."""

import asyncio

import httpx
import pytest
import respx

from orbithire_worker.fetchers import fetch_company
from orbithire_worker.fetchers.ats import AtsError, fetch_ats
from orbithire_worker.fetchers.models import WatchedCompany

from .conftest import FIXTURES, load_fixture

WORKABLE = "https://apply.workable.com/api/v1/widget/accounts/skroutz?details=true"
SR = "https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings"
RECRUITEE = "https://bunq.recruitee.com/api/offers/"
PERSONIO_DE = "https://personio.jobs.personio.de/xml?language=en"
PERSONIO_COM = "https://personio.jobs.personio.com/xml?language=en"
TEAMTAILOR = "https://polestar.teamtailor.com/jobs.rss"


def run(coro):
    return asyncio.run(coro)


def wc(ats, token, company="X", **kw):
    return WatchedCompany(company=company, ats=ats, board_token=token, **kw)


@respx.mock
def test_workable_mapping():
    respx.get(WORKABLE).mock(return_value=httpx.Response(200, json=load_fixture("workable_skroutz.json")))
    jobs = run(fetch_ats(wc("workable", "skroutz", "Skroutz")))
    assert len(jobs) == 2
    a, b = jobs
    assert a.source == "workable" and a.company == "Skroutz S.A"
    assert a.location == "Athens, Attica, Greece" and not a.is_remote
    assert a.url == "https://apply.workable.com/j/B4A0F1A2AB" and a.external_id == "B4A0F1A2AB"
    assert a.description and "<" not in a.description and a.posted_at is not None
    assert b.is_remote


@respx.mock
def test_smartrecruiters_list_paging_and_detail_enrichment():
    listing = load_fixture("smartrecruiters_ubisoft.json")
    route = respx.get(SR).mock(return_value=httpx.Response(200, json=listing))
    first_id = listing["content"][0]["id"]
    detail = respx.get(f"{SR}/{first_id}").mock(
        return_value=httpx.Response(200, json={"jobAd": {"sections": {
            "jobDescription": {"title": "Job Description", "text": "<p>Build engines in C++.</p>"},
            "qualifications": {"title": "Qualifications", "text": "<ul><li>C++</li></ul>"},
        }}})
    )
    res = run(fetch_company(wc("smartrecruiters", "Ubisoft2", "Ubisoft"), include=["Engineer"]))
    assert route.calls[0].request.url.params["limit"] == "100"
    assert route.call_count == 1  # totalFound reached
    assert res.counts == {"smartrecruiters": 2} and res.filtered_out == 1
    p = res.postings[0]
    assert p.title == "R&D Engineer (C++)" and p.company == "Ubisoft" and p.location == "Pune, MH, India"
    assert p.url == "https://jobs.smartrecruiters.com/Ubisoft2/744000156377199"
    assert detail.called and "Build engines in C++." in p.description and "- C++" in p.description


@respx.mock
def test_smartrecruiters_detail_failure_is_ignored():
    listing = load_fixture("smartrecruiters_ubisoft.json")
    respx.get(SR).mock(return_value=httpx.Response(200, json=listing))
    respx.get(url__regex=rf"{SR}/\d+").mock(return_value=httpx.Response(404))
    res = run(fetch_company(wc("smartrecruiters", "Ubisoft2", "Ubisoft")))
    assert res.errors == {} and len(res.postings) == 2 and res.postings[0].description is None


@respx.mock
def test_smartrecruiters_unknown_company_is_empty():
    respx.get(SR.replace("Ubisoft2", "Nope")).mock(
        return_value=httpx.Response(200, json={"offset": 0, "limit": 100, "totalFound": 0, "content": []})
    )
    assert run(fetch_ats(wc("smartrecruiters", "Nope"))) == []


@respx.mock
def test_recruitee_mapping_and_monthly_salary():
    respx.get(RECRUITEE).mock(return_value=httpx.Response(200, json=load_fixture("recruitee_bunq.json")))
    a, b = run(fetch_ats(wc("recruitee", "bunq", "bunq")))
    assert a.source == "recruitee" and a.title == "Head of Product"
    assert a.location == "Amsterdam, Noord-Holland, Netherlands"
    assert a.url == "https://careers.bunq.com/o/head-of-product-6"
    assert a.salary_min is None and a.description
    assert (b.salary_min, b.salary_max, b.currency) == (48000, 60000, "EUR")


@respx.mock
def test_personio_xml_de_then_com_fallback():
    xml = (FIXTURES / "personio.xml").read_text(encoding="utf-8")
    de = respx.get(PERSONIO_DE).mock(return_value=httpx.Response(404))
    com = respx.get(PERSONIO_COM).mock(return_value=httpx.Response(200, text=xml))
    jobs = run(fetch_ats(wc("personio", "personio", "Personio", region="eu")))
    assert de.called and com.called
    p = jobs[0]
    assert p.source == "personio" and p.title == "Staff Software Engineer, Data Platform"
    assert p.company == "Personio SE & Co. KG" and p.location == "Munich, Berlin"
    assert p.url == "https://personio.jobs.personio.com/job/1834171"
    assert p.description and "The Role" in p.description and "<" not in p.description


@respx.mock
def test_personio_invalid_xml():
    respx.get(PERSONIO_DE).mock(return_value=httpx.Response(200, text="<html>nope"))
    with pytest.raises(AtsError, match="Personio XML"):
        run(fetch_ats(wc("personio", "personio", region="eu")))


@respx.mock
def test_teamtailor_rss():
    xml = (FIXTURES / "teamtailor_polestar.xml").read_text(encoding="utf-8")
    route = respx.get(TEAMTAILOR).mock(return_value=httpx.Response(200, text=xml))
    jobs = run(fetch_ats(wc("teamtailor", "polestar", "Polestar")))
    assert route.called and len(jobs) == 2
    p = jobs[0]
    assert p.source == "teamtailor" and p.company == "Polestar"
    assert p.location == "Beesd, Netherlands" and not p.is_remote
    assert p.url.startswith("https://polestar.teamtailor.com/jobs/")
    assert p.posted_at is not None and p.posted_at.tzinfo is not None
    assert p.description and "<" not in p.description


@respx.mock
def test_teamtailor_falls_back_to_na_cluster():
    main = respx.get("https://acme.teamtailor.com/jobs.rss").mock(return_value=httpx.Response(404))
    na = respx.get("https://acme.na.teamtailor.com/jobs.rss").mock(
        return_value=httpx.Response(200, text="<rss><channel><title>Acme</title></channel></rss>")
    )
    assert run(fetch_ats(wc("teamtailor", "acme"))) == []
    assert main.called and na.called


@respx.mock
def test_new_ats_errors_are_captured_by_fetch_company():
    respx.get(RECRUITEE).mock(return_value=httpx.Response(404))
    res = run(fetch_company(wc("recruitee", "bunq")))
    assert "404" in res.errors["recruitee"] and res.counts == {"recruitee": 0}


@respx.mock
def test_workable_retries_then_succeeds():
    route = respx.get(WORKABLE).mock(
        side_effect=[httpx.Response(503), httpx.Response(200, json={"name": "S", "jobs": []})]
    )
    assert run(fetch_ats(wc("workable", "skroutz"))) == [] and route.call_count == 2
