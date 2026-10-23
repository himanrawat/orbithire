"""Send one notification to every push subscription a person has.

Subscriptions that answer 404/410 are deleted (the browser unsubscribed or the endpoint
expired); other failures bump ``failed_count``. Bookkeeping is two set-based statements,
not one query per subscription. Tests inject ``sender`` instead of hitting a push service.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .config import PushConfig

log = logging.getLogger(__name__)

GONE_STATUSES = frozenset({404, 410})
# A subscription that keeps failing for other reasons is dropped after this many tries.
MAX_FAILURES = 10

# (subscription_info, json payload) -> HTTP status from the push service
PushSender = Callable[[dict[str, Any], str], Awaitable[int]]


@dataclass(frozen=True, slots=True)
class PushMessage:
    title: str
    body: str
    href: str
    tag: str
    badge: int | None = None

    def to_json(self) -> str:
        data: dict[str, Any] = {"title": self.title, "body": self.body, "href": self.href, "tag": self.tag}
        if self.badge is not None:
            data["badge"] = self.badge
        return json.dumps(data)


@dataclass(frozen=True, slots=True)
class DeliveryResult:
    sent: int
    gone: int
    failed: int


def pywebpush_sender(cfg: PushConfig) -> PushSender:
    """The real sender: pywebpush (requests) in a worker thread."""
    from pywebpush import WebPushException, webpush

    def _send(info: dict[str, Any], data: str) -> int:
        try:
            resp = webpush(info, data, vapid_private_key=cfg.vapid_private_key,
                           vapid_claims={"sub": cfg.vapid_subject}, ttl=cfg.push_ttl_seconds, timeout=10)
            return int(getattr(resp, "status_code", 201))
        except WebPushException as exc:
            return int(exc.response.status_code) if exc.response is not None else 0
        except Exception:  # noqa: BLE001 - network errors count as a failed attempt
            log.exception("web push send failed")
            return 0

    async def send(info: dict[str, Any], data: str) -> int:
        return await asyncio.to_thread(_send, info, data)

    return send


async def load_subscriptions(conn: AsyncConnection, user_ids: list[str]) -> list[dict[str, Any]]:
    if not user_ids:
        return []
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            "SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY(%s::uuid[])",
            (user_ids,))
        return await cur.fetchall()


def _info(sub: dict[str, Any]) -> dict[str, Any]:
    return {"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}}


async def _record(conn: AsyncConnection, ok: list[UUID], gone: list[UUID], failed: list[UUID]) -> None:
    if ok:
        await conn.execute("UPDATE push_subscriptions SET last_success_at = now(), failed_count = 0 "
                           "WHERE id = ANY(%s::uuid[])", (ok,))
    if gone:
        await conn.execute("DELETE FROM push_subscriptions WHERE id = ANY(%s::uuid[])", (gone,))
    if failed:
        await conn.execute("UPDATE push_subscriptions SET failed_count = failed_count + 1 "
                           "WHERE id = ANY(%s::uuid[])", (failed,))
        await conn.execute("DELETE FROM push_subscriptions WHERE id = ANY(%s::uuid[]) AND failed_count >= %s",
                           (failed, MAX_FAILURES))


def classify(status: int) -> str:
    if 200 <= status < 300:
        return "ok"
    if status in GONE_STATUSES:
        return "gone"
    return "failed"


async def send_to_subscriptions(conn: AsyncConnection, subs: list[dict[str, Any]],
                                messages: dict[str, PushMessage], sender: PushSender,
                                *, concurrency: int = 8) -> dict[str, DeliveryResult]:
    """Send ``messages[user_id]`` to each of that user's subscriptions, with bounded
    concurrency. Returns a result per user id."""
    gate = asyncio.Semaphore(max(1, concurrency))

    async def one(sub: dict[str, Any]) -> tuple[dict[str, Any], str]:
        message = messages[str(sub["user_id"])]
        async with gate:
            return sub, classify(await sender(_info(sub), message.to_json()))

    outcomes = await asyncio.gather(*(one(s) for s in subs if str(s["user_id"]) in messages))
    buckets: dict[str, list[UUID]] = {"ok": [], "gone": [], "failed": []}
    per_user: dict[str, dict[str, int]] = {uid: {"ok": 0, "gone": 0, "failed": 0} for uid in messages}
    for sub, outcome in outcomes:
        buckets[outcome].append(sub["id"])
        per_user[str(sub["user_id"])][outcome] += 1
    await _record(conn, buckets["ok"], buckets["gone"], buckets["failed"])
    return {uid: DeliveryResult(c["ok"], c["gone"], c["failed"]) for uid, c in per_user.items()}


async def send_to_user(conn: AsyncConnection, user_id: str, message: PushMessage, sender: PushSender,
                       *, concurrency: int = 8) -> DeliveryResult:
    subs = await load_subscriptions(conn, [user_id])
    results = await send_to_subscriptions(conn, subs, {user_id: message}, sender, concurrency=concurrency)
    return results[user_id]
