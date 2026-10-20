-- Job ingestion scheduling (OrbitHire v2, docs/PLAN.md §4.3, Phase 2)
--
-- * pg_cron at 01:30 UTC (07:00 IST) enqueues one `fetch_jobs` task per enabled
--   job_search and one "watchlist" task per user with enabled watched_companies.
-- * request_job_fetch(): the app's "Fetch now" button (auth.uid() only, rate-limited).
-- * job_searches.include_keywords: title keywords a posting must contain (one of),
--   used by the fetch-time title filter (portals.yml `title_filter.positive`).
-- * job_inbox view: matches joined with their posting, for sorting/filtering in the UI.
-- * companies.status -> job_matches.status = 'applied' sync.
--
-- fetch_jobs payloads (consumed by worker/orbithire_worker/handlers/fetch_jobs.py):
--   {"user_id": <uuid>, "search_id": <uuid>}      one job_search (JobSpy boards)
--   {"user_id": <uuid>, "watchlist": true}        all enabled watched_companies (ATS APIs)
-- plus an informational "trigger": "cron" | "manual".

-- pg_cron is preloaded in the Supabase Postgres image; Supabase installs it in pg_catalog.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ==================== JOB SEARCHES: title include keywords ====================

ALTER TABLE job_searches
  ADD COLUMN IF NOT EXISTS include_keywords TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN job_searches.keywords IS 'Search terms sent to JobSpy (one query per keyword x location x site)';
COMMENT ON COLUMN job_searches.include_keywords IS 'Title must contain at least one of these (empty = any); also filters watchlist boards';
COMMENT ON COLUMN job_searches.exclude_keywords IS 'Title must contain none of these; also filters watchlist boards';

-- Helps the "is a fetch already queued/running for this user/search" checks.
CREATE INDEX IF NOT EXISTS idx_tasks_user_type_status ON tasks(user_id, type, status) WHERE user_id IS NOT NULL;

-- ==================== DAILY ENQUEUE (cron) ====================

CREATE OR REPLACE FUNCTION enqueue_daily_job_fetches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rows INTEGER;
BEGIN
  -- One task per enabled search, unless one for that search is still pending.
  INSERT INTO tasks (type, payload, user_id)
  SELECT 'fetch_jobs',
         jsonb_build_object('user_id', s.user_id, 'search_id', s.id, 'trigger', 'cron'),
         s.user_id
    FROM job_searches s
   WHERE s.enabled
     AND NOT EXISTS (
           SELECT 1 FROM tasks t
            WHERE t.type = 'fetch_jobs'
              AND t.user_id = s.user_id
              AND t.status IN ('queued', 'running')
              AND t.payload->>'search_id' = s.id::text
         );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  -- One watchlist task per user with at least one enabled watched company.
  INSERT INTO tasks (type, payload, user_id)
  SELECT 'fetch_jobs',
         jsonb_build_object('user_id', w.user_id, 'watchlist', TRUE, 'trigger', 'cron'),
         w.user_id
    FROM (SELECT DISTINCT user_id FROM watched_companies WHERE enabled) w
   WHERE NOT EXISTS (
           SELECT 1 FROM tasks t
            WHERE t.type = 'fetch_jobs'
              AND t.user_id = w.user_id
              AND t.status IN ('queued', 'running')
              AND (t.payload->>'watchlist')::boolean IS TRUE
         );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_count := v_count + v_rows;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_daily_job_fetches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_daily_job_fetches() TO service_role;

COMMENT ON FUNCTION enqueue_daily_job_fetches() IS
  'pg_cron 01:30 UTC (07:00 IST): one fetch_jobs task per enabled job_search + one watchlist task per user';

-- cron.schedule(name, ...) upserts by job name, so re-running this migration is safe.
SELECT cron.schedule(
  'orbithire-daily-job-fetch',
  '30 1 * * *',
  $cron$SELECT public.enqueue_daily_job_fetches()$cron$
);

-- ==================== FETCH NOW (app rpc) ====================
-- supabase.rpc('request_job_fetch') with the user's JWT. Returns
--   {"queued": true,  "task_ids": [...], "searches": n, "watchlist": bool}
--   {"queued": false, "reason": "in_progress" | "too_soon" | "nothing_to_fetch", "retry_at"?: ts, "task_ids"?: [...]}
-- Rate limit: refused while a fetch for the user is queued/running, or when the
-- user's last fetch task was created less than 10 minutes ago.

