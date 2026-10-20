"""Cloudflare R2 (S3 API) access for the worker.

Same env names and key scheme as the Next app (lib/r2.ts, lib/r2Config.ts):
  key  = {userId}/{resumes|cover-letters}/{sanitized-company}-{timestamp-ms}.pdf
  url  = /api/files/{key}   (authenticated proxy route; works with private buckets)
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from .settings import Settings, get_settings


class R2NotConfigured(RuntimeError):
    pass


def generate_file_key(user_id: str, doc_type: str, company_name: str | None, ext: str = "pdf") -> str:
    """Mirror of generateFileKey() in lib/r2.ts."""
    folder = "resumes" if doc_type == "resume" else "cover-letters"
    sanitized = re.sub(r"[^a-z0-9]", "-", (company_name or "document").lower())[:50]
    return f"{user_id}/{folder}/{sanitized}-{int(time.time() * 1000)}.{ext}"


def proxy_url(key: str) -> str:
    return f"/api/files/{key}"


class R2:
    def __init__(self, settings: Settings) -> None:
        endpoint = settings.r2_resolved_endpoint
        if not (endpoint and settings.r2_bucket and settings.r2_access_key_id and settings.r2_secret_access_key):
            raise R2NotConfigured("R2 is not configured (R2_ENDPOINT/R2_BUCKET/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY)")
        self.bucket = settings.r2_bucket
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=15,
                retries={"max_attempts": 2, "mode": "standard"},
                s3={"addressing_style": "path"},
            ),
        )

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self._client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type)

    def get(self, key: str, max_bytes: int | None = None) -> bytes | None:
        try:
            obj = self._client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404", "NotFound"):
                return None
            raise
        body = obj["Body"]
        try:
            if max_bytes is not None and int(obj.get("ContentLength") or 0) > max_bytes:
                return None
            return body.read()
        finally:
            body.close()

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=key)


_lock = threading.Lock()
_clients: dict[int, R2] = {}


def get_r2(settings: Settings | None = None) -> R2:
    settings = settings or get_settings()
    with _lock:
        client = _clients.get(id(settings))
        if client is None:
            client = _clients[id(settings)] = R2(settings)
        return client
