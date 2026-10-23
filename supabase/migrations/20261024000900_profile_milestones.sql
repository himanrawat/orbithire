-- PRD v2, area 7: profile and milestones.
--
-- * profiles gains the public-profile switches: public_handle, public_profile_enabled,
--   search_indexing (opt-in, off by default) and open_to_roles. open_to_roles is owner-only:
--   profiles RLS already limits SELECT to the row's owner, and get_public_profile() below
--   never returns it (nor email).
-- * milestones: the timeline. Each item is private unless the owner makes it public.
-- * milestone_suggestions: pending suggestions built from events (an offer in Companies, a
--   finished learning path, a finished public learning entry). The owner accepts or dismisses.
-- * get_public_profile(handle): the only read path for /u/[handle]. Returns public fields,
--   public milestones and public learning entries for enabled profiles, NULL otherwise.
-- Depends on 20261024000600_learn.sql (learning_entries, paths, path_lessons, path_progress).
-- * refresh_milestone_suggestions(): fills suggestions for the caller (auth.uid()).

-- ==================== PROFILES: PUBLIC PROFILE ====================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_handle TEXT,
  ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS search_indexing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS open_to_roles BOOLEAN NOT NULL DEFAULT FALSE;

-- Handle: 3-30 characters, lowercase letters, digits and hyphens, no leading/trailing hyphen.
-- Keep in sync with lib/milestones/handle.ts (which also blocks reserved words).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_public_handle_format_check,
  ADD CONSTRAINT profiles_public_handle_format_check
    CHECK (public_handle IS NULL OR public_handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  DROP CONSTRAINT IF EXISTS profiles_public_handle_reserved_check,
  ADD CONSTRAINT profiles_public_handle_reserved_check
    CHECK (public_handle IS NULL OR public_handle NOT IN (
      'admin', 'api', 'app', 'dashboard', 'help', 'info', 'hello', 'support', 'settings',
      'signin', 'signup', 'login', 'logout', 'me', 'profile', 'root', 'staff', 'team',
      'nextmilestone', 'orbithire', 'security', 'privacy', 'terms', 'about', 'null', 'undefined'
    )),
  DROP CONSTRAINT IF EXISTS profiles_public_profile_needs_handle_check,
  ADD CONSTRAINT profiles_public_profile_needs_handle_check
    CHECK (NOT public_profile_enabled OR public_handle IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_handle_key
  ON public.profiles (public_handle)
  WHERE public_handle IS NOT NULL;

COMMENT ON COLUMN public.profiles.public_handle IS 'Public profile URL slug (/u/<handle>)';
COMMENT ON COLUMN public.profiles.public_profile_enabled IS 'Public profile is reachable at /u/<handle>';
COMMENT ON COLUMN public.profiles.search_indexing IS 'Opt-in: allow search engines to index the public profile';
COMMENT ON COLUMN public.profiles.open_to_roles IS 'Owner-only signal. Never exposed publicly or to other users.';

-- profiles RLS (profiles_select / profiles_update in the initial schema) keeps every column,
-- including open_to_roles, visible to the owner only. Re-assert that RLS stays on.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==================== MILESTONES ====================

CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('job', 'promotion', 'learning', 'project', 'certification', 'talk', 'other')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  happened_on DATE NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'event', 'suggested')),
  source_ref TEXT CHECK (source_ref IS NULL OR char_length(source_ref) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.milestones IS 'Profile timeline (PRD area 7). Private unless visibility = public.';

CREATE INDEX IF NOT EXISTS milestones_user_happened_idx
  ON public.milestones (user_id, happened_on DESC);
CREATE UNIQUE INDEX IF NOT EXISTS milestones_user_source_ref_key
  ON public.milestones (user_id, source_ref)
  WHERE source_ref IS NOT NULL;

DROP TRIGGER IF EXISTS milestones_updated_at ON public.milestones;
CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS milestones_select_own ON public.milestones;
CREATE POLICY milestones_select_own ON public.milestones
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS milestones_insert_own ON public.milestones;
CREATE POLICY milestones_insert_own ON public.milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS milestones_update_own ON public.milestones;
CREATE POLICY milestones_update_own ON public.milestones
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS milestones_delete_own ON public.milestones;
CREATE POLICY milestones_delete_own ON public.milestones
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;

-- ==================== MILESTONE SUGGESTIONS ====================

CREATE TABLE IF NOT EXISTS public.milestone_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('job', 'promotion', 'learning', 'project', 'certification', 'talk', 'other')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  happened_on DATE NOT NULL,
  source_ref TEXT NOT NULL CHECK (char_length(source_ref) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_ref)
);

