"""Morning digest: selection, Resend payload (mocked - no real email), scheduling."""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from orbithire_worker.handlers.digest import digest
from orbithire_worker.ranking.digest import render, run_digest
from orbithire_worker.registry import Task

from .helpers import add_posting, cfg, cleanup_postings, ctx_for

RESEND = "https://api.resend.com/emails"


@pytest.fixture(autouse=True)
async def _cleanup(conn, user_id):
    yield
    await cleanup_postings(conn, user_id)
    await conn.execute("DELETE FROM tasks WHERE user_id = %s", (user_id,))


async def scored(conn, user_id, title, *, llm=None, sim=None, passed=True, status="new", **kw):
    _, mid = await add_posting(conn, user_id, title=title, status=status, **kw)
    await conn.execute(
        "UPDATE job_matches SET prefilter_pass = %s, llm_score = %s, similarity = %s, llm_reasons = %s WHERE id = %s",
        (passed, llm, sim, json.dumps({"summary": f"why {title}"}) if llm is not None else None, mid))
    return mid


def task(user_id):
    return Task(id=None, type="digest", payload={"user_id": user_id}, status="running", priority=0,
                attempts=1, max_attempts=3)


async def test_digest_top5_and_resend_payload(conn, user_id):
    await conn.execute("INSERT INTO ranking_settings (user_id) VALUES (%s)", (user_id,))
    ids = {
        "a": await scored(conn, user_id, "A <script>", llm=91, sim=0.2),
        "b": await scored(conn, user_id, "B", llm=85, sim=0.9),
        "c": await scored(conn, user_id, "C", llm=85, sim=0.95),   # same score, higher similarity -> before B
        "d": await scored(conn, user_id, "D", llm=60),
        "e": await scored(conn, user_id, "E", llm=None, sim=0.99),  # unscored after scored ones
        "f": await scored(conn, user_id, "F", llm=None, sim=0.5),   # 6th -> cut
        "x": await scored(conn, user_id, "X deal-breaker", llm=None, passed=False),
        "s": await scored(conn, user_id, "S skipped", llm=99, status="skipped"),
        "i": await scored(conn, user_id, "I inactive", llm=99, is_active=False, location="Pune, India"),
    }
    old = await scored(conn, user_id, "Old", llm=99)
    await conn.execute("UPDATE job_matches SET created_at = now() - interval '3 days' WHERE id = %s", (old,))

    with respx.mock(assert_all_called=True) as mock:
        route = mock.post(RESEND).mock(return_value=httpx.Response(200, json={"id": "email_123"}))
        async with httpx.AsyncClient() as http:
            result = await digest(task(user_id), ctx_for(conn, ranking_config=cfg(), http=http))

    assert result["sent"] is True and result["email_id"] == "email_123"
    assert result["match_ids"] == [ids["a"], ids["c"], ids["b"], ids["d"], ids["e"]]
    req = route.calls.last.request
    assert req.headers["authorization"] == "Bearer re_test"
    assert req.headers["idempotency-key"].startswith(f"digest-{user_id}-")
    body = json.loads(req.content)
    assert body["from"] == "OrbitHire <digest@orbithire.test>"
    assert body["to"][0].startswith("rank-")
    assert body["subject"] == "5 new job matches for you today"
    assert f"https://app.orbithire.test/jobs/{ids['a']}" in body["html"]
    assert "A &lt;script&gt;" in body["html"] and "<script>" not in body["html"]
    assert "https://app.orbithire.test/settings#ranking" in body["html"]
    assert body["headers"]["List-Unsubscribe"] == "<https://app.orbithire.test/settings#ranking>"
    assert "A <script> [91]" in body["text"] and body["text"].startswith("Hi Test,")

    cur = await conn.execute(
        "SELECT last_digest_at IS NOT NULL, digest_last_run_on IS NOT NULL FROM ranking_settings WHERE user_id = %s",
        (user_id,))
    assert await cur.fetchone() == (True, True)

    # Nothing new since the last digest -> skipped, no HTTP call
    with respx.mock(assert_all_called=False) as mock:
        route = mock.post(RESEND).mock(return_value=httpx.Response(200, json={"id": "x"}))
        async with httpx.AsyncClient() as http:
            again = await run_digest(conn, user_id, cfg(), http=http)
    assert again == {"skipped": "no new matches", "sent": False} and not route.called


