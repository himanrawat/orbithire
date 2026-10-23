"""Fetch-once fan-out planning (pure, no DB access).

A shared board is fetched once; its postings are then matched to every user
whose enabled job_search accepts them (title keywords + country/remote rules,
the same fetch-time filters the per-user path uses) or who watches the board
directly. Ranking (rank_jobs) then pre-filters and scores the new matches.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field

from .fetchers.countries import COUNTRIES
from .fetchers.filters import matches_any, title_matches
from .fetchers.models import normalize_location

# Board country is the employer's home market, but US employers also post abroad.
# A location that names another supported country (or one of its big tech hubs)
# overrides it.
_FOREIGN_HINTS: dict[str, tuple[str, ...]] = {
    c.code: tuple(sorted({c.name, c.jobspy})) for c in COUNTRIES.values() if c.code != "US"
}
_CITY_HINTS: dict[str, tuple[str, ...]] = {
    "GB": ("UK", "London", "Manchester", "Edinburgh", "England", "Scotland"),
    "CA": ("Toronto", "Vancouver", "Montreal", "Ottawa", "Ontario", "British Columbia", "Quebec"),
    "IN": ("Bangalore", "Bengaluru", "Hyderabad", "Pune", "Mumbai", "Delhi", "Gurgaon", "Gurugram",
           "Noida", "Chennai"),
    "DE": ("Berlin", "Munich", "Hamburg"),
    "FR": ("Paris",),
    "NL": ("Amsterdam",),
    "IE": ("Dublin",),
    "ES": ("Madrid", "Barcelona"),
    "PL": ("Warsaw", "Krakow"),
    "AU": ("Sydney", "Melbourne"),
    "SG": ("Singapore",),
}


@dataclass(frozen=True)
class FanoutPosting:
    posting_id: str
    title: str
    board_key: str  # "<ats>:<board_token>"
    location: str | None = None
    is_remote: bool = False
    country: str | None = None  # company_watchlist.country; None for user-only boards


@dataclass(frozen=True)
class SearchTarget:
    user_id: str
    search_id: str
    keywords: tuple[str, ...]
    include: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()
    country: str = "US"
    remote_ok: bool = True


@dataclass(frozen=True)
class WatcherTarget:
    """A user who watches a board directly (watched_companies) with the union of
    their searches' title filters."""

    user_id: str
    include: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()


@dataclass(frozen=True)
class PlannedMatch:
    user_id: str
    posting_id: str
    search_id: str | None


@dataclass
class FanoutPlan:
    matches: list[PlannedMatch] = field(default_factory=list)
    capped: dict[str, int] = field(default_factory=dict)  # user_id -> matches dropped by the cap

    @property
    def users(self) -> list[str]:
        return sorted({m.user_id for m in self.matches})


def _is_remote(p: FanoutPosting) -> bool:
    return normalize_location(p.location, p.is_remote) == "remote"


def location_country(p: FanoutPosting) -> str | None:
    """The posting's market: the board country unless the location names another country."""
    loc = p.location or ""
    if p.country is None or not loc:
        return p.country
    for code, names in _FOREIGN_HINTS.items():
        if matches_any(loc, names) or matches_any(loc, _CITY_HINTS.get(code, ())):
            return code
    return p.country


def search_accepts(search: SearchTarget, posting: FanoutPosting) -> bool:
    """Title must hit the search's include keywords (or, when it has none, one of
    its search keywords) and no exclude keyword; the posting must be in the
    search's country, or remote when the search allows remote jobs."""
    include = search.include or search.keywords
    if not include or not title_matches(posting.title, include, search.exclude):
        return False
    remote = _is_remote(posting)
    if remote and not search.remote_ok:
        return False
    country = location_country(posting)
    if country is None:
        return False
    # a remote job restricted to another country ("Remote (UK)") is not open to this market
    return country == search.country or (remote and country == posting.country)


def _candidates(
    posting: FanoutPosting,
    searches: Sequence[SearchTarget],
    watchers: Mapping[str, Sequence[WatcherTarget]],
) -> Iterable[PlannedMatch]:
    for s in searches:
        if search_accepts(s, posting):
            yield PlannedMatch(s.user_id, posting.posting_id, s.search_id)
    for w in watchers.get(posting.board_key, ()):
        if title_matches(posting.title, w.include, w.exclude):
            yield PlannedMatch(w.user_id, posting.posting_id, None)


def plan_fanout(
    postings: Sequence[FanoutPosting],
    searches: Sequence[SearchTarget],
    watchers: Mapping[str, Sequence[WatcherTarget]] | None = None,
    max_per_user: int = 100,
) -> FanoutPlan:
    """One match per (user, posting): a search match wins over a watcher match
    (it keeps search_id); at most `max_per_user` new matches per user per run."""
    plan = FanoutPlan()
    seen: set[tuple[str, str]] = set()
    per_user: dict[str, int] = {}
    for posting in postings:
        for m in _candidates(posting, searches, watchers or {}):
            key = (m.user_id, m.posting_id)
            if key in seen:
                continue
            seen.add(key)
            if per_user.get(m.user_id, 0) >= max_per_user:
                plan.capped[m.user_id] = plan.capped.get(m.user_id, 0) + 1
                continue
            per_user[m.user_id] = per_user.get(m.user_id, 0) + 1
            plan.matches.append(m)
    return plan