COMMENT ON TABLE public.milestone_suggestions IS 'Suggested milestones from events; the owner accepts or dismisses each one.';

CREATE INDEX IF NOT EXISTS milestone_suggestions_user_status_idx
  ON public.milestone_suggestions (user_id, status);

DROP TRIGGER IF EXISTS milestone_suggestions_updated_at ON public.milestone_suggestions;
CREATE TRIGGER milestone_suggestions_updated_at
  BEFORE UPDATE ON public.milestone_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.milestone_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS milestone_suggestions_select_own ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_select_own ON public.milestone_suggestions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS milestone_suggestions_update_own ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_update_own ON public.milestone_suggestions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS milestone_suggestions_delete_own ON public.milestone_suggestions;
CREATE POLICY milestone_suggestions_delete_own ON public.milestone_suggestions
  FOR DELETE USING (auth.uid() = user_id);

-- Suggestions are written only by the SECURITY DEFINER functions below; owners may change
-- the status (accept / dismiss) and nothing else.
GRANT SELECT, DELETE ON public.milestone_suggestions TO authenticated;
GRANT UPDATE (status) ON public.milestone_suggestions TO authenticated;
GRANT ALL ON public.milestone_suggestions TO service_role;

-- ==================== SUGGESTIONS FROM EVENTS ====================

