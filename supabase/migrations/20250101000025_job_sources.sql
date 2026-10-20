-- More job sources (OrbitHire v2, Wave 3)
--
-- * job_searches.country  ISO 3166-1 alpha-2 market of the search (default 'IN').
--   Drives JobSpy's country_indeed / Glassdoor domain, Naukri (IN only) and which
--   API sources apply. Supported codes are validated by the app/worker
--   (lib/jobs/types.ts COUNTRIES, worker fetchers/countries.py); the DB only
--   checks the format so new countries need no migration.
-- * job_searches.sources  official / free job APIs queried next to the JobSpy
--   `sites` (kept separate so existing rows and the `sites` CHECK stay valid).
-- * watched_companies.ats  + workable, smartrecruiters, recruitee, personio, teamtailor.
-- * Max 3 job searches per user (BEFORE INSERT trigger; the API and UI check too).
--
-- The Job Inbox is available to every user: job_searches / watched_companies /
-- job_matches RLS policies are "own rows" only (migration 017), no role gating.

-- ==================== JOB SEARCHES: country + API sources ====================

ALTER TABLE job_searches
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS sources TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE job_searches DROP CONSTRAINT IF EXISTS job_searches_country_check;
ALTER TABLE job_searches
  ADD CONSTRAINT job_searches_country_check CHECK (country ~ '^[A-Z]{2}$');

ALTER TABLE job_searches DROP CONSTRAINT IF EXISTS job_searches_sources_check;
ALTER TABLE job_searches
  ADD CONSTRAINT job_searches_sources_check CHECK (
    sources <@ ARRAY[
      'adzuna', 'jooble', 'reed', 'bundesagentur', 'arbeitnow', 'mycareersfuture',
      'usajobs', 'remotive', 'remoteok', 'himalayas', 'jobicy'
    ]::TEXT[]
  );

COMMENT ON COLUMN job_searches.country IS 'ISO 3166-1 alpha-2 market searched (JobSpy country, API source availability); default IN';
COMMENT ON COLUMN job_searches.sources IS 'Job APIs queried in addition to the JobSpy sites (adzuna, jooble, reed, bundesagentur, arbeitnow, mycareersfuture, usajobs, remotive, remoteok, himalayas, jobicy)';
COMMENT ON COLUMN job_searches.sites IS 'JobSpy boards (linkedin, indeed, naukri, glassdoor, google, ...); boards unavailable for the country are skipped';

-- ==================== WATCHED COMPANIES: more ATS ====================

ALTER TABLE watched_companies DROP CONSTRAINT IF EXISTS watched_companies_ats_check;
ALTER TABLE watched_companies
  ADD CONSTRAINT watched_companies_ats_check CHECK (
    ats IN ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'personio', 'teamtailor')
  );

COMMENT ON COLUMN watched_companies.board_token IS
  'greenhouse board token / lever company / ashby board / workable account / smartrecruiters company id / recruitee, personio, teamtailor subdomain';

-- ==================== MAX 3 JOB SEARCHES PER USER ====================

CREATE OR REPLACE FUNCTION enforce_job_search_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max CONSTANT INTEGER := 3;  -- keep in sync with MAX_JOB_SEARCHES (lib/jobs/types.ts, worker jobs_db.py)
  v_count INTEGER;
BEGIN
  -- Serialize concurrent inserts for the same user so two requests can't both pass.
  PERFORM pg_advisory_xact_lock(hashtextextended('job_searches_limit:' || NEW.user_id::text, 0));
  SELECT count(*) INTO v_count FROM job_searches WHERE user_id = NEW.user_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'job_search_limit: you can have at most % job searches', v_max
      USING ERRCODE = 'check_violation',
            HINT = 'Delete or edit an existing job search instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_searches_limit ON job_searches;
CREATE TRIGGER job_searches_limit
  BEFORE INSERT ON job_searches
  FOR EACH ROW EXECUTE FUNCTION enforce_job_search_limit();

COMMENT ON FUNCTION enforce_job_search_limit() IS
  'Max 3 job_searches per user (existing rows above the limit are kept; only new inserts are refused)';
