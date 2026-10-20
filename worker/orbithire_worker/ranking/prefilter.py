"""Free pre-filter: title rules, remote/location rules and deal-breakers.

Pure functions (no DB, no network). ``evaluate`` returns the list of deal-breakers for a
posting; an empty list means ``prefilter_pass = true``. Each deal-breaker is a dict
``{"code": ..., "reason": "<human readable>"}`` stored verbatim in ``job_matches.deal_breakers``
so the Job Inbox can show why a job was hidden.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable

from ..fetchers.filters import matches_any

# ---------------------------------------------------------------- salary

# Multipliers to a yearly amount (JobSpy / ATS interval names)
INTERVAL_TO_YEARLY: dict[str, float] = {
    "yearly": 1,
    "year": 1,
    "annual": 1,
    "annually": 1,
    "monthly": 12,
    "month": 12,
    "weekly": 52,
    "week": 52,
    "daily": 260,
    "day": 260,
    "hourly": 2080,
    "hour": 2080,
}

CURRENCY_ALIASES = {"₹": "INR", "RS": "INR", "RS.": "INR", "INR": "INR", "$": "USD", "€": "EUR", "£": "GBP"}


def normalize_currency(cur: str | None) -> str | None:
    if not cur:
        return None
    c = cur.strip().upper()
    return CURRENCY_ALIASES.get(c, c) or None


def yearly_amount(amount: float | None, interval: str | None, currency: str | None) -> float | None:
    """Convert a reported salary to a yearly figure.

    With no interval we infer it for INR only (Indian portals often omit it):
    < 500 is read as lakhs per annum (e.g. ``12`` -> 12 LPA), < 3,00,000 as monthly,
    anything larger as yearly. Other currencies without an interval are taken as yearly.
    """
    if amount is None:
        return None
    try:
        value = float(amount)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    iv = (interval or "").strip().lower()
    if iv in INTERVAL_TO_YEARLY:
        yearly = value * INTERVAL_TO_YEARLY[iv]
        if currency == "INR" and iv in ("yearly", "year", "annual", "annually") and value < 500:
            yearly = value * 100_000  # "12" yearly in INR = 12 LPA
        return yearly
    if currency == "INR":
        if value < 500:
            return value * 100_000
        if value < 300_000:
            return value * 12
    return value


def format_amount(value: float, currency: str) -> str:
    if currency == "INR":
        return f"₹{value / 100_000:.1f} LPA"
    return f"{currency} {value:,.0f}/yr"


# ---------------------------------------------------------------- languages

LANGUAGES = [
    "German", "French", "Spanish", "Italian", "Portuguese", "Dutch", "Polish", "Swedish",
    "Norwegian", "Danish", "Finnish", "Czech", "Hungarian", "Romanian", "Greek", "Turkish",
    "Russian", "Ukrainian", "Arabic", "Hebrew", "Japanese", "Korean", "Mandarin", "Chinese",
    "Cantonese", "Thai", "Vietnamese", "Indonesian", "Malay", "Tagalog", "English", "Hindi",
    "Bengali", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Gujarati", "Punjabi", "Urdu",
]
_LEVEL = (
    r"(?:fluent|fluency|native|mother[- ]tongue|proficien\w*|business[- ](?:level|fluent)|"
    r"professional (?:working )?proficiency|working knowledge|excellent|strong|"
    r"(?:written|verbal|spoken) (?:and (?:written|verbal|spoken) )?|[ABC][12]\b|C1\+?)"
)
_REQ = r"(?:required|mandatory|is a must|must[- ]have|essential|needed|necessary)"


def _language_patterns(lang: str) -> list[re.Pattern[str]]:
    L = re.escape(lang)
    return [
        # "fluent German", "fluency in German", "C1 German", "German (C1)"
        re.compile(rf"{_LEVEL}[^.\n]{{0,25}}\b{L}\b", re.I),
        re.compile(rf"\b{L}\b\s*(?:\(|-|:)?\s*(?:[ABC][12]\b|native|fluent)", re.I),
        # "German is required", "German language skills are mandatory"
        re.compile(rf"\b{L}\b(?:\s+language)?(?:\s+skills?)?\s+(?:is|are)?\s*{_REQ}", re.I),
        # "must speak German", "must be fluent in German"
        re.compile(rf"must (?:speak|be fluent in|have (?:fluent|native))[^.\n]{{0,15}}\b{L}\b", re.I),
    ]


_LANG_PATTERNS = {lang: _language_patterns(lang) for lang in LANGUAGES}


def required_languages(text: str) -> list[tuple[str, str]]:
    """Languages the text states as a job requirement -> [(language, matched snippet)]."""
    out: list[tuple[str, str]] = []
    for lang, patterns in _LANG_PATTERNS.items():
        for p in patterns:
            m = p.search(text)
            if m:
                out.append((lang, m.group(0).strip()))
                break
    return out


# ---------------------------------------------------------------- visa / remote restriction

_NO_SPONSOR = re.compile(
    r"(?:(?:unable|not able|cannot|can't|can ?not|won't|will not|do(?:es)? not|don't)\s+(?:to\s+)?"
    r"(?:offer|provide|support|sponsor)\w*\s+(?:any\s+)?(?:visa|work permit|sponsorship|immigration)"
    r"|no (?:visa )?sponsorship"
    r"|sponsorship (?:is )?not (?:available|offered|provided)"
    r"|must (?:already )?(?:have|hold|possess) (?:the )?(?:right|authori[sz]ation|permission) to work"
    r"|(?:without|no) (?:the )?need (?:for|of) (?:visa )?sponsorship"
    r"|(?:citizens?|permanent residents?) only"
    r"|must be a (?:\w+ )?citizen"
    r"|security clearance (?:is )?required)",
    re.I,
)
_SPONSOR_OK = re.compile(
    r"(?:visa sponsorship (?:is )?(?:available|offered|provided)|we (?:will |can |do )?sponsor|"
    r"relocation (?:support|assistance|package)|international applicants (?:are )?welcome)",
    re.I,
)
_REMOTE_RESTRICT = re.compile(
    r"(?:remote|work from home|wfh)?[^.\n]{0,40}?"
    r"(?:\b(?:only|must be)\b[^.\n]{0,20}?\b(?:based|located|residing|living)\b\s+in\b|"
    r"\b(?:based|located|residing)\s+in\b[^.\n]{0,25}?\bonly\b|"
    r"\((?:[A-Z]{2,3}|[A-Z][a-z]+(?: [A-Z][a-z]+)?) only\))",
    re.I,
)

COUNTRY_HINTS: dict[str, tuple[str, ...]] = {
    "India": ("india", "bengaluru", "bangalore", "mumbai", "delhi", "new delhi", "gurgaon", "gurugram",
              "noida", "hyderabad", "chennai", "pune", "kolkata", "ahmedabad", "jaipur", "kochi",
              "chandigarh", "indore", "ncr", "remote - in", ", in"),
}


def is_in_country(location: str | None, country: str) -> bool | None:
    """True/False when the location clearly is / isn't in ``country``; None when unknown."""
    if not location or not location.strip():
        return None
    loc = location.lower()
    hints = COUNTRY_HINTS.get(country, (country.lower(),))
    if any(h in loc for h in hints) or country.lower() in loc:
        return True
    generic = {"remote", "anywhere", "worldwide", "global", "multiple locations", "hybrid", "remote, remote"}
    if loc.strip(" ,") in generic:
        return None
    return False


