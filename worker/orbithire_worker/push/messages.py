"""Notification copy. Plain and specific: no streaks, guilt or urgency tricks (PRD Section 5)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ..today.plan import safe_zone
from .deliver import PushMessage


def open_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [i for i in items if isinstance(i, dict) and not i.get("done")]


def morning_plan_message(items: list[dict[str, Any]]) -> PushMessage:
    pending = open_items(items)
    if not pending:
        body = "Your plan for today is ready."
    else:
        first = str(pending[0].get("title") or "your first step")
        rest = len(pending) - 1
        more = f" Plus {rest} more on your plan." if rest > 0 else ""
        body = f"Start with: {first}.{more}"
    return PushMessage(title="Your plan for today", body=body, href="/dashboard",
                       tag="morning-plan", badge=len(pending))


def follow_up_message(company: str, company_id: str) -> PushMessage:
    return PushMessage(title=f"Follow-up for {company}",
                       body=f"Your follow-up with {company} is due. The draft is ready when you are.",
                       href=f"/companies/{company_id}", tag=f"follow-up-{company_id}")


def _clock(at: datetime, tz: str) -> str:
    local = at.astimezone(safe_zone(tz))
    hour = local.strftime("%I").lstrip("0") or "12"
    return f"{hour}:{local:%M} {local:%p}"


def interview_message(company: str, company_id: str, at: datetime, tz: str, now: datetime) -> PushMessage:
    zone = safe_zone(tz)
    same_day = at.astimezone(zone).date() == now.astimezone(zone).date()
    when = f"today at {_clock(at, tz)}" if same_day else f"tomorrow at {_clock(at, tz)}"
    return PushMessage(title=f"Interview with {company}",
                       body=f"Your interview is {when}. Your prep notes are one tap away.",
                       href=f"/companies/{company_id}", tag=f"interview-{company_id}")
