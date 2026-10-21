"""Shared plumbing for the Tier 3 job-board scrapers (Wellfound, Instahyre, Cutshort, Seek).

These boards have no public API. The scrapers are personal-scale and opt-in:

* never pre-selected (lib/jobs/types.ts `defaultSourcesFor` leaves them out);
* global kill switch `JOB_SCRAPERS_ENABLED` (default true) and a per-source
  `SCRAPER_DISABLE=seek,wellfound` list (both checked in `fetch_api_sources`);
* robots.txt is fetched once per run and every exact path (+query) we request is
  checked against it (Google semantics: `*` / `$` wildcards, longest match wins,
  Allow wins ties). A disallowed path is skipped, never requested;
* logged-out public pages / the JSON the site itself serves only: no login, no
  cookies kept, no captcha or bot-protection bypass, an honest User-Agent;
* tiny volume: <= MAX_SCRAPER_QUERIES queries per source per run, <= MAX_SCRAPER_RESULTS
  results each, a random 2-5 s pause before every request after the first, no retries;
* HTTP 403 / 429 or a bot challenge (Cloudflare "Just a moment...") stops the source
  for the rest of the run and is reported.
"""

from __future__ import annotations

import asyncio
import json
import random
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx

from ..models import NormalizedPosting
from .base import SourceOutput

SCRAPER_UA = "OrbitHire/0.1 (personal job-search assistant; low volume; respects robots.txt)"
ROBOTS_TOKEN = "orbithire"  # product token matched against robots.txt User-agent lines

MAX_SCRAPER_QUERIES = 2
MAX_SCRAPER_RESULTS = 30
DELAY_RANGE = (2.0, 5.0)
SCRAPER_TIMEOUT = 120.0  # SourceDef.timeout: 3 requests + pauses, well under the 5 min fetch budget

ENV_ENABLED = "JOB_SCRAPERS_ENABLED"
ENV_DISABLE = "SCRAPER_DISABLE"
SCRAPER_ENV: tuple[str, ...] = (ENV_ENABLED, ENV_DISABLE)

_sleep = asyncio.sleep  # patched in tests
_FALSY = {"0", "false", "no", "off", "disabled"}


def scraper_disabled(source_id: str, env: Mapping[str, str]) -> str | None:
    """Why a scraper must not run (kill switch / per-source disable), else None."""
    if (env.get(ENV_ENABLED) or "true").strip().lower() in _FALSY:
        return f"scrapers disabled ({ENV_ENABLED}=false)"
    disabled = {s.strip().lower() for s in (env.get(ENV_DISABLE) or "").split(",") if s.strip()}
    if source_id in disabled or "all" in disabled:
        return f"disabled by {ENV_DISABLE}"
    return None


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #


class ScraperHalt(Exception):
    """Stop this source for the rest of the run (no further requests)."""


class ScraperStopped(ScraperHalt):
    """The site answered 403 / 429 (or robots.txt itself was forbidden)."""


class ScraperBlocked(ScraperHalt):
    """Bot protection (JS / captcha challenge) - needs a browser, which we don't use."""


class RobotsDisallowed(Exception):
    """robots.txt disallows the exact path we wanted; it was not requested."""


class ScraperError(Exception):
    """Per-query failure (404, unexpected payload); other queries still run."""


# --------------------------------------------------------------------------- #
# robots.txt
# --------------------------------------------------------------------------- #


def _rule_regex(pattern: str) -> re.Pattern[str]:
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    rx = "".join(".*" if ch == "*" else re.escape(ch) for ch in body)
    return re.compile(rx + ("$" if anchored else ""))


