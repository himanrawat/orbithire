"""Mapping helpers shared by ATS boards and job APIs (pure functions)."""

from __future__ import annotations

import html
import re
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from typing import Any

from .filters import _pattern

# --------------------------------------------------------------------------- #
# HTML -> text
# --------------------------------------------------------------------------- #

_BLOCK_TAGS = {
    "p", "div", "br", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "section", "article", "tr", "table", "blockquote", "pre", "hr",
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skip += 1
        elif tag == "li":
            self.parts.append("\n- ")
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK_TAGS and tag != "li":
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def html_to_text(content: str | None) -> str:
    """Convert (possibly entity-escaped, as Greenhouse returns) HTML to clean text."""
    if not content:
        return ""
    if "&lt;" in content and "<" not in content:
        content = html.unescape(content)
    parser = _TextExtractor()
    parser.feed(content)
    parser.close()
    text = "".join(parser.parts).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n- *\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


_MOJIBAKE = re.compile(r"[Â-ô][\u0080-¿]")


def fix_mojibake(text: str | None) -> str | None:
    """Undo UTF-8 text that was decoded as Latin-1 once ('Sothebyâ\\x80\\x99s' ->
    'Sotheby’s'), as Remote OK's API returns it. Leaves clean text untouched."""
    if not text or not _MOJIBAKE.search(text):
        return text
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


# --------------------------------------------------------------------------- #
# Numbers / dates
# --------------------------------------------------------------------------- #

_INTERVAL_FACTOR = {"year": 1, "annual": 1, "month": 12, "week": 52, "day": 260, "hour": 2080}


def annual_factor(interval: str | None) -> int:
    """'monthly' / 'per month' / 'MONTH' -> 12 etc. Unknown -> 1 (yearly)."""
    s = (interval or "year").lower()
    for key, factor in _INTERVAL_FACTOR.items():
        if key in s:
            return factor
    return 1


def num(v: Any) -> float | None:
    try:
        f = None if v is None or v == "" else float(v)
    except (TypeError, ValueError):
        return None
    return None if f is None or f != f else f  # NaN -> None


def scale(v: float | None, factor: int | float) -> float | None:
    return None if v is None else round(v * factor, 2)


def positive(v: float | None) -> float | None:
    """0 / negative salaries mean 'not given' in several APIs (RemoteOK)."""
    return v if v is not None and v > 0 else None


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00").replace(" UTC", "+00:00"))
    except ValueError:
        try:
            d = date.fromisoformat(str(value).strip()[:10])
        except ValueError:
            return None
        return datetime(d.year, d.month, d.day, tzinfo=UTC)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def from_epoch(value: Any) -> datetime | None:
    n = num(value)
    if n is None or n <= 0:
        return None
    if n > 1e12:  # milliseconds
        n /= 1000
    return datetime.fromtimestamp(n, UTC)


def is_remote_text(*texts: str | None) -> bool:
    return any(t and "remote" in t.lower() for t in texts)


# --------------------------------------------------------------------------- #
# Free-text salary ("$120k - $150k", "£45,000 - £55,000 per annum", "10-15 LPA")
# --------------------------------------------------------------------------- #

_CURRENCY_TOKENS: list[tuple[str, str]] = [
    (r"\bA\$|\bAU\$|\bAUD\b", "AUD"),
    (r"\bNZ\$|\bNZD\b", "NZD"),
    (r"\bS\$|\bSGD\b", "SGD"),
    (r"\bC\$|\bCA\$|\bCAD\b", "CAD"),
    (r"\bUS\$|\bUSD\b", "USD"),
    (r"£|\bGBP\b", "GBP"),
    (r"€|\bEUR\b", "EUR"),
    (r"₹|\bINR\b|\bRs\.?(?=\s*\d)|\blpa\b|\blakhs?\b|\bcrores?\b", "INR"),
    (r"\bCHF\b", "CHF"),
    (r"\bPLN\b|\bzł", "PLN"),
    (r"\$", "USD"),
]

_NUM_RE = re.compile(r"(\d+(?:[.,]\d+)*)\s*(k|m|lpa|lakhs?|lacs?|l|cr|crores?)?\b", re.IGNORECASE)


def _to_number(raw: str, suffix: str | None) -> float | None:
    s = raw
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", s):  # thousands separators (1,200,000 / 45.000)
        s = re.sub(r"[.,]", "", s)
    else:
        s = s.replace(",", ".")
    try:
        v = float(s)
    except ValueError:
        return None
    suf = (suffix or "").lower()
    if suf == "k":
        v *= 1_000
    elif suf == "m":
        v *= 1_000_000
    elif suf in ("lpa", "l", "lakh", "lakhs", "lac", "lacs"):
        v *= 100_000
    elif suf in ("cr", "crore", "crores"):
        v *= 10_000_000
    return v


def parse_salary_text(
    text: str | None, default_currency: str | None = None
) -> tuple[float | None, float | None, str | None]:
    """Best-effort (annual_min, annual_max, currency) from free text; (None, None, None)
    when nothing sensible is found (e.g. "$1000 per task", "Competitive")."""
    if not text:
        return None, None, None
    t = text.strip()
    low = t.lower()
    if any(w in low for w in ("per task", "per project", "per word", "equity only", "commission")):
        return None, None, None
    currency = None
    for pattern, code in _CURRENCY_TOKENS:
        if re.search(pattern, t, re.IGNORECASE if code == "INR" else 0):
            currency = code
            break
    found: list[tuple[float, float]] = []  # (bare value, multiplied value)
    for m in _NUM_RE.finditer(t):
        bare = _to_number(m.group(1), None)
        v = _to_number(m.group(1), m.group(2))
        if bare is not None and v is not None and v > 0:
            found.append((bare, v))
        if len(found) == 2:
            break
    if not found:
        return None, None, None
    # "10-15 LPA", "$120-150k": the unit on the second number applies to the first.
    if len(found) == 2 and found[0][0] == found[0][1] and found[1][1] != found[1][0]:
        mult = found[1][1] / found[1][0]
        found[0] = (found[0][0], found[0][0] * mult)
    values = [v for _, v in found]
    if re.search(r"\b(per\s+|an\s+|/\s*)?(hour|hr)\b|/h\b|hourly", low):
        factor = 2080
    elif re.search(r"\b(per\s+|a\s+|/\s*)?day\b|daily", low):
        factor = 260
    elif re.search(r"\b(per\s+|a\s+|/\s*)?week\b|weekly", low):
        factor = 52
    elif re.search(r"\b(per\s+|a\s+|/\s*)?(month|mo)\b|monthly|p\.?m\.?\b", low):
        factor = 12
    else:
        factor = 1
    lo, hi = min(values) * factor, max(values) * factor
    # Too small to be an annual salary (stray numbers like "2 days"): ignore.
    if hi < 1000:
        return None, None, None
    return round(lo, 2), round(hi, 2), currency or default_currency


# --------------------------------------------------------------------------- #
# Keyword relevance for feed-style sources (no server-side search)
# --------------------------------------------------------------------------- #


def keyword_hit(text: str, keywords: list[str]) -> bool:
    """True when every word of at least one keyword occurs in `text`
    ("frontend engineer" matches "Senior Frontend Software Engineer")."""
    if not keywords:
        return True
    for kw in keywords:
        words = [w for w in re.split(r"\s+", kw.strip()) if w]
        if words and all((p := _pattern(w)) is not None and p.search(text) for w in words):
            return True
    return False
