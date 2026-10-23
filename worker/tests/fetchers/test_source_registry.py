"""Source registry: legal basis per source, production gates and attribution."""

import asyncio
import re
from pathlib import Path

import pytest

from orbithire_worker.fetchers import FetchResult, SearchSpec, fetch_search
from orbithire_worker.fetchers.countries import _SITE_COUNTRIES
from orbithire_worker.fetchers.source_registry import (
    ENV_INDIA_SOURCES,
    ENV_TOS_RESTRICTED,
    SOURCES,
    attribution_for,
    policy_block,
)
from orbithire_worker.fetchers.sources import API_SOURCE_ENV, API_SOURCES, fetch_api_sources

MIGRATION = (
    Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "20261024000200_us_job_supply.sql"
)
JOBSPY_SITES = ("linkedin", "naukri", "indeed", "glassdoor", "google", "zip_recruiter", "bayt", "bdjobs")


@pytest.fixture
def gates_off(monkeypatch):
    monkeypatch.delenv(ENV_TOS_RESTRICTED, raising=False)
    monkeypatch.delenv(ENV_INDIA_SOURCES, raising=False)


def test_every_source_has_a_legal_basis():
    ids = set(API_SOURCES) | set(JOBSPY_SITES) | set(_SITE_COUNTRIES)
    ids |= {"greenhouse", "ashby", "lever", "smartrecruiters", "workable", "recruitee", "personio", "teamtailor"}
    missing = ids - set(SOURCES)
    assert not missing
    assert all(p.legal_basis.strip() for p in SOURCES.values())


def test_registry_matches_job_sources_migration():
    sql = MIGRATION.read_text(encoding="utf-8")
    block = sql.split("INSERT INTO job_sources", 1)[1].split("ON CONFLICT", 1)[0]
    rows = re.findall(r"\('([a-z_]+)', '[^']*', '(ats|api|jobspy|scraper)'.*?(TRUE|FALSE), (TRUE|FALSE), (TRUE|FALSE)\)", block)
    by_id = {r[0]: r for r in rows}
    assert set(by_id) == set(SOURCES)
    for sid, p in SOURCES.items():
        _, kind, tos, india, attr = by_id[sid]
        assert kind == p.kind
        assert (tos == "TRUE", india == "TRUE", attr == "TRUE") == (
            p.tos_restricted, p.india_only, p.attribution_required
        ), sid


@pytest.mark.usefixtures("gates_off")
def test_gates_default_off():
    for sid in ("linkedin", "glassdoor", "indeed"):
        assert "terms restrict" in (policy_block(sid, {}) or "")
    for sid in ("naukri", "instahyre", "cutshort"):
        assert "India-only" in (policy_block(sid, {}) or "")
    for sid in ("greenhouse", "usajobs", "himalayas", "google", "unknown-source"):
        assert policy_block(sid, {}) is None


@pytest.mark.usefixtures("gates_off")
def test_gates_can_be_enabled_by_env():
    env = {ENV_TOS_RESTRICTED: "true", ENV_INDIA_SOURCES: "1"}
    assert policy_block("linkedin", env) is None
    assert policy_block("naukri", env) is None
    assert policy_block("linkedin", {ENV_TOS_RESTRICTED: "false"}) is not None


def test_policy_env_is_loaded_by_the_handler():
    assert ENV_TOS_RESTRICTED in API_SOURCE_ENV and ENV_INDIA_SOURCES in API_SOURCE_ENV


@pytest.mark.usefixtures("gates_off")
def test_fetch_search_skips_restricted_boards():
    seen_sites = []

    def fake_scrape(**kwargs):
        seen_sites.append(kwargs.get("site_name"))
        raise AssertionError("restricted boards must not be scraped")

    spec = SearchSpec(keywords=["engineer"], locations=["New York"], country="US",
                      sites=["linkedin", "indeed", "glassdoor"])
    res = asyncio.run(fetch_search(spec, scrape=fake_scrape, env={}, sleep=lambda s: None))
    assert isinstance(res, FetchResult)
    assert not seen_sites
    assert set(res.skipped) == {"linkedin", "indeed", "glassdoor"}
    assert res.counts == {}


@pytest.mark.usefixtures("gates_off")
def test_india_only_scrapers_skipped_by_default():
    spec = SearchSpec(keywords=["engineer"], locations=["Bangalore"], country="IN",
                      sites=[], sources=["instahyre", "cutshort"])
    res = asyncio.run(fetch_api_sources(spec, env={}))
    assert set(res.skipped) == {"instahyre", "cutshort"}
    assert all("India-only" in v for v in res.skipped.values())


def test_attribution_only_for_aggregators():
    a = attribution_for("remoteok", "https://remoteok.com/remote-jobs/1")
    assert a == {"name": "Remote OK", "url": "https://remoteok.com/remote-jobs/1",
                 "home_url": "https://remoteok.com"}
    assert attribution_for("himalayas", None)["url"] == "https://himalayas.app"
    assert attribution_for("jobicy", "https://jobicy.com/jobs/1")["name"] == "Jobicy"
    assert attribution_for("greenhouse", "https://boards.greenhouse.io/x/jobs/1") is None
    assert attribution_for("usajobs", "https://www.usajobs.gov/job/1") is None
