"""Pure data models shared by all job sources (no DB access)."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

AtsName = Literal["greenhouse", "lever", "ashby"]

# --------------------------------------------------------------------------- #
# Normalisation helpers used by dedupe_key()
# --------------------------------------------------------------------------- #

# Trailing legal / boilerplate tokens removed from company names (repeatedly).
_COMPANY_SUFFIXES = {
    "pvt", "private", "ltd", "limited", "inc", "incorporated", "llc", "llp",
    "plc", "gmbh", "ag", "corp", "corporation", "co", "company", "sa", "sas",
    "bv", "nv", "srl", "oy", "ab", "as", "aps", "kg", "pte", "pty", "sarl",
    "india", "the",
}

# City aliases -> canonical spelling (keys/values already normalised).
_LOCATION_ALIASES = {
    "bengaluru": "bangalore",
    "bangalore urban": "bangalore",
    "gurugram": "gurgaon",
    "bombay": "mumbai",
    "madras": "chennai",
    "calcutta": "kolkata",
    "new delhi": "delhi",
    "delhi ncr": "delhi",
    "ncr": "delhi",
    "poona": "pune",
    "thiruvananthapuram": "trivandrum",
    "kochi": "cochin",
    "mysuru": "mysore",
    "mangaluru": "mangalore",
    "vadodara": "baroda",
    "hubballi": "hubli",
    "belagavi": "belgaum",
}

_TITLE_REPLACEMENTS = [
    (r"\bsr\b", "senior"),
    (r"\bjr\b", "junior"),
    (r"\bfront end\b", "frontend"),
    (r"\bback end\b", "backend"),
    (r"\bfull stack\b", "fullstack"),
    (r"\bengg\b", "engineer"),
]

_REMOTE_WORDS = ("remote", "work from home", "wfh", "anywhere")


def _basic(text: str | None) -> str:
    """lowercase, strip accents, '&' -> 'and', punctuation -> space, collapse ws."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^\w\s]", " ", text)
    text = text.replace("_", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_company(name: str | None) -> str:
    # drop parenthesised parts: "Loom (Atlassian)" -> "Loom"
    name = re.sub(r"\([^)]*\)", " ", name or "")
    tokens = _basic(name).split()
    while len(tokens) > 1 and tokens[-1] in _COMPANY_SUFFIXES:
        tokens.pop()
    if len(tokens) > 1 and tokens[0] == "the":
        tokens.pop(0)
    return " ".join(tokens)


def normalize_title(title: str | None) -> str:
    text = _basic(title)
    for pattern, repl in _TITLE_REPLACEMENTS:
        text = re.sub(pattern, repl, text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_location(location: str | None, is_remote: bool = False) -> str:
    """Canonical city (first component) or 'remote'."""
    raw = (location or "").lower()
    if any(w in raw for w in _REMOTE_WORDS) or (is_remote and not raw.strip()):
        return "remote"
    # "Hybrid - London", "On-site: Pune", "Office - Berlin" -> the city part
    raw = re.sub(r"^\s*(hybrid|on[\s-]?site|in[\s-]office|office)\b\s*[-–:(]?\s*", "", raw)
    first = re.split(r"[,/|;()]| [-–] ", raw, maxsplit=1)[0]
    city = _basic(first)
    # LinkedIn variants: "Greater Bengaluru Area", "Bangalore Rural", "Mumbai Metropolitan Region"
    city = re.sub(r"^greater ", "", city)
    city = re.sub(r" (area|urban|rural|metropolitan region|metro|city|district)$", "", city)
    return _LOCATION_ALIASES.get(city, city)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #


class NormalizedPosting(BaseModel):
    """Mirrors the `job_postings` columns written by the fetch_jobs handler."""

    source: str  # linkedin | naukri | indeed | greenhouse | lever | ashby | ...
    external_id: str | None = None
    url: str
    title: str
    company: str
    location: str | None = None
    is_remote: bool = False
    salary_min: float | None = None  # annualised
    salary_max: float | None = None  # annualised
    currency: str | None = None
    description: str | None = None  # plain text / markdown
    posted_at: datetime | None = None
    raw: dict[str, Any] = Field(default_factory=dict)

    def dedupe_key(self) -> str:
        parts = (
            normalize_company(self.company),
            normalize_title(self.title),
            normalize_location(self.location, self.is_remote),
        )
        return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()


class SearchSpec(BaseModel):
    """Mirrors `job_searches` (plus optional title filters)."""

    name: str | None = None
    keywords: list[str]
    locations: list[str] = Field(default_factory=lambda: ["India"])
    sites: list[str] = Field(default_factory=lambda: ["linkedin", "naukri", "indeed"])
    remote_ok: bool = True
    hours_old: int = 24
    results_wanted: int = 20
    country_indeed: str = "india"
    title_include: list[str] = Field(default_factory=list)
    title_exclude: list[str] = Field(default_factory=list)


class WatchedCompany(BaseModel):
    """Mirrors `watched_companies`."""

    company: str
    ats: AtsName | None = None
    board_token: str | None = None
    careers_url: str | None = None
    enabled: bool = True
    # Greenhouse / Lever have separate EU hosts (job-boards.eu.greenhouse.io).
    region: Literal["us", "eu"] = "us"


class FetchResult(BaseModel):
    postings: list[NormalizedPosting] = Field(default_factory=list)
    errors: dict[str, str] = Field(default_factory=dict)  # source -> message
    counts: dict[str, int] = Field(default_factory=dict)  # source -> raw rows fetched
    filtered_out: int = 0  # dropped by title / remote filters
    duplicates: int = 0  # dropped by in-batch dedupe
