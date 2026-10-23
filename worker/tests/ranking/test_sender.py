"""Email sender display name (FOLLOW_UP_FROM_EMAIL / DIGEST_FROM_EMAIL)."""

from __future__ import annotations

from orbithire_worker.ranking.config import RankingConfig, format_sender


def test_bare_address_gets_brand_name() -> None:
    assert format_sender("hello@himanshurawat.in") == "NextMilestone <hello@himanshurawat.in>"


def test_named_sender_is_kept() -> None:
    assert format_sender("Team <a@b.co>") == "Team <a@b.co>"


def test_quoted_env_value_is_unwrapped() -> None:
    assert format_sender('"NextMilestone <a@b.co>"') == "NextMilestone <a@b.co>"


def test_empty_is_none() -> None:
    assert format_sender("  ") is None
    assert format_sender(None) is None


def test_digest_sender_prefers_digest_address() -> None:
    cfg = RankingConfig(follow_up_from_email="f@b.co", digest_from_email="d@b.co")
    assert cfg.digest_sender == "NextMilestone <d@b.co>"
