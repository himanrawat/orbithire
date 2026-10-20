"""Shared async HTTP helpers for every API-based source (ATS boards, job APIs).

`request()` retries transport errors, 429 and 5xx with exponential backoff
(honouring a numeric Retry-After, capped), raises on other 4xx without retrying.
"""

from __future__ import annotations

import asyncio
import random
from typing import Any, Literal

import httpx

__all__ = [
    "DEFAULT_TIMEOUT",
    "MAX_ATTEMPTS",
    "SourceError",
    "USER_AGENT",
    "make_client",
    "request",
]

USER_AGENT = "OrbitHire/0.1 (job-board API client; low volume)"
DEFAULT_TIMEOUT = httpx.Timeout(20.0, connect=10.0)
MAX_ATTEMPTS = 3
MAX_RETRY_AFTER = 30.0

_sleep = asyncio.sleep  # patched in tests


class SourceError(Exception):
    """A source failed (bad status, invalid payload, retries exhausted)."""


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=DEFAULT_TIMEOUT,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        follow_redirects=True,
    )


def _redact(url: str) -> str:
    """Strip query strings (Adzuna puts app_key in it) from error messages."""
    return url.split("?", 1)[0]


async def request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    json: Any = None,
    headers: dict[str, str] | None = None,
    auth: httpx.Auth | tuple[str, str] | None = None,
    expect: Literal["json", "text"] = "json",
    error_cls: type[Exception] = SourceError,
    redact: str | None = None,
) -> Any:
    """Send a request with retries. Returns parsed JSON (or text).

    `redact`: a secret that must never appear in an error message (e.g. a key in
    the URL path, like Jooble's).
    """
    shown = _redact(url)
    if redact:
        shown = shown.replace(redact, "***")
    last = ""
    for attempt in range(MAX_ATTEMPTS):
        delay = 2**attempt + random.random()
        try:
            resp = await client.request(method, url, params=params, json=json, headers=headers, auth=auth)
        except httpx.TransportError as e:
            last = type(e).__name__
        else:
            code = resp.status_code
            if code == 404:
                raise error_cls(f"not found (404): {shown}")
            if code in (401, 403):
                raise error_cls(f"HTTP {code} (check the API key / access): {shown}")
            if code == 429 or code >= 500:
                last = f"HTTP {code}"
                ra = resp.headers.get("retry-after")
                if ra and ra.isdigit():
                    delay = min(float(ra), MAX_RETRY_AFTER)
            elif code >= 400:
                raise error_cls(f"HTTP {code}: {shown}")
            elif expect == "text":
                return resp.text
            else:
                try:
                    return resp.json()
                except ValueError as e:
                    raise error_cls(f"invalid JSON from {shown}") from e
        if attempt < MAX_ATTEMPTS - 1:
            await _sleep(delay)
    raise error_cls(f"giving up after {MAX_ATTEMPTS} attempts ({last}): {shown}")
