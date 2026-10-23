"""Worker configuration, read from the environment (and an optional .env file).

Env names for shared services match the Next.js app (see lib/r2Config.ts and
.env.example) so one .env can serve both.
"""

from __future__ import annotations

import os
import socket
from functools import lru_cache
from typing import Annotated, Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Defaults from docs/PLAN.md §4.1: 2 render + 1 fetch slot, render 30 s, fetch 5 min.
DEFAULT_CONCURRENCY: dict[str, int] = {
    "render_pdf": 2,
    "fetch_jobs": 1,
    "fetch_watchlist": 1,
    "rank_jobs": 1,
    "thumbnail": 1,
    "digest": 1,
    "generate_daily_plan": 1,
    "noop": 2,
}
DEFAULT_TIMEOUTS: dict[str, float] = {
    "render_pdf": 30,
    "fetch_jobs": 300,
    "fetch_watchlist": 600,
    "rank_jobs": 300,
    "thumbnail": 30,
    "digest": 120,
    "generate_daily_plan": 60,
    "noop": 30,
}


def _parse_map(value: Any, cast: type) -> Any:
    """Accept a dict, JSON, or 'type=n,type=n' / 'type:n,type:n' string."""
    if value is None or isinstance(value, dict):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return {}
        if text.startswith("{"):
            import json

            return {k: cast(v) for k, v in json.loads(text).items()}
        out: dict[str, Any] = {}
        for part in text.split(","):
            if not part.strip():
                continue
            sep = "=" if "=" in part else ":"
            key, _, raw = part.partition(sep)
            out[key.strip()] = cast(raw.strip())
        return out
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Database -----------------------------------------------------------
    # Direct (session-mode) Postgres connection; LISTEN/NOTIFY does not work
    # through a transaction-mode pooler.
    database_url: str = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

    # --- Cloudflare R2 (same names as lib/r2Config.ts) -----------------------
    r2_endpoint: str | None = None
    r2_account_id: str | None = None
    r2_bucket: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_public_base_url: str | None = None

    # --- AI / email (used by later phases) ----------------------------------
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    resend_api_key: str | None = None

    # --- Worker behaviour ---------------------------------------------------
    worker_id: str = Field(default_factory=lambda: f"{socket.gethostname()}:{os.getpid()}")
    worker_poll_interval: float = 10.0
    worker_concurrency: Annotated[dict[str, int], NoDecode] = Field(default_factory=lambda: dict(DEFAULT_CONCURRENCY))
    worker_timeouts: Annotated[dict[str, float], NoDecode] = Field(default_factory=lambda: dict(DEFAULT_TIMEOUTS))
    worker_default_timeout: float = 60.0
    worker_default_concurrency: int = 1
    # Exponential backoff: base * 2**(attempt-1), capped.
    worker_backoff_base: float = 30.0
    worker_backoff_max: float = 3600.0
    # How long to wait for in-flight tasks after SIGTERM before cancelling them.
    worker_shutdown_grace: float = 30.0
    # How often to look for stale `running` tasks (locked_at older than timeout*2).
    worker_reclaim_interval: float = 60.0
    worker_db_pool_size: int = 5

    # --- Internal HTTP --------------------------------------------------------
    worker_http_enabled: bool = True
    worker_http_host: str = "127.0.0.1"
    worker_http_port: int = 8787

    @field_validator("worker_concurrency", mode="before")
    @classmethod
    def _concurrency(cls, v: Any) -> Any:
        parsed = _parse_map(v, int)
        if isinstance(parsed, dict):
            return {**DEFAULT_CONCURRENCY, **parsed}
        return parsed

    @field_validator("worker_timeouts", mode="before")
    @classmethod
    def _timeouts(cls, v: Any) -> Any:
        parsed = _parse_map(v, float)
        if isinstance(parsed, dict):
            return {**DEFAULT_TIMEOUTS, **parsed}
        return parsed

    def concurrency_for(self, task_type: str) -> int:
        return int(self.worker_concurrency.get(task_type, self.worker_default_concurrency))

    def timeout_for(self, task_type: str) -> float:
        return float(self.worker_timeouts.get(task_type, self.worker_default_timeout))

    def backoff_for(self, attempts: int) -> float:
        return min(self.worker_backoff_base * (2 ** max(attempts - 1, 0)), self.worker_backoff_max)

    @property
    def r2_resolved_endpoint(self) -> str | None:
        if self.r2_endpoint:
            return self.r2_endpoint
        if self.r2_account_id:
            return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
