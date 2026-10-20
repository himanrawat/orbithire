"""Title keyword include/exclude filtering shared by JobSpy and ATS sources."""

from __future__ import annotations

import re
from collections.abc import Iterable
from functools import lru_cache


@lru_cache(maxsize=1024)
def _pattern(keyword: str) -> re.Pattern[str] | None:
    kw = keyword.strip()
    if not kw:
        return None
    # word boundaries only where the keyword edge is alphanumeric, so
    # "Java " does not match "JavaScript" while ".NET" / "C++" still work.
    left = r"(?<![\w])" if kw[0].isalnum() else ""
    right = r"(?![\w])" if kw[-1].isalnum() else ""
    # spaces and hyphens are interchangeable: "Front End" == "Front-End"
    body = re.sub(r"(?:\\ |\\-)+", lambda _m: r"[\s\-]+", re.escape(kw))
    return re.compile(left + body + right, re.IGNORECASE)


def matches_any(text: str, keywords: Iterable[str]) -> bool:
    return any((p := _pattern(k)) is not None and p.search(text) for k in keywords)


def title_matches(
    title: str,
    include: Iterable[str] | None = None,
    exclude: Iterable[str] | None = None,
) -> bool:
    """True when >=1 include keyword matches (or include is empty) and no exclude does."""
    include = [k for k in (include or []) if k.strip()]
    exclude = [k for k in (exclude or []) if k.strip()]
    if include and not matches_any(title, include):
        return False
    return not (exclude and matches_any(title, exclude))
