"""LLM + embedding clients used by rank_jobs, and the key/provider resolution.

Key policy (docs/PLAN.md §4.4 "user's own key when present, else platform key subject to
the existing generation quota"):

* The user's own key (``user_settings.ai_api_key_encrypted``, decrypted exactly like
  lib/encryption.ts) is used when present, with the user's provider:
  anthropic -> Anthropic Messages, openai -> OpenAI chat, groq/custom -> OpenAI-compatible
  chat at the provider's base URL. Gemini is not supported for scoring (falls back to platform).
* Otherwise the platform key (``ANTHROPIC_API_KEY``, else ``OPENAI_API_KEY``) is used if
  ``RANKING_PLATFORM_LLM`` allows it: ``quota`` (default) = only while
  ``check_generation_quota(user).can_generate`` is true. Ranking never *consumes* the
  resume-generation quota (2 free generations would be gone after one morning), it is only
  gated by it; platform calls are additionally capped by ``RANKING_PLATFORM_DAILY_LIMIT``.
* Embeddings always use OpenAI ``text-embedding-3-small``: the user's key when their provider
  is openai, else the platform ``OPENAI_API_KEY``. They are not quota-gated (≈$0.00002/posting).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from .ranking.config import RankingConfig
from .ranking.scoring import OUTPUT_SCHEMA
from .ranking.secrets import DecryptionError, decrypt_api_key

log = logging.getLogger(__name__)

Source = Literal["user", "platform"]

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


@dataclass(slots=True)
class ChatResult:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class Scorer(Protocol):
    provider: str
    model: str
    source: Source

    async def complete(self, system: str, user: str) -> ChatResult: ...


class Embedder(Protocol):
    model: str
    source: Source

    async def embed(self, texts: list[str]) -> list[list[float]]: ...


class LLMRefusal(RuntimeError):
    pass


# ------------------------------------------------------------------ implementations


@dataclass
class AnthropicScorer:
    api_key: str
    model: str
    source: Source
    provider: str = "anthropic"
    max_tokens: int = 1200
    _client: Any = field(default=None, repr=False)

    def _get(self) -> Any:
        if self._client is None:
            from anthropic import AsyncAnthropic

            self._client = AsyncAnthropic(api_key=self.api_key, max_retries=2, timeout=60)
        return self._client

    async def complete(self, system: str, user: str) -> ChatResult:
        resp = await self._get().messages.create(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA}},
        )
        if resp.stop_reason == "refusal":
            raise LLMRefusal("model declined to score this posting")
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        usage = resp.usage
        return ChatResult(text, resp.model, getattr(usage, "input_tokens", 0) or 0,
                          getattr(usage, "output_tokens", 0) or 0)


@dataclass
class OpenAIChatScorer:
    api_key: str
    model: str
    source: Source
    provider: str = "openai"
    base_url: str | None = None
    max_tokens: int = 1200
    _client: Any = field(default=None, repr=False)

    def _get(self) -> Any:
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url, max_retries=2, timeout=60)
        return self._client

    async def complete(self, system: str, user: str) -> ChatResult:
        resp = await self._get().chat.completions.create(
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        )
        choice = resp.choices[0]
        usage = resp.usage
        return ChatResult(choice.message.content or "", resp.model,
                          getattr(usage, "prompt_tokens", 0) or 0, getattr(usage, "completion_tokens", 0) or 0)


@dataclass
class OpenAIEmbedder:
    api_key: str
    model: str
    source: Source
    dimensions: int = 1536
    _client: Any = field(default=None, repr=False)

    def _get(self) -> Any:
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=self.api_key, max_retries=2, timeout=60)
        return self._client

    async def embed(self, texts: list[str]) -> list[list[float]]:
        resp = await self._get().embeddings.create(model=self.model, input=texts, dimensions=self.dimensions)
        data = sorted(resp.data, key=lambda d: d.index)
        return [list(d.embedding) for d in data]


# ------------------------------------------------------------------ resolution


@dataclass(slots=True)
class Clients:
    scorer: Scorer | None
    embedder: Embedder | None
    # Max LLM calls today allowed by the key policy (None = no extra cap)
    platform_cap: int | None = None
    note: str = ""


def _user_key(row: dict[str, Any] | None, cfg: RankingConfig) -> str | None:
    if not row or not row.get("ai_api_key_encrypted"):
        return None
    try:
        return decrypt_api_key(row["ai_api_key_encrypted"], encryption_key=cfg.encryption_key,
                               jwt_secret=cfg.supabase_jwt_secret) or None
    except DecryptionError as exc:
        log.warning("user API key could not be decrypted (%s); falling back to platform key", exc)
        return None


def _user_scorer(key: str | None, provider: str, base_url: str | None,
                 user_model: str | None, cfg: RankingConfig) -> Scorer | None:
    if key and provider == "anthropic":
        return AnthropicScorer(key, cfg.ranking_anthropic_model, "user")
    if key and provider == "openai":
        return OpenAIChatScorer(
            key, cfg.ranking_openai_model, "user", provider="openai", base_url=base_url)
    if key and provider == "groq":
        return OpenAIChatScorer(
            key, user_model or cfg.ranking_groq_model, "user", provider="groq",
            base_url=base_url or GROQ_BASE_URL)
    if key and provider == "custom" and base_url and user_model:
        return OpenAIChatScorer(
            key, user_model, "user", provider="custom", base_url=base_url)
    return None


def _platform_scorer(quota: dict[str, Any] | None,
                     cfg: RankingConfig) -> tuple[Scorer | None, str]:
    allowed = cfg.ranking_platform_llm == "always" or (
        cfg.ranking_platform_llm == "quota"
        and bool((quota or {}).get("can_generate", True))
    )
    if not allowed:
        reason = quota and quota.get("reason")
        return None, (
            "platform LLM disabled "
            f"(RANKING_PLATFORM_LLM={cfg.ranking_platform_llm}, quota={reason})"
        )
    if cfg.anthropic_api_key:
        return AnthropicScorer(
            cfg.anthropic_api_key, cfg.ranking_anthropic_model, "platform"), ""
    if cfg.openai_api_key:
        return OpenAIChatScorer(
            cfg.openai_api_key, cfg.ranking_openai_model, "platform"), ""
    return None, "no LLM key configured"


def _resolve_embedder(key: str | None, provider: str, base_url: str | None,
                      cfg: RankingConfig) -> Embedder | None:
    if key and provider == "openai" and not base_url:
        return OpenAIEmbedder(key, cfg.embedding_model, "user")
    if cfg.openai_api_key:
        return OpenAIEmbedder(cfg.openai_api_key, cfg.embedding_model, "platform")
    return None


def resolve_clients(user_settings: dict[str, Any] | None, quota: dict[str, Any] | None,
                    cfg: RankingConfig) -> Clients:
    settings = user_settings or {}
    provider = settings.get("ai_provider") or "groq"
    base_url = settings.get("ai_base_url") or None
    user_model = settings.get("ai_default_model") or None
    key = _user_key(user_settings, cfg)

    scorer = _user_scorer(key, provider, base_url, user_model, cfg)
    platform_cap: int | None = None
    note = ""
    if scorer is None:
        scorer, note = _platform_scorer(quota, cfg)
        platform_cap = cfg.ranking_platform_daily_limit if scorer else None

    embedder = _resolve_embedder(key, provider, base_url, cfg)
    return Clients(scorer, embedder, platform_cap, note)
