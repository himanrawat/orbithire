"""Pre-filter rules (pure, no DB)."""

from __future__ import annotations

import pytest

from orbithire_worker.ranking.prefilter import Rules, evaluate, required_languages, yearly_amount


# Most cases below were written for a person based in India (the old defaults).
INDIA = {"min_salary": 1_200_000, "min_salary_currency": "INR", "home_country": "India",
         "known_languages": ["English", "Hindi"]}


def india(**kw) -> Rules:
    return Rules(**{**INDIA, **kw})


def codes(posting: dict, rules: Rules | None = None) -> list[str]:
    return [d["code"] for d in evaluate(posting, rules or india())]


def P(**kw):  # noqa: N802
    base = {"title": "Frontend Engineer", "company": "Acme", "location": "Gurugram, India",
            "is_remote": False, "description": "React, TypeScript."}
    base.update(kw)
    return base


@pytest.mark.parametrize(
    ("amount", "interval", "expected"),
    [
        (1_200_000, "yearly", 1_200_000),
        (100_000, "monthly", 1_200_000),
        (12, "yearly", 1_200_000),          # 12 LPA written as "12"
        (12, None, 1_200_000),
        (80_000, None, 960_000),            # INR without interval < 3L -> monthly
        (25_000, "weekly", 1_300_000),
        (600, "hourly", 1_248_000),
        (1_500_000, None, 1_500_000),
    ],
)
def test_yearly_amount_inr(amount, interval, expected):
    assert yearly_amount(amount, interval, "INR") == pytest.approx(expected)


@pytest.mark.parametrize(
    ("salary", "fails"),
    [
        ({"salary_min": 800_000, "salary_max": 1_000_000, "salary_interval": "yearly"}, True),
        ({"salary_min": 1_000_000, "salary_max": 1_400_000, "salary_interval": "yearly"}, False),  # max above floor
        ({"salary_min": 1_200_000, "salary_max": None, "salary_interval": "yearly"}, False),       # exactly 12 LPA
        ({"salary_min": 90_000, "salary_max": 95_000, "salary_interval": "monthly"}, True),        # 11.4 LPA
        ({"salary_min": 110_000, "salary_max": 120_000, "salary_interval": "monthly"}, False),     # 14.4 LPA
        ({"salary_min": 6, "salary_max": 8, "salary_interval": "yearly"}, True),                   # 8 LPA
        ({"salary_min": None, "salary_max": None, "salary_interval": None}, False),                # undisclosed
    ],
)
def test_salary_floor_inr(salary, fails):
    out = evaluate(P(currency="INR", **salary), india())
    assert ("salary_below_min" in [d["code"] for d in out]) is fails
    if fails:
        reason = next(d["reason"] for d in out if d["code"] == "salary_below_min")
        assert "below your minimum ₹12.0 LPA" in reason


def test_salary_other_currency_not_compared():
    assert codes(P(currency="USD", salary_min=40_000, salary_max=50_000, salary_interval="yearly")) == []


def test_custom_min_salary():
    rules = india(min_salary=2_000_000)
    assert "salary_below_min" in codes(P(currency="INR", salary_max=1_800_000, salary_interval="yearly"), rules)


@pytest.mark.parametrize(
    ("text", "langs"),
    [
        ("Fluent German is required for this role.", ["German"]),
        ("You must speak Japanese with customers.", ["Japanese"]),
        ("French (C1) mandatory", ["French"]),
        ("We are a German company with an English-speaking team.", []),
        ("Excellent English communication skills.", ["English"]),
    ],
)
def test_required_languages(text, langs):
    assert [lang for lang, _ in required_languages(text)] == langs


def test_language_deal_breaker_only_for_unknown_language():
    assert codes(P(description="Fluency in German required.")) == ["language_required"]
    assert codes(P(description="Excellent written and spoken English required.")) == []
    assert codes(P(description="Fluent German required."), india(known_languages=["English", "German"])) == []


def test_visa_abroad():
    no = P(location="Berlin, Germany", description="Unfortunately we are unable to sponsor visas.")
    assert codes(no) == ["no_visa_sponsorship"]
    ok = P(location="Berlin, Germany", description="Visa sponsorship available. We cannot sponsor spouses.")
    assert codes(ok) == []
    silent = P(location="Berlin, Germany", description="React role.")
    assert codes(silent) == []
    assert codes(no, india(needs_visa_sponsorship_abroad=False)) == []
    home = P(location="Bengaluru, Karnataka, India", description="No visa sponsorship.")
    assert codes(home) == []


def test_remote_restricted_to_other_country():
    p = P(location="United States", is_remote=True, description="Remote. Must be based in the US.")
    assert codes(p) == ["remote_country_restricted"]
    p2 = P(location="Remote", is_remote=True, description="Remote. Must be based in the US.")
    assert codes(p2) == []  # unknown location -> left to the LLM


def test_title_and_location_rules():
    rules = india(title_exclude=["Senior", "Lead"], excluded_locations=["Mumbai"], excluded_companies=["BadCo"])
    assert codes(P(title="Senior Frontend Engineer"), rules) == ["title_excluded"]
    assert codes(P(location="Mumbai, India"), rules) == ["location_excluded"]
    assert codes(P(company="badco"), rules) == ["company_excluded"]
    assert codes(P(), india(title_include=["UX Engineer"])) == ["title_not_included"]
    assert codes(P(is_remote=True), india(remote_ok=False)) == ["remote_not_wanted"]


def test_rules_from_rows_defaults():
    r = Rules.from_rows(None, {"exclude_keywords": ["Intern"], "remote_ok": True})
    assert r.min_salary == 0 and r.min_salary_currency == "USD" and r.home_country == "United States"
    assert r.title_exclude == ["Intern"]
    r2 = Rules.from_rows({"min_salary": 1500000, "known_languages": ["English"]}, None, extra_excludes=["Sales"])
    assert r2.min_salary == 1_500_000 and r2.title_exclude == ["Sales"]


def test_us_defaults():
    us = Rules()
    assert us.known_languages == ["English"]
    # No salary floor until the person sets one
    assert codes(P(location="Austin, TX", currency="USD", salary_max=40_000, salary_interval="yearly"), us) == []
    no_sponsor = "We are unable to sponsor visas."
    for home in ("Austin, TX", "New York, NY 10001", "Remote (US)", "San Francisco, CA, United States"):
        assert codes(P(location=home, description=no_sponsor), us) == [], home
    assert codes(P(location="Berlin, Germany", description=no_sponsor), us) == ["no_visa_sponsorship"]
    assert codes(P(location="Vancouver, Canada", description=no_sponsor), us) == ["no_visa_sponsorship"]
    assert codes(P(location="United States", is_remote=True, description="Remote. Must be based in the US."), us) == []
