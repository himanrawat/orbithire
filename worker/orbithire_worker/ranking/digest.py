"""Morning digest: top 5 new matches since the last digest, emailed via Resend."""

from __future__ import annotations

import html
import logging
from datetime import date
from typing import Any
from uuid import UUID

import httpx
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .config import RankingConfig
from .prefilter import format_amount, normalize_currency, yearly_amount

log = logging.getLogger(__name__)

DIGEST_SIZE = 5
SETTINGS_PATH = "/settings?tab=job-search#ranking"


async def _one(conn: AsyncConnection, sql: str, params: Any = None) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def select_matches(conn: AsyncConnection, user_id: UUID | str, since: Any, limit: int = DIGEST_SIZE) -> list[dict[str, Any]]:
    """New, pre-filter-passing, active matches created after ``since`` (or the last 24 h),
    best first: LLM score, then similarity, then newest posting."""
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute("""
            SELECT m.id AS match_id, m.llm_score, m.similarity, m.llm_reasons,
                   p.title, p.company, p.location, p.is_remote, p.url, p.posted_at,
                   p.salary_min, p.salary_max, p.currency, p.salary_interval
              FROM job_matches m JOIN job_postings p ON p.id = m.job_posting_id
             WHERE m.user_id = %s AND m.status = 'new' AND m.prefilter_pass AND p.is_active
               AND m.created_at > COALESCE(%s, now() - interval '24 hours')
             ORDER BY m.llm_score DESC NULLS LAST, m.similarity DESC NULLS LAST,
                      p.posted_at DESC NULLS LAST, m.created_at DESC
             LIMIT %s
        """, (user_id, since, limit))
        return await cur.fetchall()


def _salary(m: dict[str, Any]) -> str | None:
    cur = normalize_currency(m.get("currency"))
    top = m.get("salary_max") if m.get("salary_max") is not None else m.get("salary_min")
    if not cur or top is None:
        return None
    y = yearly_amount(top, m.get("salary_interval"), cur)
    return f"up to {format_amount(y, cur)}" if y else None


def render(matches: list[dict[str, Any]], *, app_url: str, name: str | None) -> tuple[str, str, str]:
    """Return (subject, html, text). All posting fields are escaped."""
    base = app_url.rstrip("/")
    n = len(matches)
    subject = f"{n} new job match{'es' if n != 1 else ''} for you today"
    e = html.escape
    items_html, items_text = [], []
    for i, m in enumerate(matches, 1):
        link = f"{base}/jobs/{m['match_id']}"
        meta = " · ".join(x for x in (
            m.get("company"), m.get("location"), "Remote" if m.get("is_remote") else None, _salary(m)) if x)
        summary = ((m.get("llm_reasons") or {}).get("summary") or "") if isinstance(m.get("llm_reasons"), dict) else ""
        score = (f'<span style="display:inline-block;min-width:34px;padding:2px 8px;border-radius:12px;'
                 f'background:#eef2ff;color:#3730a3;font-weight:600;font-size:13px;text-align:center">'
                 f'{int(m["llm_score"])}</span>') if m.get("llm_score") is not None else ""
        items_html.append(
            f'<tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">'
            f'<div style="font-size:16px;font-weight:600;margin-bottom:4px">'
            f'<a href="{e(link)}" style="color:#111827;text-decoration:none">{e(m.get("title") or "Untitled role")}</a> {score}</div>'
            f'<div style="color:#4b5563;font-size:14px">{e(meta)}</div>'
            + (f'<div style="color:#374151;font-size:14px;margin-top:6px">{e(summary)}</div>' if summary else "")
            + f'<div style="margin-top:8px"><a href="{e(link)}" style="color:#4f46e5;font-size:14px">View in OrbitHire &rarr;</a></div>'
            f'</td></tr>')
        score_txt = f" [{int(m['llm_score'])}]" if m.get("llm_score") is not None else ""
        items_text.append(f"{i}. {m.get('title')}{score_txt}\n   {meta}\n   {link}")
    hello = f"Hi {e(name)}," if name else "Hi,"
    settings_link = f"{base}{SETTINGS_PATH}"
    body = (
        '<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,'
        'BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;'
        'border:1px solid #e5e7eb;border-radius:12px;padding:24px">'
        f'<tr><td><div style="font-size:20px;font-weight:700;margin-bottom:8px">Your morning job digest</div>'
        f'<div style="color:#4b5563;font-size:14px;margin-bottom:8px">{hello} here are the top {n} new '
        f'match{"es" if n != 1 else ""} from today\'s search.</div></td></tr>'
        + "".join(items_html)
        + f'<tr><td style="padding-top:18px"><a href="{e(base)}/jobs" style="display:inline-block;background:#4f46e5;color:#ffffff;'
        'padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Open Job Inbox</a></td></tr>'
        f'<tr><td style="padding-top:20px;color:#9ca3af;font-size:12px">You get this email because the morning digest is on. '
        f'<a href="{e(settings_link)}" style="color:#6b7280">Turn it off or change the time in Settings</a>.</td></tr>'
        '</table></td></tr></table></body></html>'
    )
    text = (f"{'Hi ' + name + ',' if name else 'Hi,'} here are the top {n} new matches from today's search.\n\n"
            + "\n\n".join(items_text)
            + f"\n\nJob Inbox: {base}/jobs\nTurn off the digest: {settings_link}\n")
    return subject, body, text


