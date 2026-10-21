"""Key decryption (cross-language vectors from lib/encryption.ts), LLM output repair, key policy."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

from orbithire_worker.llm import AnthropicScorer, OpenAIChatScorer, resolve_clients
from orbithire_worker.ranking.scoring import ScoreParseError, parse_score
from orbithire_worker.ranking.secrets import DecryptionError, decrypt_api_key

from .helpers import cfg, good_json

HERE = Path(__file__).parent
REPO = HERE.parents[2]
VECTORS = json.loads((HERE / "fixtures" / "encryption_vectors.json").read_text())


def _dec(v: dict) -> str:
    return decrypt_api_key(v["ciphertext"], encryption_key=v["env"].get("ENCRYPTION_KEY"),
                           jwt_secret=v["env"].get("SUPABASE_JWT_SECRET"))


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["plaintext"][:12])
def test_decrypt_node_vectors(vector):
    assert _dec(vector) == vector["plaintext"]


@pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
def test_decrypt_fresh_node_output():
    """Encrypt with the app's lib/encryption.ts right now, decrypt in Python."""
    proc = subprocess.run(
        ["node", str(HERE / "encrypt_vectors.mts"), str(REPO / "lib" / "encryption.ts")],
        capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        pytest.skip(f"node could not run the TS module: {proc.stderr[-300:]}")
    fresh = json.loads(proc.stdout)
    assert [v["ciphertext"] for v in fresh] != [v["ciphertext"] for v in VECTORS]  # random salt/iv
    for v in fresh:
        assert _dec(v) == v["plaintext"]


def test_decrypt_wrong_key_and_legacy():
    v = VECTORS[0]
    with pytest.raises(DecryptionError):
        decrypt_api_key(v["ciphertext"], encryption_key="x" * 40, jwt_secret=None)
    assert decrypt_api_key("sk-plain-legacy", encryption_key=None, jwt_secret=None) == "sk-plain-legacy"
    assert decrypt_api_key("", encryption_key=None, jwt_secret=None) == ""


# ------------------------------------------------------------------ output repair


def test_parse_valid():
    r = parse_score(good_json(81))
    assert r.score == 81 and r.reasons.skills_fit.score == 81


@pytest.mark.parametrize(
    "text",
    [
        "```json\n" + good_json(64) + "\n```",
        "Sure! Here is the evaluation:\n" + good_json(64) + "\nHope this helps.",
        good_json(64)[:-1] + ",}",                       # trailing comma
        good_json(64).replace('"score": 64,', '"score": "64/100",', 1),
    ],
)
def test_parse_repairs(text):
    assert parse_score(text).score == 64


def test_parse_flat_dimensions_and_clamp():
    text = json.dumps({"overall": 140, "skills_fit": 90, "seniority_fit": "70", "compensation": 40,
                       "freshness": 100, "location_eligibility": {"score": -5, "note": "abroad"},
                       "summary": None, "red_flags": "contract only"})
    r = parse_score(text)
    assert r.score == 100
    assert r.reasons.location_eligibility.score == 0
    assert r.reasons.seniority_fit.score == 70
    assert r.red_flags == ["contract only"]


def test_parse_truncated_output_is_closed():
    full = json.dumps({"score": 55, "reasons": {d: {"score": 50, "note": "x"} for d in
                       ("skills_fit", "seniority_fit", "compensation", "freshness", "location_eligibility")},
                       "summary": "cut off here"})
    r = parse_score(full[:-1])  # missing closing brace
    assert r.score == 55


@pytest.mark.parametrize("text", ["", "I cannot score this.", '{"score": 50}', '{"score": "high", "reasons": {}}'])
def test_parse_rejects_garbage(text):
    with pytest.raises(ScoreParseError):
        parse_score(text)


# ------------------------------------------------------------------ key policy


def test_platform_key_gated_by_quota():
    c = cfg(anthropic_api_key="sk-platform", openai_api_key="sk-oai")
    allowed = resolve_clients(None, {"can_generate": True, "reason": "free_tier"}, c)
    assert isinstance(allowed.scorer, AnthropicScorer) and allowed.scorer.source == "platform"
    assert allowed.platform_cap == 15 and allowed.embedder is not None
    blocked = resolve_clients(None, {"can_generate": False, "reason": "quota_exceeded"}, c)
    assert blocked.scorer is None and "quota_exceeded" in blocked.note
    assert blocked.embedder is not None  # embeddings are not quota-gated
    always = resolve_clients(None, {"can_generate": False}, cfg(anthropic_api_key="k", ranking_platform_llm="always"))
    assert always.scorer is not None
    never = resolve_clients(None, {"can_generate": True}, cfg(anthropic_api_key="k", ranking_platform_llm="never"))
    assert never.scorer is None


def test_user_key_wins_and_has_no_platform_cap():
    v = VECTORS[0]
    c = cfg(encryption_key=v["env"]["ENCRYPTION_KEY"], anthropic_api_key="sk-platform")
    us = {"ai_provider": "openai", "ai_api_key_encrypted": v["ciphertext"], "ai_base_url": None}
    out = resolve_clients(us, {"can_generate": False}, c)
    assert isinstance(out.scorer, OpenAIChatScorer)
    assert out.scorer.source == "user" and out.scorer.api_key == v["plaintext"]
    assert out.platform_cap is None
    assert out.embedder is not None and out.embedder.source == "user"
    us["ai_provider"] = "anthropic"
    out = resolve_clients(us, None, c)
    assert isinstance(out.scorer, AnthropicScorer) and out.scorer.model == "claude-haiku-5-5"
    us["ai_provider"] = "groq"
    out = resolve_clients(us, None, c)
    assert isinstance(out.scorer, OpenAIChatScorer) and "groq" in (out.scorer.base_url or "")


def test_llm_error_message_is_user_facing():
    from orbithire_worker.ranking.pipeline import describe_llm_error

    class ProviderError(Exception):
        def __init__(self, status_code: int) -> None:
            super().__init__(f"Error code: {status_code} - {{'error': {{'message': 'Incorrect API key provided: sk-...'}}}}")
            self.status_code = status_code

    assert "rejected the API key (HTTP 401)" in describe_llm_error(ProviderError(401))
    assert "sk-" not in describe_llm_error(ProviderError(401))
    assert "HTTP 429" in describe_llm_error(ProviderError(429))
    assert describe_llm_error(ValueError("bad json")) == "bad json"
