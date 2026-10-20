"""Per-search country (job_searches.country, ISO 3166-1 alpha-2) -> source settings.

Keep in sync with `COUNTRIES` in lib/jobs/types.ts.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CountryInfo:
    code: str  # ISO-2
    name: str  # display name, also the default location
    jobspy: str  # JobSpy `country_indeed` value (jobspy.model.Country)
    currency: str
    glassdoor: bool = True  # JobSpy's Glassdoor scraper has a domain for it
    adzuna: str | None = None  # Adzuna country endpoint
    jobicy_geo: str | None = None  # Jobicy `geo` filter
    region: str = "europe"  # india | uk | europe | north_america | apac


COUNTRIES: dict[str, CountryInfo] = {
    c.code: c
    for c in [
        CountryInfo("IN", "India", "india", "INR", adzuna="in", jobicy_geo="apac", region="india"),
        CountryInfo("GB", "United Kingdom", "uk", "GBP", adzuna="gb", jobicy_geo="uk", region="uk"),
        CountryInfo("IE", "Ireland", "ireland", "EUR", jobicy_geo="ireland"),
        CountryInfo("DE", "Germany", "germany", "EUR", adzuna="de", jobicy_geo="germany"),
        CountryInfo("FR", "France", "france", "EUR", adzuna="fr", jobicy_geo="france"),
        CountryInfo("NL", "Netherlands", "netherlands", "EUR", adzuna="nl", jobicy_geo="netherlands"),
        CountryInfo("BE", "Belgium", "belgium", "EUR", adzuna="be", jobicy_geo="belgium"),
        CountryInfo("AT", "Austria", "austria", "EUR", adzuna="at", jobicy_geo="austria"),
        CountryInfo("CH", "Switzerland", "switzerland", "CHF", adzuna="ch", jobicy_geo="switzerland"),
        CountryInfo("ES", "Spain", "spain", "EUR", adzuna="es", jobicy_geo="spain"),
        CountryInfo("IT", "Italy", "italy", "EUR", adzuna="it", jobicy_geo="italy"),
        CountryInfo("PT", "Portugal", "portugal", "EUR", glassdoor=False, jobicy_geo="portugal"),
        CountryInfo("PL", "Poland", "poland", "PLN", glassdoor=False, adzuna="pl", jobicy_geo="poland"),
        CountryInfo("CZ", "Czechia", "czech republic", "CZK", glassdoor=False, jobicy_geo="czechia"),
        CountryInfo("SE", "Sweden", "sweden", "SEK", glassdoor=False, jobicy_geo="sweden"),
        CountryInfo("DK", "Denmark", "denmark", "DKK", glassdoor=False, jobicy_geo="denmark"),
        CountryInfo("NO", "Norway", "norway", "NOK", glassdoor=False, jobicy_geo="norway"),
        CountryInfo("FI", "Finland", "finland", "EUR", glassdoor=False, jobicy_geo="finland"),
        CountryInfo("US", "United States", "usa", "USD", adzuna="us", jobicy_geo="usa", region="north_america"),
        CountryInfo("CA", "Canada", "canada", "CAD", adzuna="ca", jobicy_geo="canada", region="north_america"),
        CountryInfo("AU", "Australia", "australia", "AUD", adzuna="au", jobicy_geo="australia", region="apac"),
        CountryInfo("NZ", "New Zealand", "new zealand", "NZD", adzuna="nz", jobicy_geo="new-zealand", region="apac"),
        CountryInfo("SG", "Singapore", "singapore", "SGD", adzuna="sg", jobicy_geo="singapore", region="apac"),
    ]
}

DEFAULT_COUNTRY = "IN"

# JobSpy boards limited to some countries (others: linkedin, indeed, google work everywhere).
_SITE_COUNTRIES: dict[str, set[str]] = {
    "naukri": {"IN"},
    "zip_recruiter": {"US", "CA"},
    "glassdoor": {c.code for c in COUNTRIES.values() if c.glassdoor},
}


class UnsupportedCountry(ValueError):
    pass


def country_info(code: str | None) -> CountryInfo:
    """Raises UnsupportedCountry for codes outside COUNTRIES."""
    key = (code or DEFAULT_COUNTRY).strip().upper()
    if key == "UK":
        key = "GB"
    try:
        return COUNTRIES[key]
    except KeyError:
        raise UnsupportedCountry(f"unsupported country {code!r}") from None


def jobspy_country(code: str | None) -> str:
    return country_info(code).jobspy


def default_location(code: str | None) -> str:
    return country_info(code).name


def site_available(site: str, code: str | None) -> bool:
    allowed = _SITE_COUNTRIES.get(site)
    return allowed is None or country_info(code).code in allowed


def split_sites(sites: list[str], code: str | None) -> tuple[list[str], dict[str, str]]:
    """(sites to query, {site: reason}) for JobSpy boards in this country."""
    info = country_info(code)
    keep, skipped = [], {}
    for s in sites:
        if site_available(s, info.code):
            keep.append(s)
        else:
            skipped[s] = f"not available for {info.name}"
    return keep, skipped


def is_country_name(location: str | None, code: str | None) -> bool:
    """True when `location` is just the country itself ('India', 'UK', 'USA')."""
    if not location:
        return True
    loc = location.strip().lower()
    info = country_info(code)
    aliases = {info.name.lower(), info.jobspy.lower(), info.code.lower()}
    aliases |= {
        "GB": {"uk", "great britain", "england"},
        "US": {"usa", "us", "united states of america", "america"},
        "NL": {"holland", "the netherlands"},
        "CZ": {"czech republic"},
        "DE": {"deutschland"},
    }.get(info.code, set())
    return loc in aliases
