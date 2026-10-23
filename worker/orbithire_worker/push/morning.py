"""Morning plan notification, sent right after generate_daily_plan creates today's plan.

Push goes to every subscription when ``morning_plan`` is on. If no push was delivered
(no subscription, or every endpoint failed) and ``email_fallback`` is on, the plan goes out
by email through Resend (PRD R9: iOS push reach may be low). Each plan date is announced
once (notification_deliveries).
"""

from __future__ import annotations

import html
import logging
from typing import Any

import httpx
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from ..ranking.config import RankingConfig
from .config import PushConfig
from .deliver import PushSender, send_to_user
from .messages import morning_plan_message, open_items

log = logging.getLogger(__name__)

SETTINGS_PATH = "/settings?tab=notifications"
DEFAULT_PREFS = {"morning_plan": True, "follow_ups": True, "interviews": True, "email_fallback": True}


async def _one(conn: AsyncConnection, sql: str, params: Any) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def load_preferences(conn: AsyncConnection, user_id: str) -> dict[str, bool]:
    row = await _one(conn, "SELECT morning_plan, follow_ups, interviews, email_fallback "
                           "FROM notification_preferences WHERE user_id = %s", (user_id,))
    return {**DEFAULT_PREFS, **(row or {})}


async def claim(conn: AsyncConnection, user_id: str, kind: str, ref: str) -> bool:
    """True when this (kind, ref) had not been announced yet; records it."""
    cur = await conn.execute(
        "INSERT INTO notification_deliveries (user_id, kind, ref, channel) VALUES (%s, %s, %s, 'none') "
        "ON CONFLICT (user_id, kind, ref) DO NOTHING", (user_id, kind, ref))
    return cur.rowcount == 1


async def _set_channel(conn: AsyncConnection, user_id: str, kind: str, ref: str, channel: str) -> None:
    await conn.execute("UPDATE notification_deliveries SET channel = %s WHERE user_id = %s AND kind = %s AND ref = %s",
                       (channel, user_id, kind, ref))


def render_email(items: list[dict[str, Any]], *, app_url: str, name: str | None) -> tuple[str, str, str]:
    """Return (subject, html, text). Item fields are escaped."""
    base = app_url.rstrip("/")
    e = html.escape
    pending = open_items(items)
    settings = f"{base}{SETTINGS_PATH}"
    greeting = f"Hi {name}," if name else "Hi,"
    rows_html = "".join(
        f'<li style="margin:0 0 10px"><a href="{e(base + str(i.get("href") or "/dashboard"))}" '
        f'style="color:#101216;font-weight:600">{e(str(i.get("title") or "Plan item"))}</a>'
        f'<div style="color:#5b6170;font-size:14px">{e(str(i.get("reason") or ""))}</div></li>'
        for i in pending)
    rows_text = "\n".join(f"- {i.get('title')}: {base}{i.get('href') or '/dashboard'}" for i in pending)
    body = (
        '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:22px;color:#101216">'
        f"<p>{e(greeting)} here's your plan for today.</p>"
        f'<ol style="padding-left:20px">{rows_html}</ol>'
        f'<p><a href="{e(base)}/dashboard">Open Today</a></p>'
        f'<p style="color:#5b6170;font-size:13px">You get this email because push notifications aren\'t set up '
        f'on a device yet. <a href="{e(settings)}">Turn it off in Settings → Notifications</a>.</p>'
        "</div>"
    )
    text = (f"{greeting} here's your plan for today.\n\n{rows_text}\n\nOpen Today: {base}/dashboard\n"
            f"Turn off this email: {settings}\n")
    return "Your plan for today", body, text


async def _send_email(client: httpx.AsyncClient, cfg: RankingConfig, *, to: str, subject: str, body: str,
                      text: str, idempotency_key: str) -> None:
    resp = await client.post(
        cfg.resend_api_url,
        headers={"Authorization": f"Bearer {cfg.resend_api_key}", "Idempotency-Key": idempotency_key},
        json={
            "from": cfg.digest_sender, "to": [to], "subject": subject, "html": body, "text": text,
            "headers": {"List-Unsubscribe": f"<{cfg.app_url.rstrip('/')}{SETTINGS_PATH}>"},
            "tags": [{"name": "type", "value": "morning_plan"}],
        },
        timeout=20,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend error {resp.status_code}: {resp.text[:300]}")


async def _email_fallback(conn: AsyncConnection, user_id: str, plan_date: str, items: list[dict[str, Any]],
                          cfg: RankingConfig, http: httpx.AsyncClient | None) -> bool:
    if not cfg.resend_api_key or not cfg.digest_sender:
        return False
    profile = await _one(conn, "SELECT email, full_name FROM profiles WHERE id = %s", (user_id,))
    if not profile or not profile.get("email"):
        return False
    first = (profile.get("full_name") or "").split(" ")[0] or None
    subject, body, text = render_email(items, app_url=cfg.app_url, name=first)
    client = http or httpx.AsyncClient()
    try:
        await _send_email(client, cfg, to=profile["email"], subject=subject, body=body, text=text,
                          idempotency_key=f"morning-plan-{user_id}-{plan_date}")
    finally:
        if http is None:
            await client.aclose()
    return True


async def notify_morning_plan(conn: AsyncConnection, user_id: str, plan_date: str, *, push_cfg: PushConfig,
                              email_cfg: RankingConfig, sender: PushSender | None,
                              http: httpx.AsyncClient | None = None) -> dict[str, Any]:
    prefs = await load_preferences(conn, user_id)
    if not prefs["morning_plan"]:
        return {"notified": "off"}
    plan = await _one(conn, "SELECT items FROM daily_plans WHERE user_id = %s AND date = %s", (user_id, plan_date))
    items = list((plan or {}).get("items") or [])
    if not items or not await claim(conn, user_id, "morning_plan", plan_date):
        return {"notified": "skipped"}

    pushed = 0
    if push_cfg.enabled and sender is not None:
        result = await send_to_user(conn, user_id, morning_plan_message(items), sender,
                                    concurrency=push_cfg.push_concurrency)
        pushed = result.sent
    if pushed:
        await _set_channel(conn, user_id, "morning_plan", plan_date, "push")
        return {"notified": "push", "devices": pushed}
    if prefs["email_fallback"]:
        try:
            emailed = await _email_fallback(conn, user_id, plan_date, items, email_cfg, http)
        except Exception:  # noqa: BLE001 - the plan exists; a failed email must not fail the task
            log.exception("morning plan email failed")
            emailed = False
        if emailed:
            await _set_channel(conn, user_id, "morning_plan", plan_date, "email")
            return {"notified": "email"}
    return {"notified": "none"}
