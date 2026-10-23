"""rank_jobs pipeline for one user: pre-filter -> embeddings/similarity -> LLM top-N.

Idempotent: each stage only touches rows that still need it (prefilter_pass IS NULL,
embedding IS NULL / similarity IS NULL, llm_score IS NULL), and LLM calls are reserved
atomically in ranking_usage before they are made, so reruns on the same day never exceed
the daily limit.
"""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..llm import Clients, resolve_clients
from . import prefilter, scoring, texts
from .config import RankingConfig

log = logging.getLogger(__name__)

MAX_LLM_ATTEMPTS = 2           # per match, across runs, when the output can't be parsed
MAX_POSTINGS_EMBED_PER_RUN = 500

ClientsFactory = Callable[[dict[str, Any] | None, dict[str, Any] | None, RankingConfig], Clients]


@dataclass
class RankStats:
    prefiltered: int = 0
    prefilter_passed: int = 0
    prefilter_failed: int = 0
    profile_embedded: bool = False
    postings_embedded: int = 0
    embedding_calls: int = 0
    similarity_updated: int = 0
    llm_budget: int = 0
    llm_used_before: int = 0
    llm_calls: int = 0
    llm_scored: int = 0
    llm_errors: int = 0
    scorer: str | None = None
    notes: list[str] = field(default_factory=list)


async def _one(conn: AsyncConnection, sql: str, params: Any = None) -> dict[str, Any] | None:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchone()


async def _all(conn: AsyncConnection, sql: str, params: Any = None) -> list[dict[str, Any]]:
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, params)
        return await cur.fetchall()


async def load_settings(conn: AsyncConnection, user_id: UUID | str) -> dict[str, Any]:
    await conn.execute(
        "INSERT INTO ranking_settings (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING", (user_id,))
    row = await _one(conn, "SELECT *, (now() AT TIME ZONE timezone)::date AS local_day "
                           "FROM ranking_settings WHERE user_id = %s", (user_id,))
    assert row is not None
    return row


# ------------------------------------------------------------------ stage 1: pre-filter


async def run_prefilter(conn: AsyncConnection, user_id: UUID | str, settings: dict[str, Any],
                        stats: RankStats) -> None:
    rows = await _all(conn, """
        SELECT m.id AS match_id, m.search_id, to_jsonb(js.*) AS search,
               p.title, p.company, p.location, p.is_remote, p.salary_min, p.salary_max,
               p.currency, p.salary_interval, p.description
          FROM job_matches m
          JOIN job_postings p ON p.id = m.job_posting_id
          LEFT JOIN job_searches js ON js.id = m.search_id
         WHERE m.user_id = %s AND m.prefilter_pass IS NULL AND p.is_active
    """, (user_id,))
    if not rows:
        return
    # Watchlist matches (no search) get the union of the user's exclude keywords.
    all_excludes: list[str] = []
    for r in await _all(conn, "SELECT exclude_keywords FROM job_searches WHERE user_id = %s AND enabled", (user_id,)):
        all_excludes.extend(r["exclude_keywords"] or [])

    updates = []
    for r in rows:
        rules = prefilter.Rules.from_rows(settings, r["search"],
                                          extra_excludes=() if r["search"] else all_excludes)
        breakers = prefilter.evaluate(r, rules)
        passed = not breakers
        stats.prefiltered += 1
        stats.prefilter_passed += passed
        stats.prefilter_failed += not passed
        updates.append((passed, Jsonb(breakers) if breakers else None, r["match_id"]))
    async with conn.cursor() as cur:
        await cur.executemany(
            "UPDATE job_matches SET prefilter_pass = %s, deal_breakers = %s "
            "WHERE id = %s AND prefilter_pass IS NULL", updates)


# ------------------------------------------------------------------ stage 2: similarity


async def _bump_usage(conn: AsyncConnection, user_id: UUID | str, day: Any, **cols: int) -> None:
    if not any(cols.values()):
        return
    sets = ", ".join(f"{c} = ranking_usage.{c} + EXCLUDED.{c}" for c in cols)
    names = ", ".join(cols)
    ph = ", ".join(["%s"] * len(cols))
    await conn.execute(
        f"INSERT INTO ranking_usage (user_id, day, {names}) VALUES (%s, %s, {ph}) "
        f"ON CONFLICT (user_id, day) DO UPDATE SET {sets}",
        (user_id, day, *cols.values()),
    )