async def send_resend(client: httpx.AsyncClient, cfg: RankingConfig, *, to: str, subject: str,
                      html_body: str, text: str, idempotency_key: str, unsubscribe_url: str) -> dict[str, Any]:
    resp = await client.post(
        cfg.resend_api_url,
        headers={"Authorization": f"Bearer {cfg.resend_api_key}", "Idempotency-Key": idempotency_key},
        json={
            "from": cfg.digest_sender,
            "to": [to],
            "subject": subject,
            "html": html_body,
            "text": text,
            "headers": {"List-Unsubscribe": f"<{unsubscribe_url}>"},
            "tags": [{"name": "type", "value": "job_digest"}],
        },
        timeout=20,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Resend error {resp.status_code}: {resp.text[:300]}")
    return resp.json()


async def run_digest(conn: AsyncConnection, user_id: UUID | str, cfg: RankingConfig, *,
                     http: httpx.AsyncClient | None = None) -> dict[str, Any]:
    s = await _one(conn, "SELECT *, (now() AT TIME ZONE timezone)::date AS local_day "
                         "FROM ranking_settings WHERE user_id = %s", (user_id,))
    if not s:
        return {"skipped": "no ranking settings"}
    if not s["digest_enabled"]:
        return {"skipped": "digest disabled"}
    local_day: date = s["local_day"]

    async def mark_run(sent: bool) -> None:
        await conn.execute(
            "UPDATE ranking_settings SET digest_last_run_on = %s"
            + (", last_digest_at = now()" if sent else "") + " WHERE user_id = %s",
            (local_day, user_id))

    matches = await select_matches(conn, user_id, s["last_digest_at"])
    if not matches:
        await mark_run(False)
        return {"skipped": "no new matches", "sent": False}
    if not cfg.resend_api_key or not cfg.digest_sender:
        await mark_run(False)
        return {"skipped": "RESEND_API_KEY / FOLLOW_UP_FROM_EMAIL not configured", "sent": False,
                "matches": len(matches)}
    profile = await _one(conn, "SELECT email, full_name FROM profiles WHERE id = %s", (user_id,))
    if not profile or not profile.get("email"):
        await mark_run(False)
        return {"skipped": "user has no email", "sent": False}

    first = (profile.get("full_name") or "").split(" ")[0] or None
    subject, body, text = render(matches, app_url=cfg.app_url, name=first)
    own = http is None
    client = http or httpx.AsyncClient()
    try:
        result = await send_resend(
            client, cfg, to=profile["email"], subject=subject, html_body=body, text=text,
            idempotency_key=f"digest-{user_id}-{local_day.isoformat()}",
            unsubscribe_url=f"{cfg.app_url.rstrip('/')}{SETTINGS_PATH}")
    finally:
        if own:
            await client.aclose()
    await mark_run(True)
    return {"sent": True, "matches": len(matches), "email_id": result.get("id"),
            "match_ids": [str(m["match_id"]) for m in matches]}