# ---------------------------------------------------------------- evaluation


@dataclass(slots=True)
class Rules:
    min_salary: float = 1_200_000
    min_salary_currency: str = "INR"
    home_country: str = "India"
    known_languages: list[str] = field(default_factory=lambda: ["English", "Hindi"])
    needs_visa_sponsorship_abroad: bool = True
    excluded_locations: list[str] = field(default_factory=list)
    excluded_companies: list[str] = field(default_factory=list)
    title_include: list[str] = field(default_factory=list)
    title_exclude: list[str] = field(default_factory=list)
    remote_ok: bool = True

    @classmethod
    def from_rows(cls, settings: dict[str, Any] | None, search: dict[str, Any] | None,
                  extra_excludes: Iterable[str] = ()) -> "Rules":
        s = settings or {}
        js = search or {}
        r = cls()
        if s.get("min_salary") is not None:
            r.min_salary = float(s["min_salary"])
        r.min_salary_currency = normalize_currency(s.get("min_salary_currency")) or "INR"
        r.home_country = s.get("home_country") or "India"
        if s.get("known_languages") is not None:
            r.known_languages = list(s["known_languages"])
        if s.get("needs_visa_sponsorship_abroad") is not None:
            r.needs_visa_sponsorship_abroad = bool(s["needs_visa_sponsorship_abroad"])
        r.excluded_locations = list(s.get("excluded_locations") or [])
        r.excluded_companies = list(s.get("excluded_companies") or [])
        # job_searches: exclude_keywords (migration 017); include keywords if a later
        # migration adds them under one of these names.
        r.title_exclude = list(js.get("exclude_keywords") or []) + list(extra_excludes)
        for key in ("include_keywords", "title_include", "title_keywords"):
            if js.get(key):
                r.title_include = list(js[key])
                break
        if js.get("remote_ok") is not None:
            r.remote_ok = bool(js["remote_ok"])
        return r


