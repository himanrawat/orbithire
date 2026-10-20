"""Test helpers: posting/match inserts, fake embedder and scorer (no paid APIs)."""

from __future__ import annotations

import contextlib
import json
import math
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

import psycopg

from orbithire_worker.llm import ChatResult, Clients
from orbithire_worker.ranking.config import RankingConfig

KEYWORDS = ["react", "typescript", "frontend", "next.js", "design system", "java", "spring",
            "kubernetes", "sales", "accounting"]


async def add_posting(conn: psycopg.AsyncConnection, user_id: str, *, search_id: str | None = None,
                      status: str = "new", **fields: Any) -> tuple[str, str]:
    data = {
        "dedupe_key": f"test-{user_id}-{uuid.uuid4().hex}",
        "source": "linkedin",
        "title": "Frontend Engineer",
        "company": "Acme",
        "location": "Gurugram, India",
        "is_remote": False,
        "description": "Build React and TypeScript interfaces.",
        **fields,
    }
    cols = ", ".join(data)
    ph = ", ".join(["%s"] * len(data))
    cur = await conn.execute(f"INSERT INTO job_postings ({cols}) VALUES ({ph}) RETURNING id", list(data.values()))
    pid = str((await cur.fetchone())[0])
    cur = await conn.execute(
        "INSERT INTO job_matches (user_id, job_posting_id, search_id, status) VALUES (%s, %s, %s, %s) RETURNING id",
        (user_id, pid, search_id, status))
    mid = str((await cur.fetchone())[0])
    return pid, mid


async def cleanup_postings(conn: psycopg.AsyncConnection, user_id: str) -> None:
    await conn.execute("DELETE FROM job_postings WHERE dedupe_key LIKE %s", (f"test-{user_id}-%",))


def fake_vector(text: str) -> list[float]:
    t = text.lower()
    v = [0.0] * 1536
    for i, k in enumerate(KEYWORDS):
        v[i] = float(t.count(k))
    v[1535] = 0.1  # never all-zero
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v]


@dataclass
class FakeEmbedder:
    model: str = "text-embedding-3-small"
    source: str = "platform"
    calls: list[int] = field(default_factory=list)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(len(texts))
        return [fake_vector(t) for t in texts]


def good_json(score: int = 70, summary: str = "Solid frontend fit.") -> str:
    dim = {"score": score, "note": "ok"}
    return json.dumps({
        "score": score,
        "reasons": {d: dim for d in ("skills_fit", "seniority_fit", "compensation", "freshness",
                                     "location_eligibility")},
        "summary": summary,
        "red_flags": [],
    })


@dataclass
class FakeScorer:
    responses: list[str] = field(default_factory=list)   # consumed in order; then default
    default: str = field(default_factory=good_json)
    provider: str = "anthropic"
    model: str = "claude-haiku-5-5"
    source: str = "platform"
    prompts: list[str] = field(default_factory=list)

    @property
    def calls(self) -> int:
        return len(self.prompts)

    async def complete(self, system: str, user: str) -> ChatResult:
        self.prompts.append(user)
        text = self.responses.pop(0) if self.responses else self.default
        return ChatResult(text, self.model, 1000, 150)


def factory(scorer: Any, embedder: Any, platform_cap: int | None = None):
    def make(user_settings, quota, cfg):  # noqa: ANN001
        return Clients(scorer, embedder, platform_cap)
    return make


def cfg(**kw: Any) -> RankingConfig:
    base = dict(_env_file=None, openai_api_key=None, anthropic_api_key=None, resend_api_key="re_test",
                follow_up_from_email="OrbitHire <digest@orbithire.test>", app_url="https://app.orbithire.test")
    base.update(kw)
    return RankingConfig(**base)


@dataclass
class _Ctx:
    pool: Any
    extra: dict[str, Any]
    worker_id: str = "test"
    settings: Any = None


class _OneConnPool:
    def __init__(self, conn: psycopg.AsyncConnection) -> None:
        self.conn = conn

    @contextlib.asynccontextmanager
    async def connection(self) -> AsyncIterator[psycopg.AsyncConnection]:
        yield self.conn


def ctx_for(conn: psycopg.AsyncConnection, **extra: Any) -> _Ctx:
    return _Ctx(pool=_OneConnPool(conn), extra=extra)
