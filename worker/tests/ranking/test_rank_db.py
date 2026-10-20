"""rank_jobs against the real migrations (Supabase Postgres + pgvector)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from orbithire_worker.handlers.rank_jobs import rank_jobs
from orbithire_worker.ranking.pipeline import rank_user
from orbithire_worker.registry import Task

from .helpers import FakeEmbedder, FakeScorer, add_posting, cfg, cleanup_postings, ctx_for, factory, good_json


@pytest.fixture(autouse=True)
async def _cleanup(conn, user_id):
    yield
    await cleanup_postings(conn, user_id)


async def match(conn, mid):
    cur = await conn.execute(
        "SELECT prefilter_pass, deal_breakers, similarity, llm_score, llm_reasons FROM job_matches WHERE id = %s", (mid,))
    return await cur.fetchone()


async def test_prefilter_hides_deal_breakers_with_reason(conn, user_id):
    cur = await conn.execute(
        "INSERT INTO job_searches (user_id, keywords, exclude_keywords) VALUES (%s, %s, %s) RETURNING id",
        (user_id, ["frontend"], ["Intern"]))
    sid = str((await cur.fetchone())[0])
    _, ok = await add_posting(conn, user_id, search_id=sid, currency="INR", salary_min=1_500_000,
                              salary_max=2_000_000, salary_interval="yearly")
    _, low = await add_posting(conn, user_id, search_id=sid, currency="INR", salary_min=50_000,
                               salary_max=80_000, salary_interval="monthly")
    _, lang = await add_posting(conn, user_id, search_id=sid, description="Fluent German is mandatory.")
    _, intern = await add_posting(conn, user_id, search_id=sid, title="Frontend Intern")
    _, wl_intern = await add_posting(conn, user_id, title="UI Intern")  # watchlist match: union of excludes
    _, inactive = await add_posting(conn, user_id, is_active=False, title="Frontend Intern")

    stats = await rank_user(conn, user_id, cfg(), factory(None, None))
    assert stats["prefiltered"] == 5 and stats["prefilter_passed"] == 1 and stats["prefilter_failed"] == 4

    assert (await match(conn, ok))[0] is True
    m = await match(conn, low)
    assert m[0] is False and m[1][0]["code"] == "salary_below_min"
    assert "₹9.6 LPA is below your minimum ₹12.0 LPA" in m[1][0]["reason"]
    assert (await match(conn, lang))[1][0]["code"] == "language_required"
    assert (await match(conn, intern))[1][0]["code"] == "title_excluded"
    assert (await match(conn, wl_intern))[1][0]["code"] == "title_excluded"
    assert (await match(conn, inactive))[0] is None  # inactive postings are left alone

    # Rerun is a no-op for already pre-filtered rows
    again = await rank_user(conn, user_id, cfg(), factory(None, None))
    assert again["prefiltered"] == 0

    # Custom min salary from ranking_settings
    await conn.execute("UPDATE ranking_settings SET min_salary = 2500000 WHERE user_id = %s", (user_id,))
    _, mid = await add_posting(conn, user_id, currency="INR", salary_max=2_000_000, salary_interval="yearly")
    await rank_user(conn, user_id, cfg(), factory(None, None))
    assert (await match(conn, mid))[1][0]["code"] == "salary_below_min"


async def test_similarity_ordering_and_profile_hash(conn, user_id):
    emb = FakeEmbedder()
    _, best = await add_posting(conn, user_id, title="Frontend Engineer",
                                description="React TypeScript frontend design system Next.js")
    _, mid = await add_posting(conn, user_id, title="Web Developer", description="React")
    _, worst = await add_posting(conn, user_id, title="Backend Engineer", description="Java Spring Kubernetes")
    _, failed = await add_posting(conn, user_id, description="Fluent German required. React.")

    stats = await rank_user(conn, user_id, cfg(), factory(None, emb))
    assert stats["profile_embedded"] is True
    assert stats["postings_embedded"] == 3            # deal-breaker posting is not embedded
    assert emb.calls == [1, 3]                         # profile, then one batch
    sims = {k: (await match(conn, v))[2] for k, v in {"best": best, "mid": mid, "worst": worst}.items()}
    assert sims["best"] > sims["mid"] > sims["worst"]
    assert (await match(conn, failed))[2] is None

    # Unchanged profile -> no re-embedding; postings already embedded -> no calls at all
    emb.calls.clear()
    stats = await rank_user(conn, user_id, cfg(), factory(None, emb))
    assert emb.calls == [] and stats["profile_embedded"] is False

    # Changed profile -> re-embed profile only, similarities recomputed for all matches
    await conn.execute("UPDATE profiles SET skills = %s WHERE id = %s", (["Java", "Spring", "Kubernetes"], user_id))
    stats = await rank_user(conn, user_id, cfg(), factory(None, emb))
    assert emb.calls == [1] and stats["similarity_updated"] == 3
    assert (await match(conn, worst))[2] > (await match(conn, mid))[2]

    # Batching
    for i in range(5):
        await add_posting(conn, user_id, description=f"React role {i}")
    emb.calls.clear()
    await rank_user(conn, user_id, cfg(embedding_batch_size=2), factory(None, emb))
    assert emb.calls == [2, 2, 1]


async def test_llm_daily_limit_never_exceeded(conn, user_id):
    emb = FakeEmbedder()
    mids = []
    for i in range(20):
        _, mid = await add_posting(conn, user_id, title=f"Frontend Engineer {i}",
                                   description="React " * (i + 1) + "TypeScript")
        mids.append(mid)
    scorer = FakeScorer()
    stats = await rank_user(conn, user_id, cfg(), factory(scorer, emb, platform_cap=15))
    assert scorer.calls == 15 and stats["llm_calls"] == 15 and stats["llm_scored"] == 15

    cur = await conn.execute(
        "SELECT llm_calls, input_tokens, output_tokens FROM ranking_usage WHERE user_id = %s", (user_id,))
    assert await cur.fetchone() == (15, 15_000, 2_250)

    # Highest-similarity matches were the ones scored
    cur = await conn.execute(
        "SELECT llm_score IS NOT NULL FROM job_matches WHERE user_id = %s ORDER BY similarity DESC", (user_id,))
    flags = [r[0] for r in await cur.fetchall()]
    assert flags == [True] * 15 + [False] * 5

    # Rerun the same day through the real handler: 0 calls
    scorer2 = FakeScorer()
    task = Task(id=None, type="rank_jobs", payload={"user_id": user_id}, status="running", priority=0,
                attempts=1, max_attempts=3)
    ctx = ctx_for(conn, ranking_config=cfg(), ranking_clients_factory=factory(scorer2, emb, platform_cap=15))
    result = await rank_jobs(task, ctx)
    assert scorer2.calls == 0 and result["llm_calls"] == 0 and result["llm_used_before"] == 15

    # Raising the user's limit still respects the platform cap
    await conn.execute("UPDATE ranking_settings SET daily_llm_limit = 50 WHERE user_id = %s", (user_id,))
    await rank_user(conn, user_id, cfg(), factory(scorer2, emb, platform_cap=15))
    assert scorer2.calls == 0
    # ...but an own key (no platform cap) may use the higher limit
    await rank_user(conn, user_id, cfg(), factory(scorer2, emb, platform_cap=None))
    assert scorer2.calls == 5

    # Next day the budget resets (simulate by moving today's counter to yesterday)
    await conn.execute("UPDATE ranking_usage SET day = day - 1 WHERE user_id = %s", (user_id,))
    await conn.execute("UPDATE ranking_settings SET daily_llm_limit = 3 WHERE user_id = %s", (user_id,))
    for i in range(5):
        await add_posting(conn, user_id, description=f"React {i}")
    scorer3 = FakeScorer()
    await rank_user(conn, user_id, cfg(), factory(scorer3, emb))
    assert scorer3.calls == 3


async def test_limit_zero_and_reservation_function(conn, user_id):
    await conn.execute("INSERT INTO ranking_settings (user_id, daily_llm_limit) VALUES (%s, 0)", (user_id,))
    await add_posting(conn, user_id)
    scorer = FakeScorer()
    await rank_user(conn, user_id, cfg(), factory(scorer, None))
    assert scorer.calls == 0
    # Direct check of the atomic reservation
    granted = []
    for _ in range(4):
        cur = await conn.execute("SELECT ranking_reserve_llm_call(%s, current_date + 10, 3)", (user_id,))
        granted.append((await cur.fetchone())[0])
    assert granted == [True, True, True, False]


async def test_bad_llm_output_recorded_and_retried_once(conn, user_id):
    _, good = await add_posting(conn, user_id, description="React TypeScript frontend design system")
    _, bad = await add_posting(conn, user_id, description="Java")
    # similarity unknown (no embedder) -> order by posted_at; make `good` newest
    now = datetime.now(timezone.utc)
    await conn.execute("UPDATE job_postings p SET posted_at = %s FROM job_matches m WHERE m.job_posting_id = p.id AND m.id = %s", (now, good))
    await conn.execute("UPDATE job_postings p SET posted_at = %s FROM job_matches m WHERE m.job_posting_id = p.id AND m.id = %s", (now - timedelta(days=2), bad))

    repaired = "Here you go:\n```json\n" + good_json(77)[:-1] + ",}\n```"
    scorer = FakeScorer(responses=[repaired, "Sorry, I can't help with that."])
    stats = await rank_user(conn, user_id, cfg(), factory(scorer, None))
    assert stats["llm_calls"] == 2 and stats["llm_scored"] == 1 and stats["llm_errors"] == 1

    g = await match(conn, good)
    assert g[3] == 77 and g[4]["reasons"]["skills_fit"]["score"] == 77
    assert g[4]["model"] == "claude-haiku-5-5" and g[4]["key_source"] == "platform"
    b = await match(conn, bad)
    assert b[3] is None and b[4]["attempts"] == 1 and "no JSON" in b[4]["error"]

    # Retried once on the next run, then given up on
    scorer2 = FakeScorer(responses=["still not json"])
    await rank_user(conn, user_id, cfg(), factory(scorer2, None))
    assert scorer2.calls == 1 and (await match(conn, bad))[4]["attempts"] == 2
    scorer3 = FakeScorer()
    await rank_user(conn, user_id, cfg(), factory(scorer3, None))
    assert scorer3.calls == 0


async def test_only_new_active_matches_are_scored(conn, user_id):
    await add_posting(conn, user_id, status="skipped")
    await add_posting(conn, user_id, status="shortlisted")
    _, mid = await add_posting(conn, user_id)
    scorer = FakeScorer()
    await rank_user(conn, user_id, cfg(), factory(scorer, None))
    assert scorer.calls == 1 and (await match(conn, mid))[3] == 70
    assert "Frontend Engineer" in scorer.prompts[0] and "<posting>" in scorer.prompts[0]
    assert "₹12.0 LPA" in scorer.prompts[0]
