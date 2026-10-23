"""Importing this package registers every built-in handler in the default registry.

Add new handler modules to ``_MODULES``; a module that fails to import (e.g.
a later phase's optional dependency is missing) is logged and skipped so the
rest of the worker still runs.
"""

from __future__ import annotations

import importlib
import logging

log = logging.getLogger(__name__)

_MODULES = [
    "noop",
    "fetch_jobs",
    "fetch_watchlist",
    "rank_jobs",
    "digest",
    "render_pdf",
    "daily_plan",
]


def load_all() -> None:
    for name in _MODULES:
        try:
            importlib.import_module(f"{__name__}.{name}")
        except Exception:  # noqa: BLE001
            log.exception("could not load handler module %s", name)
