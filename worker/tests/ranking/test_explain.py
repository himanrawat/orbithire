"""Score explanation: what helped / what's missing."""

from __future__ import annotations

from orbithire_worker.ranking.scoring import explain, parse_score


def _result(**scores: int):
    dims = {"skills_fit": 85, "seniority_fit": 72, "compensation": 45, "freshness": 60,
            "location_eligibility": 30, **scores}
    reasons = ",".join(f'"{k}": {{"score": {v}, "note": "{k} note"}}' for k, v in dims.items())
    return parse_score(f'{{"score": 61, "reasons": {{{reasons}}}, "summary": "", "red_flags": ["Contract only"]}}')


def test_strong_dimensions_helped_weak_ones_missing():
    out = explain(_result())
    assert out["helped"] == ["Skills fit: skills_fit note", "Seniority fit: seniority_fit note"]
    assert out["missing"] == [
        "Compensation: compensation note",
        "Location and eligibility: location_eligibility note",
        "Red flag: Contract only",
    ]


def test_middle_scores_are_neither():
    out = explain(_result(skills_fit=60, seniority_fit=55, compensation=55, location_eligibility=65))
    assert out["helped"] == []
    assert out["missing"] == ["Red flag: Contract only"]
