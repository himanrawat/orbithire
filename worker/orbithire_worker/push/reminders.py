"""Follow-up and interview push reminders (task ``push_reminders``, every 15 minutes).

One set-based query finds what is due and claims it in notification_deliveries in the same
statement, so a reminder is announced once even if two ticks overlap:

* follow-ups whose ``next_reminder_at`` passed within the last day (status active)
* interviews starting within the next 24 hours

Only for people with a push subscription, the matching switch on, and a local time between
8 AM and 9 PM (nothing in the middle of the night). Each person gets at most one push per
tick: the most urgent item, with a count of the rest in the body.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from psycopg import AsyncConnection
from psycopg.rows import dict_row

from .config import PushConfig
from .deliver import PushMessage, PushSender, load_subscriptions, send_to_subscriptions
from .messages import follow_up_message, interview_message

QUIET_START_HOUR = 21
QUIET_END_HOUR = 8
SCAN_LIMIT = 500

DUE_SQL = """
WITH eligible AS (
  SELECT p.id AS user_id, p.timezone
    FROM profiles p
    LEFT JOIN notification_preferences np ON np.user_id = p.id
   WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.id)
     AND extract(hour FROM (%(now)s AT TIME ZONE p.timezone)) >= %(quiet_end)s
     AND extract(hour FROM (%(now)s AT TIME ZONE p.timezone)) < %(quiet_start)s
     AND (COALESCE(np.follow_ups, TRUE) OR COALESCE(np.interviews, TRUE))
), due AS (
  SELECT f.user_id, 'follow_up'::text AS kind,
         f.id::text || '@' || to_char(f.next_reminder_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS ref,
         c.id AS company_id, c.name AS company, f.next_reminder_at AS at, e.timezone
    FROM follow_ups f
    JOIN companies c ON c.id = f.company_id
    JOIN eligible e ON e.user_id = f.user_id
    LEFT JOIN notification_preferences np ON np.user_id = f.user_id
   WHERE f.status = 'active' AND COALESCE(np.follow_ups, TRUE)
     AND f.next_reminder_at <= %(now)s AND f.next_reminder_at > %(now)s - interval '1 day'
  UNION ALL
  SELECT c.user_id, 'interview'::text,
         c.id::text || '@' || to_char(c.interview_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
         c.id, c.name, c.interview_at, e.timezone
    FROM companies c
    JOIN eligible e ON e.user_id = c.user_id
    LEFT JOIN notification_preferences np ON np.user_id = c.user_id
   WHERE COALESCE(np.interviews, TRUE)
     AND c.interview_at > %(now)s AND c.interview_at <= %(now)s + interval '24 hours'
), picked AS (
  SELECT * FROM due ORDER BY at LIMIT %(limit)s
), claimed AS (
  INSERT INTO notification_deliveries (user_id, kind, ref, channel)
  SELECT user_id, kind, ref, 'push' FROM picked
  ON CONFLICT (user_id, kind, ref) DO NOTHING
  RETURNING user_id, kind, ref
)
SELECT picked.* FROM picked JOIN claimed USING (user_id, kind, ref)
"""


def _priority(row: dict[str, Any]) -> tuple[int, datetime]:
    # Interviews first (time-bound), then the oldest follow-up.
    return (0 if row["kind"] == "interview" else 1, row["at"])


def message_for(rows: list[dict[str, Any]], now: datetime) -> PushMessage:
    """One push per person: the most urgent item, plus how many others are waiting."""
    top = sorted(rows, key=_priority)[0]
    company = str(top.get("company") or "a company")
    company_id = str(top["company_id"])
    if top["kind"] == "interview":
        msg = interview_message(company, company_id, top["at"], str(top.get("timezone") or ""), now)
    else:
        msg = follow_up_message(company, company_id)
    extra = len(rows) - 1
    if extra <= 0:
        return msg
    suffix = f" {extra} more reminder{'s' if extra != 1 else ''} on Today."
    return PushMessage(title=msg.title, body=msg.body + suffix, href=msg.href, tag=msg.tag)


def group_by_user(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(str(row["user_id"]), []).append(row)
    return grouped


async def find_due(conn: AsyncConnection, now: datetime) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(DUE_SQL, {"now": now, "quiet_end": QUIET_END_HOUR, "quiet_start": QUIET_START_HOUR,
                                    "limit": SCAN_LIMIT})
        return await cur.fetchall()


async def run_reminders(conn: AsyncConnection, *, push_cfg: PushConfig, sender: PushSender | None,
                        now: datetime | None = None) -> dict[str, Any]:
    if not push_cfg.enabled or sender is None:
        return {"skipped": "VAPID keys not configured"}
    now = now or datetime.now(timezone.utc)
    grouped = group_by_user(await find_due(conn, now))
    if not grouped:
        return {"users": 0, "sent": 0}
    messages = {uid: message_for(rows, now) for uid, rows in grouped.items()}
    subs = await load_subscriptions(conn, list(messages))
    results = await send_to_subscriptions(conn, subs, messages, sender, concurrency=push_cfg.push_concurrency)
    return {"users": len(messages), "sent": sum(r.sent for r in results.values()),
            "gone": sum(r.gone for r in results.values())}
