"""billing_reminder: email before an annual Pro renewal (PRD area 10).

Enqueued by the Stripe webhook (app/api/billing/webhook) on ``invoice.upcoming`` for
yearly subscriptions. payload::

    {"user_id": str, "amount_cents": int, "currency": "usd",
     "renewal_date": ISO-8601, "interval": "year", "event_id": str}

Re-checks the subscription before sending, so a plan canceled after the event was
queued gets no reminder. Sent through Resend with the digest's sender settings
(RESEND_API_KEY, FOLLOW_UP_FROM_EMAIL / DIGEST_FROM_EMAIL, NEXT_PUBLIC_APP_URL).
Tests pass an httpx client via ``ctx.extra["http"]``.
"""

from __future__ import annotations

import html
from datetime import datetime
from typing import Any

import httpx
from psycopg.rows import dict_row

from ..ranking.config import RankingConfig, get_ranking_config
from ..registry import Task, TaskContext, handler

CANCEL_PATH = "/settings?tab=billing"
TERMS_PATH = "/terms#plans"


def format_amount(amount_cents: int, currency: str) -> str:
    value = amount_cents / 100
    if currency.lower() == "usd":
        return f"${value:,.2f}"
    return f"{value:,.2f} {currency.upper()}"


def format_date(iso: str) -> str:
    day = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return f"{day:%B} {day.day}, {day.year}"


def render(*, amount: str, renewal_date: str, app_url: str, name: str | None) -> tuple[str, str, str]:
    base = app_url.rstrip("/")
    cancel = f"{base}{CANCEL_PATH}"
    terms = f"{base}{TERMS_PATH}"
    subject = f"Your NextMilestone Pro plan renews on {renewal_date}"
    greeting = f"Hi {name}," if name else "Hi,"
    lines = [
        f"Your yearly NextMilestone Pro plan renews automatically on {renewal_date}. "
        f"We'll charge {amount} (plus any applicable tax) to the card on file.",
        "Nothing to do if you'd like to keep Pro. If not, cancel any time before then in "
        "Settings → Billing; you keep Pro until the end of the year you've paid for.",
    ]
    text = "\n\n".join([greeting, *lines, f"Cancel or manage your plan: {cancel}", f"Renewal terms: {terms}"]) + "\n"
    paragraphs = "".join(f"<p>{html.escape(line)}</p>" for line in [greeting, *lines])
    body = (
        '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:22px;color:#101216">'
        f"{paragraphs}"
        f'<p><a href="{html.escape(cancel)}">Cancel or manage your plan</a></p>'
        f'<p style="color:#5b6170;font-size:13px">Renewal terms: <a href="{html.escape(terms)}">{html.escape(terms)}</a></p>'
        "</div>"
    )
    return subject, body, text


async def _one(conn: Any, sql: str, params: Any) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def _send(client: httpx.AsyncClient, cfg: RankingConfig, *, to: str, subject: str,
                body: str, text: str, idempotency_key: str) -> dict[str, Any]:
    resp = await client.post(
        cfg.resend_api_url,
        headers={"Authorization": f"Bearer {cfg.resend_api_key}", "Idempotency-Key": idempotency_key},
        json={
            "from": cfg.digest_sender,
            "to": [to],
            "subject": subject,
            "html": body,
            "text": text,
            "tags": [{"name": "type", "value": "billing_reminder"}],
        },
        timeout=20,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend error {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def _skip_reason(sub: dict[str, Any] | None, profile: dict[str, Any] | None, cfg: RankingConfig) -> str | None:
    if not sub or sub.get("plan") != "pro" or sub.get("status") not in ("active", "trialing", "past_due"):
        return "no active Pro plan"
    if sub.get("cancel_at_period_end"):
        return "plan is set to cancel"
    if sub.get("interval") != "year":
        return "not a yearly plan"
    if not profile or not profile.get("email"):
        return "user has no email"
    if not cfg.resend_api_key or not cfg.digest_sender:
        return "RESEND_API_KEY / FOLLOW_UP_FROM_EMAIL not configured"
    return None


@handler("billing_reminder")
async def billing_reminder(task: Task, ctx: TaskContext) -> dict[str, Any]:
    cfg: RankingConfig = ctx.extra.get("ranking_config") or get_ranking_config()
    payload = task.payload or {}
    user_id = str(payload.get("user_id") or task.user_id or "")
    renewal_iso = str(payload.get("renewal_date") or "")
    if not user_id or not renewal_iso:
        return {"sent": False, "skipped": "missing user_id or renewal_date"}

    async with ctx.pool.connection() as conn:
        sub = await _one(conn, "SELECT plan, status, \"interval\", cancel_at_period_end "
                               "FROM subscriptions WHERE user_id = %s", (user_id,))
        profile = await _one(conn, "SELECT email, full_name FROM profiles WHERE id = %s", (user_id,))

    reason = _skip_reason(sub, profile, cfg)
    if reason:
        return {"sent": False, "skipped": reason}
    assert profile is not None

    renewal_date = format_date(renewal_iso)
    amount = format_amount(int(payload.get("amount_cents") or 0), str(payload.get("currency") or "usd"))
    first = (profile.get("full_name") or "").split(" ")[0] or None
    subject, body, text = render(amount=amount, renewal_date=renewal_date, app_url=cfg.app_url, name=first)

    own = ctx.extra.get("http") is None
    client: httpx.AsyncClient = ctx.extra.get("http") or httpx.AsyncClient()
    try:
        result = await _send(client, cfg, to=profile["email"], subject=subject, body=body, text=text,
                             idempotency_key=f"billing-reminder-{user_id}-{renewal_iso[:10]}")
    finally:
        if own:
            await client.aclose()
    return {"sent": True, "email_id": result.get("id"), "renewal_date": renewal_iso[:10]}
