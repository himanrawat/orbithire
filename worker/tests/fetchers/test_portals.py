import pytest

from orbithire_worker.fetchers.portals import detect_ats, load_portals

from .conftest import FIXTURES


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://boards.greenhouse.io/acme", ("greenhouse", "acme", "us")),
        ("https://job-boards.greenhouse.io/vercel", ("greenhouse", "vercel", "us")),
        ("https://job-boards.eu.greenhouse.io/polyai", ("greenhouse", "polyai", "eu")),
        ("https://boards-api.greenhouse.io/v1/boards/airtable/jobs", ("greenhouse", "airtable", "us")),
        ("https://boards.greenhouse.io/embed/job_board?for=acme&b=1", ("greenhouse", "acme", "us")),
        ("https://jobs.lever.co/qonto", ("lever", "qonto", "us")),
        ("https://jobs.lever.co/qonto/abc-123", ("lever", "qonto", "us")),
        ("https://jobs.eu.lever.co/acme", ("lever", "acme", "eu")),
        ("https://api.lever.co/v0/postings/acme?mode=json", ("lever", "acme", "us")),
        ("https://jobs.ashbyhq.com/lovable", ("ashby", "lovable", "us")),
        ("https://api.ashbyhq.com/posting-api/job-board/n8n", ("ashby", "n8n", "us")),
        ("https://retool.com/careers", (None, None, "us")),
        ("https://apply.workable.com/huggingface/", ("workable", "huggingface", "us")),
        ("https://apply.workable.com/api/v1/widget/accounts/skroutz?details=true", ("workable", "skroutz", "us")),
        ("https://apply.workable.com/j/B4A0F1A2AB", (None, None, "us")),
        ("https://acme.workable.com/", ("workable", "acme", "us")),
        ("https://jobs.smartrecruiters.com/Ubisoft2", ("smartrecruiters", "Ubisoft2", "us")),
        ("https://careers.smartrecruiters.com/BoschGroup/", ("smartrecruiters", "BoschGroup", "us")),
        ("https://api.smartrecruiters.com/v1/companies/Visa/postings", ("smartrecruiters", "Visa", "us")),
        ("https://bunq.recruitee.com/", ("recruitee", "bunq", "us")),
        ("https://bunq.recruitee.com/api/offers/", ("recruitee", "bunq", "us")),
        ("https://personio.jobs.personio.de/", ("personio", "personio", "eu")),
        ("https://acme.jobs.personio.com/job/123", ("personio", "acme", "us")),
        ("https://polestar.teamtailor.com/jobs", ("teamtailor", "polestar", "eu")),
        ("https://acme.na.teamtailor.com/jobs.rss", ("teamtailor", "acme", "us")),
        ("www.teamtailor.com", (None, None, "us")),
        (None, (None, None, "us")),
    ],
)
def test_detect_ats(url, expected):
    assert detect_ats(url) == expected


def test_load_portals_fixture():
    cfg = load_portals(FIXTURES / "portals_trimmed.yml")
    by_name = {c.company: c for c in cfg.companies}
    assert len(cfg.companies) == 8

    assert by_name["Vercel"].ats == "greenhouse" and by_name["Vercel"].board_token == "vercel"
    assert by_name["Lovable"].ats == "ashby" and by_name["Lovable"].board_token == "lovable"
    assert by_name["Loom (Atlassian)"].ats == "lever" and by_name["Loom (Atlassian)"].board_token == "loom"
    assert by_name["Retool"].ats is None and by_name["Retool"].careers_url == "https://retool.com/careers"
    hf = by_name["Hugging Face"]
    assert (hf.ats, hf.board_token, hf.enabled) == ("workable", "huggingface", False)
    polyai = by_name["PolyAI"]
    assert (polyai.ats, polyai.board_token, polyai.region, polyai.enabled) == ("greenhouse", "polyai", "eu", False)

    # whitespace is stripped ("Java " -> "Java"); word-boundary matching keeps the intent
    assert "Frontend" in cfg.positive and "Java" in cfg.negative
    assert cfg.seniority_boost == ["Senior", "Staff"]


def test_load_portals_enabled_only():
    cfg = load_portals(FIXTURES / "portals_trimmed.yml", include_disabled=False)
    assert {c.company for c in cfg.companies} == {"Vercel", "Retool", "Lovable", "Loom (Atlassian)", "Airtable"}


def test_default_search():
    cfg = load_portals(FIXTURES / "portals_trimmed.yml")
    spec = cfg.default_search(locations=["Bangalore", "Remote"])
    assert spec.keywords == ["Frontend", "Front-End", "React"]
    assert spec.locations == ["Bangalore", "Remote"]
    assert spec.title_include == cfg.positive and spec.title_exclude == cfg.negative
    assert spec.hours_old == 24
