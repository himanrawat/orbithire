"""Shared US watchlist seed: data quality and migration sync."""

from collections import Counter
from pathlib import Path

import pytest

from orbithire_worker.watchlist_seed import (
    WatchlistDataError,
    load_entries,
    render_seed_sql,
)

SEED_MIGRATION = (
    Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "20261024000201_us_watchlist_seed.sql"
)


def test_at_least_500_us_boards_with_priority_tiers():
    entries = load_entries()
    assert len(entries) >= 500
    assert all(e.country == "US" for e in entries)
    tiers = Counter(e.priority for e in entries)
    assert tiers[1] >= 50 and tiers[2] >= 300
    assert len({e.name.lower() for e in entries}) == len(entries)
    assert {e.ats for e in entries} >= {"greenhouse", "ashby", "lever", "smartrecruiters"}


def test_seed_migration_is_generated_from_the_csv():
    assert SEED_MIGRATION.read_text(encoding="utf-8") == render_seed_sql(load_entries())


def test_sql_quotes_names():
    from orbithire_worker.watchlist_seed import WatchlistEntry

    sql = render_seed_sql([WatchlistEntry(name="Domino's", ats="greenhouse", board_token="dominos")])
    assert "('Domino''s', 'greenhouse', 'dominos', 'US', 2, 'public_employer_ats_feed')" in sql


@pytest.mark.parametrize(
    "line",
    [
        "Acme,notanats,acme,US,2,x",
        "Acme,greenhouse,bad token!,US,2,x",
        "Acme,greenhouse,acme,USA,2,x",
        "Acme,greenhouse,acme,US,3,x",
    ],
)
def test_invalid_rows_rejected(tmp_path, line):
    f = tmp_path / "w.csv"
    f.write_text("name,ats,board_token,country,priority,legal_basis\n" + line + "\n")
    with pytest.raises(WatchlistDataError):
        load_entries(f)


def test_duplicate_boards_rejected(tmp_path):
    f = tmp_path / "w.csv"
    f.write_text("name,ats,board_token,country,priority,legal_basis\n"
                 "A,greenhouse,acme,US,2,x\nB,greenhouse,ACME,US,1,x\n")
    with pytest.raises(WatchlistDataError):
        load_entries(f)
