"""billing_reminder: annual renewal email (no database: a fake pool answers the two lookups)."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest

from orbithire_worker.handlers.billing_reminder import (
    billing_reminder,
    format_amount,
    format_date,
    render,
)
from orbithire_worker.ranking.config import RankingConfig
from orbithire_worker.registry import Task, TaskContext
from orbithire_worker.settings import Settings

USER = str(uuid.uuid4())


class FakeCursor:
    def __init__(self, rows: dict[str, dict[str, Any] | None]) -> None:
        self.rows = rows
        self.sql = ""

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, *exc: object) -> None:
        return None

    async def execute(self, sql: str, params: Any) -> None:
        self.sql = sql

    async def fetchone(self) -> dict[str, Any] | None:
        return self.rows["subscriptions"] if "FROM subscriptions" in self.sql else self.rows["profiles"]


class FakeConn:
    def __init__(self, rows: dict[str, dict[str, Any] | None]) -> None:
        self.rows = rows

    def cursor(self, row_factory: Any = None) -> FakeCursor:
        return FakeCursor(self.rows)


class FakePool:
    def __init__(self, rows: dict[str, dict[str, Any] | None]) -> None:
        self.rows = rows

    @asynccontextmanager
    async def connection(self):  # type: ignore[no-untyped-def]
        yield FakeConn(self.rows)


def _task(**payload: Any) -> Task:
    base = {"user_id": USER, "amount_cents": 14400, "currency": "usd",
            "renewal_date": "2026-11-20T15:00:00.000Z", "interval": "year", "event_id": "evt_1"}
    base.update(payload)
    return Task(id=uuid.uuid4(), type="billing_reminder", payload=base, status="running",
                priority=0, attempts=1, max_attempts=3)


def _ctx(sub: dict[str, Any] | None, sent: list[dict[str, Any]], *, resend: bool = True) -> TaskContext:
    def respond(request: httpx.Request) -> httpx.Response:
        sent.append({"headers": dict(request.headers), "json": json.loads(request.content)})
        return httpx.Response(200, json={"id": "email_123"})

    cfg = RankingConfig(_env_file=None, resend_api_key="re_test" if resend else None,
                        follow_up_from_email="info@example.com", app_url="https://app.example.com")
    rows = {"subscriptions": sub, "profiles": {"email": "sam@example.com", "full_name": "Sam Lee"}}
    return TaskContext(worker_id="test", settings=Settings(_env_file=None), pool=FakePool(rows),  # type: ignore[arg-type]
                       extra={"ranking_config": cfg, "http": httpx.AsyncClient(transport=httpx.MockTransport(respond))})


ACTIVE_YEARLY = {"plan": "pro", "status": "active", "interval": "year", "cancel_at_period_end": False}


def test_formatting() -> None:
    assert format_amount(14400, "usd") == "$144.00"
    assert format_amount(1500, "eur") == "15.00 EUR"
    assert format_date("2026-11-20T15:00:00.000Z") == "November 20, 2026"


def test_render_has_price_date_and_cancel_link() -> None:
    subject, body, text = render(amount="$144.00", renewal_date="November 20, 2026",
                                 app_url="https://app.example.com/", name="Sam")
    assert "November 20, 2026" in subject
    for part in ("$144.00", "https://app.example.com/settings?tab=billing", "/terms#plans", "Hi Sam,"):
        assert part in text
    assert "https://app.example.com/settings?tab=billing" in body


@pytest.mark.asyncio
async def test_sends_for_active_yearly_plan() -> None:
    sent: list[dict[str, Any]] = []
    result = await billing_reminder(_task(), _ctx(ACTIVE_YEARLY, sent))
    assert result["sent"] is True
    assert result["email_id"] == "email_123"
    assert len(sent) == 1
    assert sent[0]["json"]["to"] == ["sam@example.com"]
    assert sent[0]["headers"]["idempotency-key"] == f"billing-reminder-{USER}-2026-11-20"


@pytest.mark.asyncio
@pytest.mark.parametrize("sub", [
    None,
    {**ACTIVE_YEARLY, "cancel_at_period_end": True},
    {**ACTIVE_YEARLY, "interval": "month"},
    {**ACTIVE_YEARLY, "status": "canceled"},
])
async def test_skips_when_no_reminder_is_due(sub: dict[str, Any] | None) -> None:
    sent: list[dict[str, Any]] = []
    result = await billing_reminder(_task(), _ctx(sub, sent))
    assert result["sent"] is False
    assert sent == []


@pytest.mark.asyncio
async def test_skips_without_resend() -> None:
    sent: list[dict[str, Any]] = []
    result = await billing_reminder(_task(), _ctx(ACTIVE_YEARLY, sent, resend=False))
    assert result == {"sent": False, "skipped": "RESEND_API_KEY / FOLLOW_UP_FROM_EMAIL not configured"}
