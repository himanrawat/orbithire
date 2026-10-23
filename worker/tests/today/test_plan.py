"""Daily plan rules (mirror of tests/todayNextStep.test.ts)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from orbithire_worker.today.plan import (
    MAX_PLAN_ITEMS,
    MIN_PLAN_ITEMS,
    FollowUp,
    Interview,
    Lesson,
    Signals,
    build_daily_plan,
    local_date,
    pick_next_step,
    safe_zone,
)

# 2026-10-23 14:00 UTC = 10:00 AM in New York.
NOW = datetime(2026, 10, 23, 14, 0, tzinfo=timezone.utc)
TZ = "America/New_York"


def interview(hours: float, cid: str = "c1") -> Interview:
    return Interview(cid, "Acme", NOW + timedelta(hours=hours))


def follow_up(at: datetime, fid: str = "f1") -> FollowUp:
    return FollowUp(fid, "c2", "Globex", at)


LESSON = Lesson("l1", "Big-O basics", "/learn/lessons/l1")


def signals(**kw) -> Signals:
    return Signals(now=NOW, time_zone=TZ, **kw)


def test_interview_within_three_days_wins() -> None:
    s = signals(interviews=(interview(48),), follow_ups=(follow_up(NOW),), lesson=LESSON, strong_match_count=3)
    step = pick_next_step(s)
    assert step["kind"] == "interview_prep"
    assert step["href"] == "/companies/c1"
    assert "Acme" in step["title"]


def test_interview_outside_window_or_past_is_ignored() -> None:
    s = signals(interviews=(interview(80), interview(-1, "c0")))
    assert pick_next_step(s)["kind"] == "focus_block"


def test_follow_up_due_today_or_overdue() -> None:
    assert pick_next_step(signals(follow_ups=(follow_up(NOW - timedelta(days=1)),)))["kind"] == "follow_up"
    # 11 PM New York today is still "today".
    late_today = datetime(2026, 10, 24, 3, 0, tzinfo=timezone.utc)
    assert pick_next_step(signals(follow_ups=(follow_up(late_today),)))["kind"] == "follow_up"


def test_follow_up_due_tomorrow_local_is_not_today() -> None:
    tomorrow = datetime(2026, 10, 24, 5, 0, tzinfo=timezone.utc)  # 1 AM New York on the 24th
    assert pick_next_step(signals(follow_ups=(follow_up(tomorrow),)))["kind"] == "focus_block"


def test_lesson_then_matches_then_focus() -> None:
    assert pick_next_step(signals(lesson=LESSON, strong_match_count=2))["kind"] == "lesson"
    step = pick_next_step(signals(strong_match_count=2))
    assert step["kind"] == "review_matches"
    assert step["title"] == "Review 2 strong matches"
    assert pick_next_step(signals(strong_match_count=1))["title"] == "Review 1 strong match"
    assert pick_next_step(signals())["kind"] == "focus_block"


def test_plan_size_and_order() -> None:
    empty = build_daily_plan(signals())
    assert len(empty) == MIN_PLAN_ITEMS
    assert [i["kind"] for i in empty] == ["focus_block", "job_inbox", "profile"]

    busy = build_daily_plan(signals(
        interviews=(interview(5, "a"), interview(30, "b")),
        follow_ups=(follow_up(NOW, "x"), follow_up(NOW, "y")),
        lesson=LESSON, strong_match_count=4))
    assert len(busy) == MAX_PLAN_ITEMS
    assert busy[0] == pick_next_step(signals(interviews=(interview(5, "a"),)))
    assert busy[-1]["kind"] == "focus_block"
    assert len({i["id"] for i in busy}) == len(busy)
    assert all(i["done"] is False for i in busy)


def test_plan_items_have_the_stored_shape() -> None:
    for item in build_daily_plan(signals(strong_match_count=1)):
        assert set(item) == {"id", "kind", "title", "reason", "href", "done"}


def test_time_zone_helpers() -> None:
    assert safe_zone("Not/AZone").key == TZ
    assert safe_zone(None).key == TZ
    assert local_date(datetime(2026, 10, 24, 3, 0, tzinfo=timezone.utc), TZ) == "2026-10-23"
    assert local_date(datetime(2026, 10, 24, 3, 0, tzinfo=timezone.utc), "UTC") == "2026-10-24"
