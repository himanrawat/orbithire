import pytest

from orbithire_worker.fetchers.common import keyword_hit, parse_salary_text
from orbithire_worker.fetchers.countries import (
    COUNTRIES,
    UnsupportedCountry,
    country_info,
    default_location,
    is_country_name,
    jobspy_country,
    split_sites,
)
from orbithire_worker.fetchers.models import SearchSpec


def test_every_country_maps_to_a_jobspy_country():
    from jobspy.model import Country

    for c in COUNTRIES.values():
        assert Country(c.jobspy), c.code  # raises ValueError if JobSpy doesn't know it


def test_glassdoor_flag_matches_jobspy_domains():
    from jobspy.glassdoor.constant import domains
    from jobspy.model import Country

    for c in COUNTRIES.values():
        assert c.glassdoor == (Country(c.jobspy) in domains), c.code


def test_focus_countries_supported():
    for code in ("IN", "GB", "US", "AU", "NZ", "SG", "DE", "FR", "NL", "IE"):
        assert code in COUNTRIES


@pytest.mark.parametrize(
    "code,expected",
    [("IN", "india"), ("GB", "uk"), ("uk", "uk"), ("US", "usa"), ("NZ", "new zealand"), ("SG", "singapore"), (None, "india")],
)
def test_jobspy_country(code, expected):
    assert jobspy_country(code) == expected


def test_unsupported_country():
    with pytest.raises(UnsupportedCountry):
        country_info("ZZ")


def test_split_sites_naukri_only_india_glassdoor_where_supported():
    assert split_sites(["linkedin", "naukri", "glassdoor"], "IN") == (["linkedin", "naukri", "glassdoor"], {})
    keep, skipped = split_sites(["linkedin", "naukri", "glassdoor", "indeed"], "SE")
    assert keep == ["linkedin", "indeed"]
    assert skipped == {"naukri": "not available for Sweden", "glassdoor": "not available for Sweden"}
    keep, skipped = split_sites(["zip_recruiter", "google"], "GB")
    assert keep == ["google"] and "zip_recruiter" in skipped


def test_default_location_and_country_names():
    assert default_location("GB") == "United Kingdom"
    assert is_country_name("UK", "GB") and is_country_name("india", "IN") and is_country_name(None, "US")
    assert not is_country_name("London", "GB")


def test_search_spec_jobspy_country():
    assert SearchSpec(keywords=["x"]).jobspy_country == "india"
    assert SearchSpec(keywords=["x"], country="AU").jobspy_country == "australia"
    assert SearchSpec(keywords=["x"], country="AU", country_indeed="usa").jobspy_country == "usa"


@pytest.mark.parametrize(
    "text,default,expected",
    [
        ("$120k - $150k", None, (120000, 150000, "USD")),
        ("£45,000 - £55,000 per annum", None, (45000, 55000, "GBP")),
        ("€5.000 - €6.000 per month", None, (60000, 72000, "EUR")),
        ("₹ 12 - 18 LPA", None, (1200000, 1800000, "INR")),
        ("10-15 lakhs", None, (1000000, 1500000, "INR")),
        ("$60–$120/hour", None, (124800, 249600, "USD")),
        ("A$140,000", None, (140000, 140000, "AUD")),
        ("S$6,000 - S$8,000 monthly", None, (72000, 96000, "SGD")),
        ("70000", "GBP", (70000, 70000, "GBP")),
        ("$1000 per task", None, (None, None, None)),
        ("Competitive", None, (None, None, None)),
        ("", None, (None, None, None)),
        (None, None, (None, None, None)),
    ],
)
def test_parse_salary_text(text, default, expected):
    assert parse_salary_text(text, default) == expected


def test_fix_mojibake():
    from orbithire_worker.fetchers.common import fix_mojibake

    assert fix_mojibake("Sothebyâ\u0080\u0099s") == "Sotheby’s"
    assert fix_mojibake("Zürich café") == "Zürich café"
    assert fix_mojibake(None) is None


def test_keyword_hit():
    assert keyword_hit("Senior Frontend Software Engineer", ["frontend engineer"])
    assert not keyword_hit("Frontend Designer", ["frontend engineer"])
    assert keyword_hit("Java Developer", ["python", "java"])
    assert not keyword_hit("JavaScript Developer", ["java"])
    assert keyword_hit("anything", [])
