-- Ranking + morning digest (OrbitHire v2 Phase 3, see docs/PLAN.md §4.4 / §4.5)
--
-- * ranking_settings         per-user pre-filter rules, daily LLM budget, digest preferences
-- * ranking_usage            per-user per-day counters (LLM calls / embedding calls) so the
--                            worker never exceeds daily_llm_limit, even across reruns
-- * user_profile_embeddings  profile embedding (text-embedding-3-small) + hash of the text
--                            that produced it, so an unchanged profile is never re-embedded
-- * helpers                  cosine similarity refresh (pgvector), atomic LLM-call reservation,
--                            digest enqueue for pg_cron
--
-- The worker uses the service role / postgres (bypasses RLS). Users read and edit their own
-- ranking_settings through /api/settings/ranking (RLS).

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ==================== RANKING SETTINGS ====================

-- TRUE when tz is a time zone name Postgres knows (used by a CHECK constraint so a bad
-- value can never break the hourly digest query).
CREATE OR REPLACE FUNCTION is_valid_timezone(tz TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  PERFORM now() AT TIME ZONE tz;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE TABLE IF NOT EXISTS ranking_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Pre-filter deal-breakers (free, applied before any AI call)
  min_salary NUMERIC NOT NULL DEFAULT 1200000 CHECK (min_salary >= 0),  -- yearly, in min_salary_currency (₹12 LPA)
  min_salary_currency TEXT NOT NULL DEFAULT 'INR',                      -- only postings in this currency are compared
  home_country TEXT NOT NULL DEFAULT 'India',
  known_languages TEXT[] NOT NULL DEFAULT '{English,Hindi}',             -- a posting that requires any other language is a deal-breaker
  needs_visa_sponsorship_abroad BOOLEAN NOT NULL DEFAULT TRUE,           -- onsite roles abroad that rule out sponsorship are deal-breakers
  excluded_locations TEXT[] NOT NULL DEFAULT '{}',                       -- substring match on the posting location
  excluded_companies TEXT[] NOT NULL DEFAULT '{}',                       -- case-insensitive exact company name

  -- LLM scoring budget
  daily_llm_limit INTEGER NOT NULL DEFAULT 15 CHECK (daily_llm_limit BETWEEN 0 AND 200),

  -- Morning digest
  digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  digest_hour SMALLINT NOT NULL DEFAULT 8 CHECK (digest_hour BETWEEN 0 AND 23),  -- local hour in "timezone"
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (is_valid_timezone(timezone)),
  last_digest_at TIMESTAMPTZ,        -- last time a digest email was actually sent (worker)
  digest_last_run_on DATE,           -- local date of the last digest run, sent or skipped (worker)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ranking_settings IS 'Per-user ranking rules (pre-filter, daily LLM budget) and digest preferences';

-- ==================== DAILY USAGE COUNTERS ====================

CREATE TABLE IF NOT EXISTS ranking_usage (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,                                -- local date in ranking_settings.timezone
  llm_calls INTEGER NOT NULL DEFAULT 0 CHECK (llm_calls >= 0),
  embedding_calls INTEGER NOT NULL DEFAULT 0 CHECK (embedding_calls >= 0),
  embedding_inputs INTEGER NOT NULL DEFAULT 0 CHECK (embedding_inputs >= 0),
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

COMMENT ON TABLE ranking_usage IS 'LLM / embedding calls per user per local day (rank_jobs never exceeds daily_llm_limit)';

-- ==================== PROFILE EMBEDDINGS ====================

CREATE TABLE IF NOT EXISTS user_profile_embeddings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  embedding extensions.vector(1536) NOT NULL,
  text_hash TEXT NOT NULL,           -- sha256(model + profile text); unchanged hash = no re-embed
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== RLS ====================

ALTER TABLE ranking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profile_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ranking_settings_select ON ranking_settings;
CREATE POLICY ranking_settings_select ON ranking_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS ranking_settings_insert ON ranking_settings;
CREATE POLICY ranking_settings_insert ON ranking_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS ranking_settings_update ON ranking_settings;
CREATE POLICY ranking_settings_update ON ranking_settings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Usage and embeddings: read-only for the owner, written by the worker
DROP POLICY IF EXISTS ranking_usage_select ON ranking_usage;
CREATE POLICY ranking_usage_select ON ranking_usage FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS user_profile_embeddings_select ON user_profile_embeddings;
CREATE POLICY user_profile_embeddings_select ON user_profile_embeddings FOR SELECT USING (auth.uid() = user_id);

-- ==================== TRIGGERS ====================

DROP TRIGGER IF EXISTS ranking_settings_updated_at ON ranking_settings;
CREATE TRIGGER ranking_settings_updated_at BEFORE UPDATE ON ranking_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS ranking_usage_updated_at ON ranking_usage;
CREATE TRIGGER ranking_usage_updated_at BEFORE UPDATE ON ranking_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_profile_embeddings_updated_at ON user_profile_embeddings;
CREATE TRIGGER user_profile_embeddings_updated_at BEFORE UPDATE ON user_profile_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inbox ordering: score, then similarity
CREATE INDEX IF NOT EXISTS idx_job_matches_rank ON job_matches(user_id, prefilter_pass, llm_score DESC NULLS LAST, similarity DESC NULLS LAST);
-- rank_jobs picks up unprocessed matches
CREATE INDEX IF NOT EXISTS idx_job_matches_unranked ON job_matches(user_id) WHERE prefilter_pass IS NULL;

-- ==================== HELPERS (worker / service role only) ====================

-- Cosine similarity between each match's posting embedding and the user's profile embedding.
-- p_only_missing = true updates rows whose similarity is NULL; false recomputes all of the
-- user's matches (after the profile changed). Returns the number of rows updated.
CREATE OR REPLACE FUNCTION ranking_refresh_similarity(p_user_id UUID, p_only_missing BOOLEAN DEFAULT TRUE)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE job_matches m
     SET similarity = 1 - (p.embedding OPERATOR(extensions.<=>) e.embedding)
    FROM job_postings p, user_profile_embeddings e
   WHERE m.user_id = p_user_id
     AND e.user_id = p_user_id
     AND p.id = m.job_posting_id
     AND p.embedding IS NOT NULL
     AND (NOT p_only_missing OR m.similarity IS NULL);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Atomically reserve one LLM call for p_user_id on p_day if fewer than p_limit were made.
-- Returns TRUE when the call may proceed. Concurrent workers can never push llm_calls past p_limit.
CREATE OR REPLACE FUNCTION ranking_reserve_llm_call(p_user_id UUID, p_day DATE, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calls INTEGER;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO ranking_usage (user_id, day, llm_calls)
  VALUES (p_user_id, p_day, 1)
  ON CONFLICT (user_id, day) DO UPDATE
     SET llm_calls = ranking_usage.llm_calls + 1
   WHERE ranking_usage.llm_calls < p_limit
  RETURNING llm_calls INTO v_calls;
  RETURN v_calls IS NOT NULL;
END;
$$;

-- Enqueue one `digest` task per user whose local digest hour has arrived today and who has
-- not had a digest run today (sent or skipped) and has no digest task pending. Called hourly
-- by pg_cron; safe to call any time (idempotent within a day).
CREATE OR REPLACE FUNCTION enqueue_due_digests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT rs.user_id, (now() AT TIME ZONE rs.timezone)::date AS local_day
      FROM ranking_settings rs
     WHERE rs.digest_enabled
       AND EXTRACT(HOUR FROM (now() AT TIME ZONE rs.timezone)) >= rs.digest_hour
       AND (rs.digest_last_run_on IS NULL OR rs.digest_last_run_on < (now() AT TIME ZONE rs.timezone)::date)
       AND NOT EXISTS (
         SELECT 1 FROM tasks t
          WHERE t.type = 'digest' AND t.user_id = rs.user_id AND t.status IN ('queued', 'running'))
  LOOP
    INSERT INTO tasks (type, payload, priority, user_id)
    VALUES ('digest', jsonb_build_object('user_id', r.user_id, 'day', r.local_day), -1, r.user_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION ranking_refresh_similarity(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ranking_reserve_llm_call(UUID, DATE, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION enqueue_due_digests() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ranking_refresh_similarity(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION ranking_reserve_llm_call(UUID, DATE, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION enqueue_due_digests() TO service_role;

-- ==================== PG_CRON: hourly digest check ====================
-- Migration 020 enables pg_cron for the 07:00 IST fetch; enable it defensively here too.
-- Skipped (with a NOTICE) where pg_cron is not available / not preloaded.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      -- cron.schedule(job_name, ...) upserts by name, so rerunning is safe.
      EXECUTE $cmd$SELECT cron.schedule('orbithire-digest-hourly', '5 * * * *', 'SELECT public.enqueue_due_digests()')$cmd$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron digest schedule skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule enqueue_due_digests() externally';
  END IF;
END;
$$;
