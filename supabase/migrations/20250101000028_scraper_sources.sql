-- Tier 3 job-board scrapers (OrbitHire v2, Wave 4)
--
-- job_searches.sources may now also contain the opt-in scrapers:
--   wellfound  (startups, any country)
--   instahyre  (India only)
--   cutshort   (India only)
--   seek       (Australia / New Zealand; currently shipped blocked: SEEK needs a browser)
--
-- They have no public API: personal-scale, robots.txt-respecting, tiny volume, and
-- never selected by default (lib/jobs/types.ts defaultSourcesFor). The worker can
-- turn them off with JOB_SCRAPERS_ENABLED=false or SCRAPER_DISABLE=<ids>.
-- Keep in sync with API_SOURCE_IDS (lib/jobs/types.ts) and the worker registry
-- (worker/orbithire_worker/fetchers/sources/__init__.py).

ALTER TABLE job_searches DROP CONSTRAINT IF EXISTS job_searches_sources_check;
ALTER TABLE job_searches
  ADD CONSTRAINT job_searches_sources_check CHECK (
    sources <@ ARRAY[
      'adzuna', 'jooble', 'reed', 'bundesagentur', 'arbeitnow', 'mycareersfuture',
      'usajobs', 'remotive', 'remoteok', 'himalayas', 'jobicy',
      'wellfound', 'instahyre', 'cutshort', 'seek'
    ]::TEXT[]
  );

COMMENT ON COLUMN job_searches.sources IS
  'Job APIs queried in addition to the JobSpy sites (adzuna, jooble, reed, bundesagentur, arbeitnow, mycareersfuture, usajobs, remotive, remoteok, himalayas, jobicy) and opt-in scrapers (wellfound, instahyre, cutshort, seek)';