async def run_similarity(conn: AsyncConnection, user_id: UUID | str, settings: dict[str, Any],
                         clients: Clients, cfg: RankingConfig, stats: RankStats) -> None:
    emb = clients.embedder
    if emb is None:
        stats.notes.append("no embedding key; similarity skipped")
        return
    day = settings["local_day"]

    profile = await _one(conn, "SELECT * FROM profiles WHERE id = %s", (user_id,)) or {}
    resume = await _one(conn, """
        SELECT title, content_json, content_text FROM resumes
         WHERE user_id = %s ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1
    """, (user_id,))
    ptext = texts.profile_text(profile, resume)
    recompute_all = False
    if ptext:
        h = texts.text_hash(emb.model, ptext)
        current = await _one(conn, "SELECT text_hash FROM user_profile_embeddings WHERE user_id = %s", (user_id,))
        if not current or current["text_hash"] != h:
            [vec] = await emb.embed([ptext])
            stats.embedding_calls += 1
            await _bump_usage(conn, user_id, day, embedding_calls=1, embedding_inputs=1)
            await conn.execute("""
                INSERT INTO user_profile_embeddings (user_id, embedding, text_hash, model)
                VALUES (%s, %s::extensions.vector, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                   SET embedding = EXCLUDED.embedding, text_hash = EXCLUDED.text_hash, model = EXCLUDED.model
            """, (user_id, texts.vector_literal(vec), h, emb.model))
            stats.profile_embedded = True
            recompute_all = current is not None
    else:
        stats.notes.append("profile is empty; similarity skipped")
        return

    postings = await _all(conn, """
        SELECT DISTINCT p.id, p.title, p.company, p.location, p.is_remote, p.description
          FROM job_matches m JOIN job_postings p ON p.id = m.job_posting_id
         WHERE m.user_id = %s AND m.prefilter_pass AND p.is_active AND p.embedding IS NULL
         LIMIT %s
    """, (user_id, MAX_POSTINGS_EMBED_PER_RUN))
    bs = max(1, cfg.embedding_batch_size)
    for i in range(0, len(postings), bs):
        batch = postings[i : i + bs]
        vecs = await emb.embed([texts.posting_text(p, cfg.embedding_max_chars) for p in batch])
        stats.embedding_calls += 1
        await _bump_usage(conn, user_id, day, embedding_calls=1, embedding_inputs=len(batch))
        async with conn.cursor() as cur:
            await cur.executemany(
                "UPDATE job_postings SET embedding = %s::extensions.vector WHERE id = %s AND embedding IS NULL",
                [(texts.vector_literal(v), p["id"]) for p, v in zip(batch, vecs, strict=True)])
        stats.postings_embedded += len(batch)

    row = await _one(conn, "SELECT ranking_refresh_similarity(%s, %s) AS n", (user_id, not recompute_all))
    stats.similarity_updated = int(row["n"]) if row else 0


# ------------------------------------------------------------------ stage 3: LLM score


