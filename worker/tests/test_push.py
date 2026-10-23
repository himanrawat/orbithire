"""Web push (PRD area 8): copy, delivery bookkeeping, morning plan + email fallback.

No database: a fake connection answers lookups by SQL fragment and records writes.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from orbithire_worker.push.config import PushConfig
from orbithire_worker.push.deliver import PushMessage, classify, send_to_subscriptions
from orbithire_worker.push.messages import interview_message, morning_plan_message
from orbithire_worker.push.morning import notify_morning_plan, render_email
from orbithire_worker.push.reminders import message_for, run_reminders
from orbithire_worker.ranking.config import RankingConfig

USER = str(uuid.uuid4())
ITEMS = [
    {"id": "a", "kind": "follow_up", "title": "Send your follow-up to Acme", "reason": "Due today",
     "href": "/companies/1", "done": False},
    {"id": "b", "kind": "lesson", "title": "Continue <SQL> basics", "reason": "In progress",
     "href": "/learn/lessons/2", "done": False},
    {"id": "c", "kind": "focus_block", "title": "Focus block", "reason": "", "href": "/focus", "done": True},
]


class Result:
    def __init__(self, rowcount: int) -> None:
        self.rowcount = rowcount


class FakeCursor:
    def __init__(self, conn: "FakeConn") -> None:
        self.conn = conn
        self.sql = ""

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def execute(self, sql: str, params: Any = None) -> None:
        self.sql = sql

    def _rows(self) -> list[dict[str, Any]]:
        for fragment, rows in self.conn.reads.items():
            if fragment in self.sql:
                return rows
        return []

    async def fetchone(self) -> dict[str, Any] | None:
        rows = self._rows()
        return rows[0] if rows else None

    async def fetchall(self) -> list[dict[str, Any]]:
        return self._rows()


class FakeConn:
    def __init__(self, reads: dict[str, list[dict[str, Any]]], *, claim: bool = True) -> None:
        self.reads = reads
        self.writes: list[tuple[str, Any]] = []
        self.claim_ok = claim

    def cursor(self, row_factory: Any = None) -> FakeCursor:
        return FakeCursor(self)

    async def execute(self, sql: str, params: Any = None) -> Result:
        self.writes.append((sql, params))
        if "INSERT INTO notification_deliveries" in sql:
            return Result(1 if self.claim_ok else 0)
        return Result(1)


def _sub(status_key: str) -> dict[str, Any]:
    return {"id": uuid.uuid4(), "user_id": USER, "endpoint": f"https://push.example/{status_key}",
            "p256dh": "k", "auth": "a"}


def _sender(statuses: dict[str, int], sent: list[dict[str, Any]]):  # type: ignore[no-untyped-def]
    async def send(info: dict[str, Any], data: str) -> int:
        sent.append({"endpoint": info["endpoint"], "data": json.loads(data)})
        return statuses[info["endpoint"].rsplit("/", 1)[1]]
    return send


PUSH_ON = PushConfig(_env_file=None, vapid_public_key="pub", vapid_private_key="priv")
PUSH_OFF = PushConfig(_env_file=None, vapid_public_key=None, vapid_private_key=None)


def _email_cfg(resend: bool = True) -> RankingConfig:
    return RankingConfig(_env_file=None, resend_api_key="re_test" if resend else None,
                         follow_up_from_email="info@example.com", app_url="https://app.example.com")


def test_classify_statuses() -> None:
    assert classify(201) == "ok"
    assert classify(404) == "gone"
    assert classify(410) == "gone"
    assert classify(500) == "failed"
    assert classify(0) == "failed"


def test_morning_message_counts_open_items() -> None:
    msg = morning_plan_message(ITEMS)
    assert msg.badge == 2
    assert msg.href == "/dashboard"
    assert msg.body == "Start with: Send your follow-up to Acme. Plus 1 more on your plan."


def test_interview_message_says_today_or_tomorrow() -> None:
    now = datetime(2026, 10, 23, 14, 0, tzinfo=timezone.utc)  # 10 AM in New York
    today = interview_message("Acme", "c1", now + timedelta(hours=4), "America/New_York", now)
    tomorrow = interview_message("Acme", "c1", now + timedelta(hours=20), "America/New_York", now)
    assert "today at 2:00 PM" in today.body
    assert "tomorrow at 6:00 AM" in tomorrow.body


def test_reminder_message_prefers_interviews_and_counts_rest() -> None:
    now = datetime(2026, 10, 23, 14, 0, tzinfo=timezone.utc)
    rows = [
        {"user_id": USER, "kind": "follow_up", "company": "Beta", "company_id": "b", "at": now, "timezone": "UTC"},
        {"user_id": USER, "kind": "interview", "company": "Acme", "company_id": "a",
         "at": now + timedelta(hours=3), "timezone": "UTC"},
    ]
    msg = message_for(rows, now)
    assert msg.title == "Interview with Acme"
    assert msg.body.endswith("1 more reminder on Today.")


def test_render_email_escapes_and_skips_done() -> None:
    subject, body, text = render_email(ITEMS, app_url="https://app.example.com/", name="Sam")
    assert subject == "Your plan for today"
    assert "&lt;SQL&gt;" in body
    assert "Focus block" not in body
    assert "https://app.example.com/settings?tab=notifications" in text


async def test_delivery_removes_gone_and_counts_failures() -> None:
    conn = FakeConn({})
    subs = [_sub("ok"), _sub("gone"), _sub("bad")]
    sent: list[dict[str, Any]] = []
    msg = PushMessage(title="t", body="b", href="/dashboard", tag="x")
    results = await send_to_subscriptions(conn, subs, {USER: msg}, _sender({"ok": 201, "gone": 410, "bad": 500}, sent))  # type: ignore[arg-type]
    assert results[USER].sent == 1 and results[USER].gone == 1 and results[USER].failed == 1
    sqls = [sql for sql, _ in conn.writes]
    assert any(sql.startswith("DELETE FROM push_subscriptions WHERE id = ANY") and "failed_count" not in sql for sql in sqls)
    assert any("failed_count = failed_count + 1" in sql for sql in sqls)
    assert any("last_success_at = now()" in sql for sql in sqls)


async def test_morning_plan_pushes_when_a_device_works() -> None:
    conn = FakeConn({"FROM daily_plans": [{"items": ITEMS}], "FROM push_subscriptions": [_sub("ok")]})
    sent: list[dict[str, Any]] = []
    result = await notify_morning_plan(conn, USER, "2026-10-23", push_cfg=PUSH_ON, email_cfg=_email_cfg(),  # type: ignore[arg-type]
                                       sender=_sender({"ok": 201}, sent))
    assert result == {"notified": "push", "devices": 1}
    assert sent[0]["data"]["badge"] == 2


async def test_morning_plan_falls_back_to_email() -> None:
    emails: list[dict[str, Any]] = []

    def respond(request: httpx.Request) -> httpx.Response:
        emails.append(json.loads(request.content))
        return httpx.Response(200, json={"id": "email_1"})

    conn = FakeConn({"FROM daily_plans": [{"items": ITEMS}], "FROM push_subscriptions": [_sub("gone")],
                     "FROM profiles": [{"email": "sam@example.com", "full_name": "Sam Lee"}]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        result = await notify_morning_plan(conn, USER, "2026-10-23", push_cfg=PUSH_ON, email_cfg=_email_cfg(),  # type: ignore[arg-type]
                                           sender=_sender({"gone": 410}, []), http=http)
    assert result == {"notified": "email"}
    assert emails[0]["to"] == ["sam@example.com"]
    assert emails[0]["tags"] == [{"name": "type", "value": "morning_plan"}]


async def test_morning_plan_respects_switches_and_dedupe() -> None:
    off = FakeConn({"FROM notification_preferences": [{"morning_plan": False}]})
    assert (await notify_morning_plan(off, USER, "2026-10-23", push_cfg=PUSH_ON, email_cfg=_email_cfg(),  # type: ignore[arg-type]
                                      sender=None)) == {"notified": "off"}
    no_fallback = FakeConn({"FROM notification_preferences": [{"email_fallback": False}],
                            "FROM daily_plans": [{"items": ITEMS}]})
    assert (await notify_morning_plan(no_fallback, USER, "2026-10-23", push_cfg=PUSH_OFF,  # type: ignore[arg-type]
                                      email_cfg=_email_cfg(), sender=None)) == {"notified": "none"}
    dup = FakeConn({"FROM daily_plans": [{"items": ITEMS}]}, claim=False)
    assert (await notify_morning_plan(dup, USER, "2026-10-23", push_cfg=PUSH_ON, email_cfg=_email_cfg(),  # type: ignore[arg-type]
                                      sender=None)) == {"notified": "skipped"}


async def test_reminders_noop_without_keys() -> None:
    result = await run_reminders(FakeConn({}), push_cfg=PUSH_OFF, sender=None)  # type: ignore[arg-type]
    assert result == {"skipped": "VAPID keys not configured"}
