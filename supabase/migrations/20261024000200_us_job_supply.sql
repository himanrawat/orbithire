-- US job supply, Phase 0 (NextMilestone PRD area 9; reports/Low cost job data strategy.md)
--
-- * job_sources          source registry: legal basis, attribution and production gates per source
--                        (mirrors worker fetchers/source_registry.py and lib/jobs/sourceRegistry.ts)
-- * company_watchlist    shared, curated employer ATS boards (seeded by 20261024000201)
-- * job_observations     one row per (source, board, posting) sighting: fetched once, fanned out to many users
-- * source_runs          per-board run ledger (yield, failures) to measure supply before buying data
-- * job_supply_settings  singleton switches for the fetch-once fan-out rollout
-- * job_postings.attribution  credit link for aggregators whose terms require it
-- * tasks.type           + 'fetch_watchlist'
-- * pg_cron              every 15 min: enqueue one fetch_watchlist task; the worker picks due boards
--                        (priority boards every 30 min, the rest once a day)

-- ==================== SOURCE REGISTRY ====================

CREATE TABLE IF NOT EXISTS job_sources (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ats', 'api', 'jobspy', 'scraper')),
  legal_basis TEXT NOT NULL,
  home_url TEXT NOT NULL,
  tos_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  india_only BOOLEAN NOT NULL DEFAULT FALSE,
  attribution_required BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE job_sources IS
  'Legal basis and display rules per job source. tos_restricted sources run only with ENABLE_TOS_RESTRICTED_SOURCES, india_only with ENABLE_INDIA_SOURCES (worker env, both off by default).';

INSERT INTO job_sources (id, label, kind, legal_basis, home_url, tos_restricted, india_only, attribution_required) VALUES
  ('greenhouse', 'Greenhouse', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.greenhouse.com', FALSE, FALSE, FALSE),
  ('ashby', 'Ashby', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.ashbyhq.com', FALSE, FALSE, FALSE),
  ('lever', 'Lever', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.lever.co', FALSE, FALSE, FALSE),
  ('smartrecruiters', 'SmartRecruiters', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.smartrecruiters.com', FALSE, FALSE, FALSE),
  ('workable', 'Workable', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.workable.com', FALSE, FALSE, FALSE),
  ('recruitee', 'Recruitee', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://recruitee.com', FALSE, FALSE, FALSE),
  ('personio', 'Personio', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.personio.com', FALSE, FALSE, FALSE),
  ('teamtailor', 'Teamtailor', 'ats', 'Public employer ATS feed (employer-published postings; link to the employer''s apply URL)', 'https://www.teamtailor.com', FALSE, FALSE, FALSE),
  ('usajobs', 'USAJOBS', 'api', 'OPM USAJOBS API terms: free key, commercial and noncommercial reuse of public data allowed', 'https://www.usajobs.gov', FALSE, FALSE, FALSE),
  ('himalayas', 'Himalayas', 'api', 'Himalayas API terms: attribution and Himalayas apply URL required; no redistribution to job boards', 'https://himalayas.app', FALSE, FALSE, TRUE),
  ('jobicy', 'Jobicy', 'api', 'Jobicy public feed terms: credit Jobicy with a direct link to the source listing', 'https://jobicy.com', FALSE, FALSE, TRUE),
  ('remoteok', 'Remote OK', 'api', 'Remote OK API terms: mention Remote OK as the source with a followed link back; no logo', 'https://remoteok.com', FALSE, FALSE, TRUE),
  ('remotive', 'Remotive', 'api', 'Remotive public API: 24-hour delay, link back and attribution required; redistribution limited', 'https://remotive.com', FALSE, FALSE, TRUE),
  ('arbeitnow', 'Arbeitnow', 'api', 'Arbeitnow free API with backlink; commercial use unconfirmed (experimental)', 'https://www.arbeitnow.com', FALSE, FALSE, TRUE),
  ('adzuna', 'Adzuna', 'api', 'Adzuna developer terms: keyed, capped quota; commercial use may need a license', 'https://www.adzuna.com', FALSE, FALSE, TRUE),
  ('jooble', 'Jooble', 'api', 'Jooble REST API key: 500 lifetime requests (benchmark only)', 'https://jooble.org', FALSE, FALSE, TRUE),
  ('reed', 'Reed', 'api', 'Reed jobseeker API key (UK); terms not yet reviewed', 'https://www.reed.co.uk', FALSE, FALSE, FALSE),
  ('bundesagentur', 'Bundesagentur für Arbeit', 'api', 'Community-documented public endpoint (experimental)', 'https://www.arbeitsagentur.de', FALSE, FALSE, FALSE),
  ('mycareersfuture', 'MyCareersFuture', 'api', 'Singapore government public job search API', 'https://www.mycareersfuture.gov.sg', FALSE, FALSE, FALSE),
  ('linkedin', 'LinkedIn', 'jobspy', 'Restricted: LinkedIn terms prohibit unapproved scraping', 'https://www.linkedin.com', TRUE, FALSE, FALSE),
  ('glassdoor', 'Glassdoor', 'jobspy', 'Restricted: Glassdoor terms prohibit automated scraping', 'https://www.glassdoor.com', TRUE, FALSE, FALSE),
  ('indeed', 'Indeed', 'jobspy', 'Restricted: Indeed terms prohibit unapproved scraping', 'https://www.indeed.com', TRUE, FALSE, FALSE),
  ('naukri', 'Naukri', 'jobspy', 'India-only board via JobSpy (opt-in)', 'https://www.naukri.com', FALSE, TRUE, FALSE),
  ('google', 'Google Jobs', 'jobspy', 'Search-result discovery via JobSpy (experimental)', 'https://www.google.com', FALSE, FALSE, FALSE),
  ('zip_recruiter', 'ZipRecruiter', 'jobspy', 'Board via JobSpy (experimental, terms not reviewed)', 'https://www.ziprecruiter.com', FALSE, FALSE, FALSE),
  ('bayt', 'Bayt', 'jobspy', 'Board via JobSpy (experimental, terms not reviewed)', 'https://www.bayt.com', FALSE, FALSE, FALSE),
  ('bdjobs', 'BDJobs', 'jobspy', 'Board via JobSpy (experimental, terms not reviewed)', 'https://www.bdjobs.com', FALSE, FALSE, FALSE),
  ('wellfound', 'Wellfound', 'scraper', 'Personal-scale scraper, robots.txt respected (opt-in)', 'https://wellfound.com', FALSE, FALSE, FALSE),
  ('instahyre', 'Instahyre', 'scraper', 'India-only personal-scale scraper (opt-in)', 'https://www.instahyre.com', FALSE, TRUE, FALSE),
  ('cutshort', 'Cutshort', 'scraper', 'India-only personal-scale scraper (opt-in)', 'https://cutshort.io', FALSE, TRUE, FALSE),
  ('seek', 'SEEK', 'scraper', 'Blocked: requires a browser', 'https://www.seek.com.au', FALSE, FALSE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label, kind = EXCLUDED.kind, legal_basis = EXCLUDED.legal_basis,
  home_url = EXCLUDED.home_url, tos_restricted = EXCLUDED.tos_restricted,
  india_only = EXCLUDED.india_only, attribution_required = EXCLUDED.attribution_required,
  updated_at = NOW();

-- ==================== COMPANY WATCHLIST (shared) ====================

CREATE TABLE IF NOT EXISTS company_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ats TEXT NOT NULL CHECK (
    ats IN ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'teamtailor')
  ),
  board_token TEXT NOT NULL CHECK (board_token ~ '^[A-Za-z0-9._-]{1,100}$'),
  country TEXT NOT NULL DEFAULT 'US' CHECK (country ~ '^[A-Z]{2}$'),
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2)),  -- 1 = poll every 15-30 min, 2 = daily
  active BOOLEAN NOT NULL DEFAULT TRUE,
  legal_basis TEXT NOT NULL DEFAULT 'public_employer_ats_feed',
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ats, board_token)
);

CREATE INDEX IF NOT EXISTS idx_company_watchlist_due
  ON company_watchlist (priority, last_fetched_at NULLS FIRST) WHERE active;

COMMENT ON TABLE company_watchlist IS
  'Curated employer ATS boards fetched once per run by fetch_watchlist and fanned out to every matching user';

DROP TRIGGER IF EXISTS company_watchlist_updated_at ON company_watchlist;
CREATE TRIGGER company_watchlist_updated_at BEFORE UPDATE ON company_watchlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== OBSERVATIONS + RUN LEDGER ====================

CREATE TABLE IF NOT EXISTS job_observations (
  id BIGSERIAL PRIMARY KEY,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_board TEXT NOT NULL DEFAULT '',     -- ATS board token or normalized query key
  external_id TEXT NOT NULL,                 -- source posting id (URL when the source has none)
  url TEXT,
  raw_hash TEXT NOT NULL,                    -- sha1 of the source record: detects content changes
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- last time this source returned it
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- last time raw_hash changed
  seen_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (source, source_board, external_id)
);

CREATE INDEX IF NOT EXISTS idx_job_observations_posting ON job_observations (job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_observations_fetched ON job_observations (source, fetched_at);

CREATE TABLE IF NOT EXISTS source_runs (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID,
  source TEXT NOT NULL,
  source_board TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetched INTEGER NOT NULL DEFAULT 0,
  kept INTEGER NOT NULL DEFAULT 0,
  new_postings INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_source_runs_source_started ON source_runs (source, started_at DESC);

-- ==================== FAN-OUT SWITCHES ====================

CREATE TABLE IF NOT EXISTS job_supply_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- FALSE = shadow mode: shared boards are fetched and stored, matches are only counted
  fanout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE = per-user watchlist fetch_jobs tasks keep running (the legacy path).
  -- FALSE = fetch_watchlist also fetches users' watched_companies boards once and fans them out.
  per_user_watchlist BOOLEAN NOT NULL DEFAULT TRUE,
  priority_interval_minutes INTEGER NOT NULL DEFAULT 30 CHECK (priority_interval_minutes BETWEEN 15 AND 1440),
  standard_interval_hours INTEGER NOT NULL DEFAULT 24 CHECK (standard_interval_hours BETWEEN 1 AND 168),
  boards_per_run INTEGER NOT NULL DEFAULT 120 CHECK (boards_per_run BETWEEN 1 AND 1000),
  max_matches_per_user_run INTEGER NOT NULL DEFAULT 100 CHECK (max_matches_per_user_run BETWEEN 1 AND 1000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO job_supply_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ==================== POSTING ATTRIBUTION ====================

ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS attribution JSONB;

COMMENT ON COLUMN job_postings.attribution IS
  '{"name","url","home_url"} credit link for aggregator sources whose terms require attribution (Himalayas, Jobicy, Remote OK, ...)';

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_supply_settings ENABLE ROW LEVEL SECURITY;

-- Registry and watchlist are public catalog data for signed-in users; writes via service role only.
DROP POLICY IF EXISTS job_sources_read ON job_sources;
CREATE POLICY job_sources_read ON job_sources FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS company_watchlist_read ON company_watchlist;
CREATE POLICY company_watchlist_read ON company_watchlist FOR SELECT TO authenticated USING (active);

-- job_observations, source_runs, job_supply_settings: no policies (service role / worker only).

-- ==================== TASK TYPE ====================
-- Other migrations may extend the same CHECK, so rebuild it from the current list
-- plus 'fetch_watchlist' instead of hard-coding the full list.

DO $$
DECLARE
  v_def TEXT;
  v_types TEXT[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.tasks'::regclass AND c.conname = 'tasks_type_check';
  IF v_def IS NULL THEN
    RETURN;  -- no CHECK on tasks.type: nothing to extend
  END IF;
  SELECT array_agg(DISTINCT m[1]) INTO v_types
    FROM regexp_matches(v_def, '''([a-z_]+)''', 'g') AS m;
  IF 'fetch_watchlist' = ANY (v_types) THEN
    RETURN;
  END IF;
  v_types := v_types || 'fetch_watchlist'::TEXT;
  EXECUTE 'ALTER TABLE public.tasks DROP CONSTRAINT tasks_type_check';
  EXECUTE format(
    'ALTER TABLE public.tasks ADD CONSTRAINT tasks_type_check CHECK (type = ANY (%L::TEXT[]))',
    v_types
  );
END;
$$;

-- ==================== SCHEDULE ====================

CREATE OR REPLACE FUNCTION enqueue_watchlist_fetch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  INSERT INTO tasks (type, payload)
  SELECT 'fetch_watchlist', jsonb_build_object('trigger', 'cron')
   WHERE EXISTS (SELECT 1 FROM company_watchlist WHERE active)
     AND NOT EXISTS (
           SELECT 1 FROM tasks t
            WHERE t.type = 'fetch_watchlist' AND t.status IN ('queued', 'running')
         );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_watchlist_fetch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_watchlist_fetch() TO service_role;

COMMENT ON FUNCTION enqueue_watchlist_fetch() IS
  'pg_cron every 15 min: one fetch_watchlist task (the worker fetches only due boards: priority every 30 min, others daily)';

SELECT cron.schedule(
  'nextmilestone-watchlist-fetch',
  '*/15 * * * *',
  $cron$SELECT public.enqueue_watchlist_fetch()$cron$
);