@dataclass
class RobotsRules:
    rules: list[tuple[bool, str]] = field(default_factory=list)  # (allow, pattern)
    allow_all: bool = False
    disallow_all: bool = False

    @classmethod
    def parse(cls, text: str, token: str = ROBOTS_TOKEN) -> RobotsRules:
        """Rules of the group(s) for `token`, else the `*` group(s)."""
        groups: list[tuple[list[str], list[tuple[bool, str]]]] = []
        agents: list[str] = []
        rules: list[tuple[bool, str]] = []
        in_rules = False
        for line in text.splitlines():
            line = line.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (s.strip() for s in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if in_rules:
                    groups.append((agents, rules))
                    agents, rules, in_rules = [], [], False
                agents.append(value.lower())
            elif key in ("allow", "disallow"):
                in_rules = True
                if agents and value:  # empty Disallow = allow everything
                    rules.append((key == "allow", value))
        if agents:
            groups.append((agents, rules))
        mine = [r for a, r in groups if token in a]
        chosen = mine or [r for a, r in groups if "*" in a]
        return cls(rules=[rule for r in chosen for rule in r])

    def allowed(self, path: str) -> bool:
        """`path` is the URL path plus `?query` (what robots rules match against)."""
        if self.disallow_all:
            return False
        if self.allow_all:
            return True
        best: tuple[int, bool] | None = None
        for allow, pattern in self.rules:
            if _rule_regex(pattern).match(path):
                cand = (len(pattern), allow)
                if best is None or cand[0] > best[0] or (cand[0] == best[0] and allow):
                    best = cand
        return True if best is None else best[1]


# --------------------------------------------------------------------------- #
# HTTP session (one per source per run)
# --------------------------------------------------------------------------- #

_CHALLENGE_MARKERS = (
    "<title>just a moment...</title>",
    "challenge-platform",
    "cf-chl-",
    "confirm you are human",
    "captcha-delivery.com",  # DataDome
    "px-captcha",  # PerimeterX
)


def is_challenge(body: str) -> bool:
    low = body[:20000].lower()
    return any(m in low for m in _CHALLENGE_MARKERS)


class ScraperSession:
    """Polite GETs against one host: robots.txt check, pauses, stop on 403/429."""

    def __init__(self, client: httpx.AsyncClient, base: str, *, label: str) -> None:
        self.client = client
        self.base = base.rstrip("/")
        self.label = label
        self.requests = 0
        self._robots: RobotsRules | None = None

    async def _pause(self) -> None:
        if self.requests:
            await _sleep(random.uniform(*DELAY_RANGE))
        self.requests += 1

    async def _send(self, url: str, accept: str) -> httpx.Response:
        await self._pause()
        try:
            return await self.client.get(url, headers={"User-Agent": SCRAPER_UA, "Accept": accept})
        except httpx.TransportError as e:
            raise ScraperError(f"{type(e).__name__} fetching {urlsplit(url).path}") from e

    async def robots(self) -> RobotsRules:
        if self._robots is None:
            resp = await self._send(f"{self.base}/robots.txt", "text/plain")
            code = resp.status_code
            if code in (401, 403):
                raise ScraperStopped(f"stopped: robots.txt answered HTTP {code} ({self.label} blocks this client)")
            if code == 429:
                raise ScraperStopped(f"stopped: HTTP 429 (rate limited) by {self.label}")
            if code >= 500:
                # Unknown rules: be conservative (Google treats 5xx as disallow-all).
                self._robots = RobotsRules(disallow_all=True)
            elif code >= 400:
                self._robots = RobotsRules(allow_all=True)  # no robots.txt
            else:
                self._robots = RobotsRules.parse(resp.text)
        return self._robots

    async def get(self, path: str, params: Mapping[str, Any] | None = None, *, expect: str = "text") -> Any:
        """GET base+path(?params). Raises RobotsDisallowed (nothing requested),
        ScraperStopped / ScraperBlocked (halt the source) or ScraperError."""
        query = urlencode(params or {}, doseq=True)
        target = path + (f"?{query}" if query else "")
        rules = await self.robots()
        if not rules.allowed(target):
            raise RobotsDisallowed(f"disallowed by robots.txt: {path}")
        resp = await self._send(self.base + target, "application/json" if expect == "json" else "text/html")
        code = resp.status_code
        body = resp.text
        if code in (403, 503) and is_challenge(body):
            raise ScraperBlocked(f"blocked: requires browser ({self.label} served a bot challenge, HTTP {code})")
        if code in (401, 403, 429):
            what = "rate limited" if code == 429 else "forbidden"
            raise ScraperStopped(f"stopped: HTTP {code} ({what}) from {self.label}; no further requests this run")
        if code == 404:
            raise ScraperError(f"not found (404): {path}")
        if code >= 400:
            raise ScraperError(f"HTTP {code}: {path}")
        if is_challenge(body):
            raise ScraperBlocked(f"blocked: requires browser ({self.label} served a bot challenge)")
        if expect == "json":
            try:
                return resp.json()
            except ValueError as e:
                raise ScraperError(f"invalid JSON from {path}") from e
        return body


# --------------------------------------------------------------------------- #
# Query loop + parsing helpers
# --------------------------------------------------------------------------- #

QueryFn = Callable[[ScraperSession, Any], Awaitable[tuple[list[NormalizedPosting], int]]]


async def run_scraper(session: ScraperSession, queries: list[Any], one: QueryFn, describe: Callable[[Any], str] = str) -> SourceOutput:
    """Run <= MAX_SCRAPER_QUERIES queries sequentially. A robots-disallowed query is
    skipped (out.skipped when all were); a halt (403/429/challenge) stops the source:
    raised when nothing was fetched yet, else reported in out.errors."""
    out = SourceOutput()
    disallowed: list[str] = []
    ok = 0
    last: Exception | None = None
    for item in queries[:MAX_SCRAPER_QUERIES]:
        try:
            postings, raw = await one(session, item)
        except RobotsDisallowed as e:
            disallowed.append(str(e))
            continue
        except ScraperHalt as e:
            if ok == 0:
                raise
            out.errors.append(str(e))
            break
        except Exception as e:  # noqa: BLE001 - isolate queries
            last = e
            out.errors.append(f"{describe(item)}: {e}")
            continue
        ok += 1
        out.postings.extend(postings)
        out.raw_count += raw
    if ok == 0 and last is not None:
        raise last
    if ok == 0 and disallowed:
        out.skipped = "; ".join(dict.fromkeys(disallowed))
        out.errors = []
    elif disallowed:
        out.errors.extend(disallowed)
    seen: set[str] = set()
    uniq = []
    for p in out.postings:
        if p.url not in seen:
            seen.add(p.url)
            uniq.append(p)
    out.postings = uniq
    return out


_NEXT_DATA = re.compile(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.DOTALL)


def next_data(html: str) -> dict[str, Any] | None:
    """The Next.js page props JSON embedded in server-rendered pages."""
    m = _NEXT_DATA.search(html or "")
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")


_SENIORITY = {"senior", "sr", "junior", "jr", "lead", "staff", "principal", "mid", "level", "i", "ii", "iii"}


def strip_seniority(words: list[str]) -> list[str]:
    kept = [w for w in words if w not in _SENIORITY]
    return kept or words

