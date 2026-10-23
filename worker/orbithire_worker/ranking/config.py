"""Environment for ranking + digest (kept separate from the core worker Settings).

Env names match the Next.js app (.env.example) so one .env serves both.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class RankingConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # Same secrets the app uses to encrypt user API keys (lib/encryption.ts)
    encryption_key: str | None = None
    supabase_jwt_secret: str | None = None

    # Platform keys (fallback when the user has no own key)
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None

    # Models
    ranking_anthropic_model: str = "claude-haiku-5-5"
    ranking_openai_model: str = "gpt-4o-mini"
    ranking_groq_model: str = "llama-3.3-70b-versatile"
    embedding_model: str = "text-embedding-3-small"
    embedding_batch_size: int = 64
    embedding_max_chars: int = 6000
    llm_posting_max_chars: int = 6000

    # Platform-key policy for LLM scoring:
    #   quota  - use the platform key only while check_generation_quota() says the user can
    #            still generate (does not consume the quota); default
    #   always - always allow (single-user / self-hosted installs)
    #   never  - only users with their own key get LLM scores
    ranking_platform_llm: Literal["quota", "always", "never"] = "quota"
    # Hard cap on platform-key LLM calls per user per day (on top of the user's own limit)
    ranking_platform_daily_limit: int = 15

    # Email (same names as the app)
    resend_api_key: str | None = None
    follow_up_from_email: str | None = None
    digest_from_email: str | None = None
    resend_api_url: str = "https://api.resend.com/emails"
    app_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("APP_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"),
    )

    @property
    def digest_sender(self) -> str | None:
        return format_sender(self.digest_from_email or self.follow_up_from_email)


DEFAULT_SENDER_NAME = "NextMilestone"


def format_sender(value: str | None, name: str = DEFAULT_SENDER_NAME) -> str | None:
    """Give a bare address the brand display name: a@b.c -> 'NextMilestone <a@b.c>'.

    Values that already carry a display name ("Name <a@b.c>") are kept as they are.
    """
    address = (value or "").strip().strip('"').strip()
    if not address:
        return None
    if "<" in address:
        return address
    return f"{name} <{address}>"


@lru_cache
def get_ranking_config() -> RankingConfig:
    return RankingConfig()
