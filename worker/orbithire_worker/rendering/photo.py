"""Resolve a resume photo to a local file for templates with a photo slot.

Sources, in order: `basics.image` of the document (data: URL, http(s) URL,
R2 key or the `/api/profile/photo` proxy path), then `profiles.avatar_url`
(an R2 key or a URL).
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import logging
import re
from pathlib import Path
from typing import Callable

import httpx

log = logging.getLogger(__name__)

_DATA_URL = re.compile(r"^data:image/(png|jpe?g|gif|webp);base64,(.+)$", re.S | re.I)
_EXT_BY_MAGIC = [(b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpg"), (b"GIF8", "gif")]


def _ext(data: bytes) -> str | None:
    for magic, ext in _EXT_BY_MAGIC:
        if data.startswith(magic):
            return ext
    return None


def decode_data_url(src: str, max_bytes: int) -> bytes | None:
    m = _DATA_URL.match(src.strip())
    if not m:
        return None
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except (binascii.Error, ValueError):
        return None
    return raw if 0 < len(raw) <= max_bytes else None


def _download(url: str, max_bytes: int) -> bytes | None:
    try:
        with httpx.stream("GET", url, timeout=8, follow_redirects=True) as r:
            if r.status_code != 200:
                return None
            buf = bytearray()
            for chunk in r.iter_bytes():
                buf.extend(chunk)
                if len(buf) > max_bytes:
                    return None
            return bytes(buf)
    except httpx.HTTPError as exc:
        log.warning("photo download failed: %s", exc)
        return None


def fetch_photo_bytes(
    candidates: list[str | None],
    *,
    r2_get: Callable[[str], bytes | None] | None,
    max_bytes: int,
) -> bytes | None:
    for src in candidates:
        if not src or not isinstance(src, str):
            continue
        src = src.strip()
        data: bytes | None = None
        if src.startswith("data:"):
            data = decode_data_url(src, max_bytes)
        elif src.startswith(("http://", "https://")):
            data = _download(src, max_bytes)
        elif src.startswith("/api/"):
            continue  # app proxy path; fall through to the profile's avatar key
        elif r2_get is not None:
            try:
                data = r2_get(src)
            except Exception as exc:  # noqa: BLE001
                log.warning("photo fetch from R2 failed (%s): %s", src, exc)
                data = None
        if data and len(data) <= max_bytes and _ext(data):
            return data
    return None


def write_photo(data: bytes, directory: Path) -> Path:
    ext = _ext(data) or "png"
    path = directory / f"photo-{hashlib.sha1(data).hexdigest()[:16]}.{ext}"
    if not path.exists():
        path.write_bytes(data)
    return path