CREATE OR REPLACE FUNCTION request_job_fetch()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pending UUID[];
  v_last TIMESTAMPTZ;
  v_ids UUID[] := '{}';
  v_searches INTEGER := 0;
  v_watch BOOLEAN := FALSE;
  v_id UUID;
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'request_job_fetch: not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Serialize concurrent clicks for the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended('request_job_fetch:' || v_uid::text, 0));

  SELECT array_agg(id) INTO v_pending
    FROM tasks
   WHERE user_id = v_uid AND type = 'fetch_jobs' AND status IN ('queued', 'running');
  IF v_pending IS NOT NULL THEN
    RETURN jsonb_build_object('queued', FALSE, 'reason', 'in_progress', 'task_ids', to_jsonb(v_pending));
  END IF;

  SELECT max(created_at) INTO v_last
    FROM tasks
   WHERE user_id = v_uid AND type = 'fetch_jobs';
  IF v_last IS NOT NULL AND v_last > now() - INTERVAL '10 minutes' THEN
    RETURN jsonb_build_object('queued', FALSE, 'reason', 'too_soon', 'retry_at', v_last + INTERVAL '10 minutes');
  END IF;

  FOR r IN SELECT id FROM job_searches WHERE user_id = v_uid AND enabled ORDER BY created_at LOOP
    INSERT INTO tasks (type, payload, priority, user_id)
    VALUES ('fetch_jobs', jsonb_build_object('user_id', v_uid, 'search_id', r.id, 'trigger', 'manual'), 5, v_uid)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_searches := v_searches + 1;
  END LOOP;

  IF EXISTS (SELECT 1 FROM watched_companies WHERE user_id = v_uid AND enabled) THEN
    INSERT INTO tasks (type, payload, priority, user_id)
    VALUES ('fetch_jobs', jsonb_build_object('user_id', v_uid, 'watchlist', TRUE, 'trigger', 'manual'), 5, v_uid)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
    v_watch := TRUE;
  END IF;

  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('queued', FALSE, 'reason', 'nothing_to_fetch');
  END IF;

  RETURN jsonb_build_object('queued', TRUE, 'task_ids', to_jsonb(v_ids), 'searches', v_searches, 'watchlist', v_watch);
END;
$$;

REVOKE ALL ON FUNCTION request_job_fetch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_job_fetch() TO authenticated;

-- ==================== JOB INBOX VIEW ====================
-- security_invoker: RLS of job_matches (own rows) and job_postings (authenticated read) applies.

CREATE OR REPLACE VIEW job_inbox
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.user_id,
  m.job_posting_id,
  m.search_id,
  m.prefilter_pass,
  m.similarity,
  m.llm_score,
  m.llm_reasons,
  m.deal_breakers,
  m.status,
  m.company_id,
  m.seen_at,
  m.created_at,
  m.updated_at,
  p.source,
  p.url,
  p.title,
  p.company,
  p.location,
  p.is_remote,
  p.salary_min,
  p.salary_max,
  p.currency,
  p.salary_interval,
  p.posted_at,
  p.first_seen_at,
  p.last_seen_at,
  p.is_active,
  COALESCE(p.salary_max, p.salary_min) AS salary_top
FROM job_matches m
JOIN job_postings p ON p.id = m.job_posting_id;

GRANT SELECT ON job_inbox TO authenticated, service_role;

COMMENT ON VIEW job_inbox IS 'Job Inbox rows: job_matches + job_postings (no description/raw/embedding)';

-- ==================== APPLICATION STATUS -> MATCH STATUS ====================
-- Rule: "Create application" from a job links the match (company_id) and sets it to
-- 'shortlisted'; the application starts as 'saved'. The match becomes 'applied' only
-- when the linked application's status moves to applied (or later: interviewing,
-- offered, rejected).

CREATE OR REPLACE FUNCTION sync_job_match_from_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('applied', 'interviewing', 'offered', 'rejected')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE job_matches
       SET status = 'applied'
     WHERE company_id = NEW.id
       AND status <> 'applied';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_sync_job_match ON companies;
CREATE TRIGGER companies_sync_job_match
  AFTER UPDATE OF status ON companies
  FOR EACH ROW EXECUTE FUNCTION sync_job_match_from_company();
