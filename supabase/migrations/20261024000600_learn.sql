-- PRD v2, area 3: Learn.
-- A private learning log, the launch learning paths with short lessons, per-user lesson
-- progress, and a study library of original guides and attributed external links.
-- Paths, lessons and library items are shared catalog content: every signed-in user can
-- read them; only the service role (migrations, admin scripts) writes them.

-- ==================== LEARNING LOG (per user) ====================

CREATE TABLE IF NOT EXISTS public.learning_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'note')),
  url TEXT CHECK (url IS NULL OR (char_length(url) <= 2048 AND url ~* '^https?://')),
  title TEXT CHECK (title IS NULL OR char_length(title) <= 300),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 5000),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
  -- "Share to profile" flips this to public; it stays private until the person chooses.
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT learning_entries_kind_shape CHECK (
    (kind = 'link' AND url IS NOT NULL) OR (kind = 'note' AND note IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_learning_entries_user_created
  ON public.learning_entries(user_id, created_at DESC);

-- ==================== PATHS AND LESSONS (catalog) ====================

CREATE TABLE IF NOT EXISTS public.paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,80}$'),
  title TEXT NOT NULL CHECK (char_length(title) <= 120),
  summary TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 600),
  stage TEXT CHECK (stage IS NULL OR stage IN ('student', 'early', 'experienced', 'leader')),
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.path_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES public.paths(id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9-]{1,80}$'),
  title TEXT NOT NULL CHECK (char_length(title) <= 160),
  -- the site promises lessons of about 8–15 minutes
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 8 AND 15),
  body_md TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (path_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_path_lessons_path_sort ON public.path_lessons(path_id, sort);

-- ==================== PROGRESS (per user) ====================

CREATE TABLE IF NOT EXISTS public.path_progress (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.path_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'done')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_path_progress_user_started
  ON public.path_progress(user_id, status, started_at DESC);

-- ==================== LIBRARY (catalog) ====================

CREATE TABLE IF NOT EXISTS public.library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,80}$'),
  kind TEXT NOT NULL CHECK (kind IN ('guide', 'link')),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  url TEXT CHECK (url IS NULL OR url ~* '^https?://'),
  source_name TEXT,
  body_md TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  stage TEXT CHECK (stage IS NULL OR stage IN ('student', 'early', 'experienced', 'leader')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT library_items_kind_shape CHECK (
    (kind = 'link' AND url IS NOT NULL) OR (kind = 'guide' AND body_md IS NOT NULL)
  )
);

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE public.learning_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.path_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;

-- Learning log: each person manages only their own entries. Public entries are not yet
-- readable by others; the public profile (area 7) adds that read policy when it ships.
DROP POLICY IF EXISTS learning_entries_select ON public.learning_entries;
CREATE POLICY learning_entries_select ON public.learning_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS learning_entries_insert ON public.learning_entries;
CREATE POLICY learning_entries_insert ON public.learning_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS learning_entries_update ON public.learning_entries;
CREATE POLICY learning_entries_update ON public.learning_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS learning_entries_delete ON public.learning_entries;
CREATE POLICY learning_entries_delete ON public.learning_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Catalog: read-only for signed-in users; no write policies, so only the service role writes.
DROP POLICY IF EXISTS paths_read ON public.paths;
CREATE POLICY paths_read ON public.paths FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS path_lessons_read ON public.path_lessons;
CREATE POLICY path_lessons_read ON public.path_lessons FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS library_items_read ON public.library_items;
CREATE POLICY library_items_read ON public.library_items FOR SELECT TO authenticated USING (TRUE);

-- Progress: each person reads and writes only their own rows.
DROP POLICY IF EXISTS path_progress_select ON public.path_progress;
CREATE POLICY path_progress_select ON public.path_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS path_progress_insert ON public.path_progress;
CREATE POLICY path_progress_insert ON public.path_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS path_progress_update ON public.path_progress;
CREATE POLICY path_progress_update ON public.path_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS path_progress_delete ON public.path_progress;
CREATE POLICY path_progress_delete ON public.path_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.paths, public.path_lessons, public.library_items, public.learning_entries, public.path_progress FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.paths, public.path_lessons, public.library_items FROM authenticated;
GRANT SELECT ON public.paths, public.path_lessons, public.library_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_entries, public.path_progress TO authenticated;