def _db(code: str, reason: str, **extra: Any) -> dict[str, Any]:
    return {"code": code, "reason": reason, **extra}


def evaluate(posting: dict[str, Any], rules: Rules) -> list[dict[str, Any]]:
    """Return the deal-breakers for ``posting`` (empty list = passes the pre-filter)."""
    out: list[dict[str, Any]] = []
    title = posting.get("title") or ""
    company = posting.get("company") or ""
    location = posting.get("location") or ""
    description = posting.get("description") or ""
    is_remote = posting.get("is_remote")

    # Title include / exclude
    if rules.title_exclude and matches_any(title, rules.title_exclude):
        hit = next(k for k in rules.title_exclude if k.strip() and matches_any(title, [k]))
        out.append(_db("title_excluded", f'Title contains excluded keyword "{hit}"'))
    if rules.title_include and not matches_any(title, rules.title_include):
        out.append(_db("title_not_included", "Title matches none of your search keywords"))

    # Company / location exclusions
    if company and any(c.strip().lower() == company.strip().lower() for c in rules.excluded_companies if c.strip()):
        out.append(_db("company_excluded", f"{company} is on your excluded companies list"))
    loc_l = location.lower()
    for ex in rules.excluded_locations:
        if ex.strip() and ex.strip().lower() in loc_l:
            out.append(_db("location_excluded", f'Location "{location}" matches excluded location "{ex.strip()}"'))
            break

    # Remote rules
    if is_remote is True and not rules.remote_ok:
        out.append(_db("remote_not_wanted", "Remote role, but this search excludes remote jobs"))

    # Salary below minimum (only when disclosed in the same currency)
    cur = normalize_currency(posting.get("currency"))
    if cur and cur == rules.min_salary_currency and rules.min_salary > 0:
        top = posting.get("salary_max") if posting.get("salary_max") is not None else posting.get("salary_min")
        yearly = yearly_amount(top, posting.get("salary_interval"), cur)
        if yearly is not None and yearly < rules.min_salary:
            out.append(_db(
                "salary_below_min",
                f"Salary up to {format_amount(yearly, cur)} is below your minimum {format_amount(rules.min_salary, cur)}",
                yearly=round(yearly),
            ))

    # Mandatory languages the user doesn't speak
    known = {k.strip().lower() for k in rules.known_languages}
    text = f"{title}\n{description}"
    for lang, snippet in required_languages(text):
        if lang.lower() not in known and not (lang == "Chinese" and "mandarin" in known):
            out.append(_db("language_required", f'Requires {lang} ("{snippet[:80]}")', language=lang))

    # Abroad: visa / work authorisation, remote-restricted-to-another-country
    in_home = is_in_country(location, rules.home_country)
    if in_home is False:
        if is_remote is not True and rules.needs_visa_sponsorship_abroad:
            m = _NO_SPONSOR.search(description)
            if m and not _SPONSOR_OK.search(description):
                out.append(_db("no_visa_sponsorship",
                               f'Onsite role abroad without visa sponsorship ("{m.group(0)[:80]}")'))
        elif is_remote is True:
            m = _REMOTE_RESTRICT.search(f"{location}\n{description}")
            if m and rules.home_country.lower() not in m.group(0).lower():
                out.append(_db("remote_country_restricted",
                               f'Remote role restricted to another country ("{m.group(0).strip()[:80]}")'))
    return out
