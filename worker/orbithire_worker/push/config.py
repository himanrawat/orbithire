"""VAPID settings for web push. Same env names as the Next.js app (.env.example).

Push is off (every send is a no-op) unless both VAPID_PRIVATE_KEY and a public key are set.
Generate a key pair with ``npx web-push generate-vapid-keys`` (or
``uv run vapid --gen`` from py-vapid, then ``vapid --applicationServerKey``).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SUBJECT = "mailto:info@himanshurawat.in"


class PushConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    vapid_public_key: str | None = Field(
        default=None, validation_alias=AliasChoices("VAPID_PUBLIC_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    )
    vapid_private_key: str | None = None
    vapid_subject: str = DEFAULT_SUBJECT
    # Seconds a push service may hold a message for an offline device.
    push_ttl_seconds: int = 4 * 3600
    push_concurrency: int = 8

    @property
    def enabled(self) -> bool:
        return bool(self.vapid_private_key and self.vapid_public_key)


@lru_cache
def get_push_config() -> PushConfig:
    return PushConfig()