async def test_digest_skips_and_errors(conn, user_id):
    await conn.execute("INSERT INTO ranking_settings (user_id, digest_enabled) VALUES (%s, false)", (user_id,))
    await scored(conn, user_id, "A", llm=80)
    with respx.mock(assert_all_called=False) as mock:
        route = mock.post(RESEND).mock(return_value=httpx.Response(200, json={"id": "x"}))
        async with httpx.AsyncClient() as http:
            assert (await run_digest(conn, user_id, cfg(), http=http))["skipped"] == "digest disabled"
            await conn.execute("UPDATE ranking_settings SET digest_enabled = true WHERE user_id = %s", (user_id,))
            out = await run_digest(conn, user_id, cfg(resend_api_key=None), http=http)
            assert out["sent"] is False and "not configured" in out["skipped"]
        assert not route.called

    # Resend failure -> raises (task retried), last_digest_at untouched
    await conn.execute("UPDATE ranking_settings SET digest_last_run_on = NULL WHERE user_id = %s", (user_id,))
    with respx.mock() as mock:
        mock.post(RESEND).mock(return_value=httpx.Response(422, json={"message": "bad from"}))
        async with httpx.AsyncClient() as http:
            with pytest.raises(RuntimeError, match="Resend error 422"):
                await run_digest(conn, user_id, cfg(), http=http)
    cur = await conn.execute("SELECT last_digest_at FROM ranking_settings WHERE user_id = %s", (user_id,))
    assert (await cur.fetchone())[0] is None


async def test_enqueue_due_digests_once_per_day(conn, user_id):
    # digest_hour 0 in UTC -> always due today
    await conn.execute(
        "INSERT INTO ranking_settings (user_id, digest_hour, timezone) VALUES (%s, 0, 'UTC')", (user_id,))
    cur = await conn.execute("SELECT enqueue_due_digests()")
    assert (await cur.fetchone())[0] >= 1
    cur = await conn.execute("SELECT enqueue_due_digests()")  # pending task -> not again
    cur = await conn.execute("SELECT count(*) FROM tasks WHERE type = 'digest' AND user_id = %s", (user_id,))
    assert (await cur.fetchone())[0] == 1

    # Once the run is recorded for today, nothing more is enqueued even after the task finished
    await conn.execute("UPDATE tasks SET status = 'done' WHERE user_id = %s", (user_id,))
    with respx.mock(assert_all_called=False):
        async with httpx.AsyncClient() as http:
            out = await run_digest(conn, user_id, cfg(), http=http)  # no matches -> skipped but recorded
    assert out["skipped"] == "no new matches"
    await conn.execute("SELECT enqueue_due_digests()")
    cur = await conn.execute("SELECT count(*) FROM tasks WHERE type = 'digest' AND user_id = %s", (user_id,))
    assert (await cur.fetchone())[0] == 1

    # A handler call without user_id runs the enqueue function
    res = await digest(Task(id=None, type="digest", payload={}, status="running", priority=0, attempts=1,
                            max_attempts=3), ctx_for(conn, ranking_config=cfg()))
    assert "enqueued" in res


async def test_invalid_timezone_rejected(conn, user_id):
    import psycopg

    with pytest.raises(psycopg.errors.CheckViolation):
        await conn.execute("INSERT INTO ranking_settings (user_id, timezone) VALUES (%s, 'Mars/Olympus')", (user_id,))


async def test_pg_cron_job_registered(conn):
    cur = await conn.execute("SELECT to_regclass('cron.job') IS NOT NULL")
    if not (await cur.fetchone())[0]:
        pytest.skip("pg_cron not available in this database")
    cur = await conn.execute("SELECT schedule, command FROM cron.job WHERE jobname = 'orbithire-digest-hourly'")
    assert await cur.fetchone() == ("5 * * * *", "SELECT public.enqueue_due_digests()")


def test_render_singular_and_no_name():
    subject, html_body, text = render(
        [{"match_id": "m1", "title": "T", "company": "C", "location": "L", "is_remote": True,
          "llm_score": None, "llm_reasons": None, "currency": "INR", "salary_max": 150000,
          "salary_interval": "monthly"}], app_url="https://x.test/", name=None)
    assert subject == "1 new job match for you today"
    assert "https://x.test/jobs/m1" in html_body and "₹18.0 LPA" in html_body and "Hi," in text
