"""Today (PRD area 2): next-step rules and the daily plan builder. Pure, no I/O.

Mirror of lib/today/nextStep.ts; keep both in sync. First matching rule wins:
  1. an interview within 3 days       -> prep for it
  2. a follow-up due today (or late)  -> send the drafted follow-up
  3. a path lesson in progress        -> continue the lesson
  4. new matches scoring 80 or more   -> review them
  5. otherwise                        -> a focus block

Plan items: {"id", "kind", "title", "reason", "href", "done"}.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

INTERVIEW_WINDOW = timedelta(hours=72)
STRONG_MATCH_SCORE = 80
MIN_PLAN_ITEMS = 3
MAX_PLAN_ITEMS = 5
DEFAULT_TIME_ZONE = "America/New_York"

PlanItem = dict[str, Any]


@dataclass(frozen=True, slots=True)
class Interview:
    company_id: str
    company_name: str
    interview_at: datetime


@dataclass(frozen=True, slots=True)
class FollowUp:
    id: str
    company_id: str
    company_name: str
    due_at: datetime


@dataclass(frozen=True, slots=True)
class Lesson:
    id: str
    title: str
    href: str


@dataclass(frozen=True, slots=True)
class Signals:
    now: datetime  # timezone-aware
    time_zone: str = DEFAULT_TIME_ZONE
    interviews: tuple[Interview, ...] = field(default_factory=tuple)
    follow_ups: tuple[FollowUp, ...] = field(default_factory=tuple)
    lesson: Lesson | None = None
    strong_match_count: int = 0


def safe_zone(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz or DEFAULT_TIME_ZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TIME_ZONE)


def local_date(dt: datetime, tz: str) -> str:
    return dt.astimezone(safe_zone(tz)).date().isoformat()


def upcoming_interviews(s: Signals) -> list[Interview]:
    end = s.now + INTERVIEW_WINDOW
    return sorted((i for i in s.interviews if s.now <= i.interview_at <= end), key=lambda i: i.interview_at)


def due_follow_ups(s: Signals) -> list[FollowUp]:
    today = local_date(s.now, s.time_zone)
    return sorted((f for f in s.follow_ups if local_date(f.due_at, s.time_zone) <= today), key=lambda f: f.due_at)


def _interview_time(dt: datetime, tz: str) -> str:
    local = dt.astimezone(safe_zone(tz))
    hour = local.hour % 12 or 12
    suffix = "AM" if local.hour < 12 else "PM"
    return f"{local:%a} {hour}:{local:%M} {suffix}"


def _item(id_: str, kind: str, title: str, reason: str, href: str) -> PlanItem:
    return {"id": id_, "kind": kind, "title": title, "reason": reason, "href": href, "done": False}


def interview_prep_item(i: Interview, tz: str) -> PlanItem:
    return _item(
        f"interview_prep:{i.company_id}", "interview_prep",
        f"Prep for your {i.company_name} interview",
        f"Your interview is {_interview_time(i.interview_at, tz)}. Practice one likely question.",
        f"/prep?company={i.company_id}",
    )


def follow_up_item(f: FollowUp) -> PlanItem:
    return _item(
        f"follow_up:{f.id}", "follow_up",
        f"Send your follow-up to {f.company_name}",
        "A follow-up is due today. Your draft is ready to review.",
        f"/companies/{f.company_id}",
    )


def lesson_item(lesson: Lesson) -> PlanItem:
    return _item(
        f"lesson:{lesson.id}", "lesson",
        f'Continue "{lesson.title}"',
        "You're partway through this lesson. Pick up where you left off.",
        lesson.href,
    )


def review_matches_item(count: int) -> PlanItem:
    noun = "strong match" if count == 1 else "strong matches"
    return _item(
        "review_matches", "review_matches",
        f"Review {count} {noun}",
        f"New roles scored {STRONG_MATCH_SCORE} or higher against your profile.",
        "/jobs",
    )


def focus_block_item() -> PlanItem:
    return _item(
        "focus_block", "focus_block",
        "Start a 50-minute focus session",
        "Nothing urgent today. Use the time to build a skill or polish a project.",
        "/focus?task=Focus%20block&ref=focus_block",
    )


FILLER_ITEMS: tuple[PlanItem, ...] = (
    _item("job_inbox", "job_inbox", "Skim your Job Inbox",
          "Shortlist anything worth a closer look, skip the rest.", "/jobs"),
    _item("profile", "profile", "Add one recent win to your profile",
          "Fresh results make every tailored resume stronger.", "/profile"),
)


def pick_next_step(s: Signals) -> PlanItem:
    interviews = upcoming_interviews(s)
    if interviews:
        return interview_prep_item(interviews[0], s.time_zone)
    follow_ups = due_follow_ups(s)
    if follow_ups:
        return follow_up_item(follow_ups[0])
    if s.lesson:
        return lesson_item(s.lesson)
    if s.strong_match_count > 0:
        return review_matches_item(s.strong_match_count)
    return focus_block_item()


def _rule_items(s: Signals) -> list[PlanItem]:
    items = [interview_prep_item(i, s.time_zone) for i in upcoming_interviews(s)]
    items += [follow_up_item(f) for f in due_follow_ups(s)]
    if s.lesson:
        items.append(lesson_item(s.lesson))
    if s.strong_match_count > 0:
        items.append(review_matches_item(s.strong_match_count))
    return items


def build_daily_plan(s: Signals) -> list[PlanItem]:
    """3-5 items: the next step first, always a focus block, fillers up to the minimum."""
    plan = _rule_items(s)[: MAX_PLAN_ITEMS - 1]
    plan.append(focus_block_item())
    for filler in FILLER_ITEMS:
        if len(plan) >= MIN_PLAN_ITEMS:
            break
        plan.append(dict(filler))
    return plan