-- Offers in Companies (status offered / hired) → "Got an offer from <company>".
CREATE OR REPLACE FUNCTION public.suggest_milestones_from_companies(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO milestone_suggestions (user_id, kind, title, happened_on, source_ref)
  SELECT c.user_id,
         'job',
         left('Got an offer from ' || btrim(c.name), 160),
         COALESCE(c.updated_at, NOW())::date,
         'company:' || c.id::text
    FROM companies c
   WHERE c.user_id = p_user
     AND c.status IN ('offered', 'hired')
     AND NOT EXISTS (
       SELECT 1 FROM milestones m WHERE m.user_id = c.user_id AND m.source_ref = 'company:' || c.id::text
     )
  ON CONFLICT (user_id, source_ref) DO NOTHING;
$$;

-- Finished learning paths (Learn, area 3, 20261024000600_learn.sql): a path is finished when
-- every lesson in it has path_progress.status = 'done'.
CREATE OR REPLACE FUNCTION public.suggest_milestones_from_paths(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO milestone_suggestions (user_id, kind, title, happened_on, source_ref)
  SELECT p_user,
         'learning',
         left('Finished a learning path: ' || btrim(p.title), 160),
         COALESCE(max(pp.completed_at), NOW())::date,
         'path:' || p.id::text
    FROM paths p
    JOIN path_lessons pl ON pl.path_id = p.id
    LEFT JOIN path_progress pp
      ON pp.lesson_id = pl.id AND pp.user_id = p_user AND pp.status = 'done'
   GROUP BY p.id, p.title
  HAVING count(pl.id) > 0
     AND count(pp.lesson_id) = count(pl.id)
     AND NOT EXISTS (
       SELECT 1 FROM milestones m WHERE m.user_id = p_user AND m.source_ref = 'path:' || p.id::text
     )
  ON CONFLICT (user_id, source_ref) DO NOTHING;
$$;

-- Learning entries the person shared to their profile (visibility = 'public').
CREATE OR REPLACE FUNCTION public.suggest_milestones_from_learning(p_user UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO milestone_suggestions (user_id, kind, title, happened_on, source_ref)
  SELECT e.user_id,
         'learning',
         left(COALESCE(NULLIF(btrim(e.title), ''), NULLIF(btrim(e.note), ''), e.url, 'Learning entry'), 160),
         e.created_at::date,
         'learning:' || e.id::text
    FROM learning_entries e
   WHERE e.user_id = p_user
     AND e.visibility = 'public'
     AND NOT EXISTS (
       SELECT 1 FROM milestones m WHERE m.user_id = e.user_id AND m.source_ref = 'learning:' || e.id::text
     )
  ON CONFLICT (user_id, source_ref) DO NOTHING;
$$;

-- Called by GET /api/milestones/suggestions. Fills suggestions for the caller and returns
-- how many are pending.
CREATE OR REPLACE FUNCTION public.refresh_milestone_suggestions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pending INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM suggest_milestones_from_companies(v_user);
  PERFORM suggest_milestones_from_paths(v_user);
  PERFORM suggest_milestones_from_learning(v_user);

  SELECT count(*) INTO v_pending
    FROM milestone_suggestions
   WHERE user_id = v_user AND status = 'pending';
  RETURN v_pending;
END;
$$;

-- An application moving to an offer suggests a milestone right away.
CREATE OR REPLACE FUNCTION public.companies_offer_milestone_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('offered', 'hired') AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM suggest_milestones_from_companies(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS companies_offer_milestone ON public.companies;
CREATE TRIGGER companies_offer_milestone
  AFTER INSERT OR UPDATE OF status ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_offer_milestone_suggestion();

REVOKE ALL ON FUNCTION public.suggest_milestones_from_companies(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suggest_milestones_from_paths(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suggest_milestones_from_learning(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.companies_offer_milestone_suggestion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_milestones_from_companies(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.suggest_milestones_from_paths(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.suggest_milestones_from_learning(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_milestone_suggestions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_milestone_suggestions() TO authenticated, service_role;

-- ==================== PUBLIC PROFILE READ ====================
-- The only way /u/[handle] reads data. Returns NULL unless the profile is enabled.
-- Never returns email, open_to_roles, private milestones or any other profile column.

CREATE OR REPLACE FUNCTION public.get_public_profile(p_handle TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
           'handle', p.public_handle,
           'full_name', p.full_name,
           'headline', p.headline,
           'search_indexing', p.search_indexing,
           'milestones', COALESCE((
             SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', m.id,
                        'kind', m.kind,
                        'title', m.title,
                        'description', m.description,
                        'happened_on', m.happened_on
                      ) ORDER BY m.happened_on DESC, m.created_at DESC)
               FROM (
                 SELECT * FROM milestones
                  WHERE user_id = p.id AND visibility = 'public'
                  ORDER BY happened_on DESC, created_at DESC
                  LIMIT 200
               ) m
           ), '[]'::jsonb),
           -- Learning entries shared to the profile ("Share to profile" in Learn). Read here,
           -- not through a broad RLS policy on learning_entries.
           'learning', COALESCE((
             SELECT jsonb_agg(
                      jsonb_build_object(
                        'id', e.id,
                        'kind', e.kind,
                        'title', e.title,
                        'url', e.url,
                        'note', left(e.note, 500),
                        'tags', e.tags,
                        'created_at', e.created_at
                      ) ORDER BY e.created_at DESC)
               FROM (
                 SELECT * FROM learning_entries
                  WHERE user_id = p.id AND visibility = 'public'
                  ORDER BY created_at DESC
                  LIMIT 50
               ) e
           ), '[]'::jsonb)
         )
    FROM profiles p
   WHERE p.public_profile_enabled
     AND p.public_handle IS NOT NULL
     AND p.public_handle = lower(btrim(p_handle))
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated, service_role;
