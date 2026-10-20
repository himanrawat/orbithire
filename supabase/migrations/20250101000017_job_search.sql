-- Job search: per-user searches + ATS watchlist, global postings, per-user matches
-- (OrbitHire v2, see docs/PLAN.md §3 and §4.3/§4.4)

-- pgvector for posting/profile embeddings (installed in the Supabase "extensions" schema)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ==================== JOB SEARCHES ====================

CREATE TABLE IF NOT EXISTS job_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  keywords TEXT[] NOT NULL DEFAULT '{}',          -- search terms sent to JobSpy
  exclude_keywords TEXT[] NOT NULL DEFAULT '{}',  -- title keywords rejected by the pre-filter
  locations TEXT[] NOT NULL DEFAULT '{}',
  sites TEXT[] NOT NULL DEFAULT '{linkedin,indeed,naukri,glassdoor,google}'
    CHECK (sites <@ ARRAY['linkedin', 'indeed', 'naukri', 'glassdoor', 'google', 'zip_recruiter', 'bayt', 'bdjobs']::TEXT[]),
  remote_ok BOOLEAN NOT NULL DEFAULT TRUE,
  hours_old INTEGER NOT NULL DEFAULT 24 CHECK (hours_old > 0),
  results_wanted INTEGER NOT NULL DEFAULT 25 CHECK (results_wanted BETWEEN 1 AND 500),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_searches_user ON job_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_searches_enabled ON job_searches(enabled) WHERE enabled;

-- ==================== WATCHED COMPANIES ====================

CREATE TABLE IF NOT EXISTS watched_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  ats TEXT NOT NULL CHECK (ats IN ('greenhouse', 'lever', 'ashby')),
  board_token TEXT NOT NULL,   -- greenhouse board token / lever company / ashby job board name
  careers_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ats, board_token)
);

CREATE INDEX IF NOT EXISTS idx_watched_companies_user ON watched_companies(user_id);

-- ==================== JOB POSTINGS (global) ====================
-- Shared across users and deduplicated by dedupe_key. Written only by the worker
-- (service role); readable by every logged-in user.

CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,   -- normalized company + title + location
  source TEXT NOT NULL,              -- linkedin | indeed | naukri | glassdoor | google | greenhouse | lever | ashby ...
  external_id TEXT,
  url TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  is_remote BOOLEAN,
  salary_min NUMERIC,
  salary_max NUMERIC,
  currency TEXT,
  salary_interval TEXT,              -- yearly | monthly | weekly | daily | hourly (as reported by the source)
  description TEXT,
  posted_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  raw JSONB,
  embedding extensions.vector(1536), -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_postings_source_ext ON job_postings(source, external_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_active_seen ON job_postings(is_active, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_job_postings_embedding ON job_postings
  USING hnsw (embedding extensions.vector_cosine_ops);

-- ==================== JOB MATCHES (per user) ====================

CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  search_id UUID REFERENCES job_searches(id) ON DELETE SET NULL,  -- NULL when found via the watchlist
  prefilter_pass BOOLEAN,
  similarity DOUBLE PRECISION,       -- cosine similarity posting vs profile
  llm_score SMALLINT CHECK (llm_score BETWEEN 0 AND 100),
  llm_reasons JSONB,
  deal_breakers JSONB,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shortlisted', 'skipped', 'applied', 'expired')),
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,     -- set when it becomes an application
  seen_at TIMESTAMPTZ,               -- NULL = not yet seen in the Job Inbox
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, job_posting_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_inbox ON job_matches(user_id, status, llm_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_job_matches_user_created ON job_matches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_matches_posting ON job_matches(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_company ON job_matches(company_id) WHERE company_id IS NOT NULL;

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE job_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;

-- Searches and watchlist: users manage their own
DROP POLICY IF EXISTS job_searches_all ON job_searches;
CREATE POLICY job_searches_all ON job_searches FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS watched_companies_all ON watched_companies;
CREATE POLICY watched_companies_all ON watched_companies FOR ALL USING (auth.uid() = user_id);

-- Postings: read-only for logged-in users; writes only via service role (no write policies)
DROP POLICY IF EXISTS job_postings_read ON job_postings;
CREATE POLICY job_postings_read ON job_postings FOR SELECT TO authenticated USING (TRUE);

-- Matches: created by the worker; users read their own and change status / seen_at / company_id
DROP POLICY IF EXISTS job_matches_select ON job_matches;
CREATE POLICY job_matches_select ON job_matches FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS job_matches_update ON job_matches;
CREATE POLICY job_matches_update ON job_matches FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==================== TRIGGERS ====================

DROP TRIGGER IF EXISTS job_searches_updated_at ON job_searches;
CREATE TRIGGER job_searches_updated_at BEFORE UPDATE ON job_searches FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS watched_companies_updated_at ON watched_companies;
CREATE TRIGGER watched_companies_updated_at BEFORE UPDATE ON watched_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS job_postings_updated_at ON job_postings;
CREATE TRIGGER job_postings_updated_at BEFORE UPDATE ON job_postings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS job_matches_updated_at ON job_matches;
CREATE TRIGGER job_matches_updated_at BEFORE UPDATE ON job_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
