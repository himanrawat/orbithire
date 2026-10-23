import json
import sys
from pathlib import Path

import pytest

WORKER_DIR = Path(__file__).resolve().parents[2]
if str(WORKER_DIR) not in sys.path:  # allow running without an installed package
    sys.path.insert(0, str(WORKER_DIR))

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _legacy_sources_enabled(monkeypatch):
    """Adapter tests exercise every source; the production gates (off by default)
    are covered explicitly in test_source_registry.py."""
    monkeypatch.setenv("ENABLE_TOS_RESTRICTED_SOURCES", "true")
    monkeypatch.setenv("ENABLE_INDIA_SOURCES", "true")


def load_fixture(name: str):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    from orbithire_worker.fetchers import http

    async def _instant(_s: float) -> None:
        return None

    monkeypatch.setattr(http, "_sleep", _instant)

    from orbithire_worker.fetchers.sources import _scraper

    monkeypatch.setattr(_scraper, "_sleep", _instant)