def _preferences(settings: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    cur = settings.get("min_salary_currency") or "INR"
    ms = float(settings.get("min_salary") or 0)
    return {
        "Minimum compensation": prefilter.format_amount(ms, cur) if ms else None,
        "Home country": settings.get("home_country"),
        "Currently based in": profile.get("location"),
        "Preferred locations": ", ".join(profile.get("preferred_locations") or []),
        "Work type": profile.get("work_type"),
        "Languages spoken": ", ".join(settings.get("known_languages") or []),
        "Needs visa sponsorship to work abroad": settings.get("needs_visa_sponsorship_abroad"),
    }


def describe_llm_error(exc: Exception) -> str:
    """Short, user-facing reason for a failed scoring call (shown on the job page)."""
    status = getattr(exc, "status_code", None)
    if status in (401, 403):
        return f"the AI provider rejected the API key (HTTP {status}). Check Settings → AI Provider."
    if status == 429:
        return "the AI provider's rate limit or quota was reached (HTTP 429). It is retried on the next run."
    return str(exc)[:300]


async def run_llm(conn: AsyncConnection, user_id: UUID | str, settings: dict[str, Any],
                  clients: Clients, cfg: RankingConfig, stats: RankStats) -> None:
    scorer = clients.scorer
    if scorer is None:
        stats.notes.append(clients.note or "no LLM scorer")
        return
    stats.scorer = f"{scorer.provider}:{scorer.model} ({scorer.source})"
    day = settings["local_day"]
    limit = int(settings.get("daily_llm_limit") or 0)
    if clients.platform_cap is not None:
        limit = min(limit, clients.platform_cap)
    stats.llm_budget = limit
    used = await _one(conn, "SELECT llm_calls FROM ranking_usage WHERE user_id = %s AND day = %s", (user_id, day))
    stats.llm_used_before = int(used["llm_calls"]) if used else 0
    remaining = limit - stats.llm_used_before
    if remaining <= 0:
        return

    candidates = await _all(conn, """
        SELECT m.id AS match_id, m.llm_reasons, p.title, p.company, p.location, p.is_remote,
               p.salary_min, p.salary_max, p.currency, p.salary_interval, p.description,
               p.posted_at, p.source
          FROM job_matches m JOIN job_postings p ON p.id = m.job_posting_id
         WHERE m.user_id = %s AND m.prefilter_pass AND m.llm_score IS NULL
           AND m.status = 'new' AND p.is_active
           AND (m.llm_reasons IS NULL OR COALESCE((m.llm_reasons->>'attempts')::int, 0) < %s)
         ORDER BY m.similarity DESC NULLS LAST, p.posted_at DESC NULLS LAST, m.created_at DESC
         LIMIT %s
    """, (user_id, MAX_LLM_ATTEMPTS, remaining))
    if not candidates:
        return

    profile = await _one(conn, "SELECT * FROM profiles WHERE id = %s", (user_id,)) or {}
    resume = await _one(conn, """
        SELECT title, content_json, content_text FROM resumes
         WHERE user_id = %s ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1
    """, (user_id,))
    ptext = texts.profile_text(profile, resume)
    prefs = _preferences(settings, profile)
    today = settings["local_day"]

    for c in candidates:
        ok = await _one(conn, "SELECT ranking_reserve_llm_call(%s, %s, %s) AS ok", (user_id, day, limit))
        if not ok or not ok["ok"]:
            break
        stats.llm_calls += 1
        prompt = scoring.build_user_prompt(
            profile_text=ptext, preferences=prefs, posting=c,
            posting_text=texts.posting_text(c, cfg.llm_posting_max_chars), today=today)
        prev_attempts = int((c.get("llm_reasons") or {}).get("attempts") or 0)
        try:
            res = await scorer.complete(scoring.SYSTEM_PROMPT, prompt)
            await _bump_usage(conn, user_id, day, input_tokens=res.input_tokens, output_tokens=res.output_tokens)
            parsed = scoring.parse_score(res.text)
        except Exception as exc:  # noqa: BLE001 - one bad posting must not stop the batch
            stats.llm_errors += 1
            log.warning("LLM scoring failed for match %s: %s", c["match_id"], exc)
            await conn.execute(
                "UPDATE job_matches SET llm_reasons = %s WHERE id = %s",
                (Jsonb({"error": describe_llm_error(exc), "attempts": prev_attempts + 1,
                        "provider": scorer.provider, "model": scorer.model}), c["match_id"]))
            continue
        reasons = {
            **parsed.model_dump(),
            "explanation": scoring.explain(parsed),
            "provider": scorer.provider,
            "model": res.model or scorer.model,
            "key_source": scorer.source,
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }
        await conn.execute(
            "UPDATE job_matches SET llm_score = %s, llm_reasons = %s WHERE id = %s",
            (parsed.score, Jsonb(reasons), c["match_id"]))
        stats.llm_scored += 1


# ------------------------------------------------------------------ entry point


async def rank_user(conn: AsyncConnection, user_id: UUID | str, cfg: RankingConfig,
                    clients_factory: ClientsFactory = resolve_clients) -> dict[str, Any]:
    stats = RankStats()
    lock = await _one(conn, "SELECT pg_try_advisory_lock(hashtext('rank_jobs:' || %s::text)) AS ok", (str(user_id),))
    if not lock or not lock["ok"]:
        return {"skipped": "rank_jobs already running for this user"}
    try:
        settings = await load_settings(conn, user_id)
        user_settings = await _one(conn, "SELECT * FROM user_settings WHERE user_id = %s", (user_id,))
        quota_row = await _one(conn, "SELECT check_generation_quota_server(%s) AS q", (user_id,))
        quota = quota_row["q"] if quota_row else None
        clients = clients_factory(user_settings, quota, cfg)

        await run_prefilter(conn, user_id, settings, stats)
        try:
            await run_similarity(conn, user_id, settings, clients, cfg, stats)
        except Exception as exc:  # noqa: BLE001 - similarity is an optimisation; keep ranking
            log.warning("similarity stage failed for %s: %s", user_id, exc)
            stats.notes.append(f"similarity failed: {str(exc)[:200]}")
        await run_llm(conn, user_id, settings, clients, cfg, stats)
    finally:
        await conn.execute("SELECT pg_advisory_unlock(hashtext('rank_jobs:' || %s::text))", (str(user_id),))
    return asdict(stats)
