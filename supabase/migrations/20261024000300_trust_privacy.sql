-- Trust, privacy and compliance (NextMilestone PRD area 11)
--
-- 1. ai_generations: one row per AI output (feature, model, prompt version, item ref),
--    written by the app with the user's JWT (lib/ai/generations/log.ts).
-- 2. Contact submissions retention: messages older than 18 months are deleted by a
--    daily pg_cron job. Keep the default in step with CONTACT_RETENTION_MONTHS in
--    lib/privacy/retention.ts.

-- ==================== AI GENERATIONS ====================

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (char_length(feature) BETWEEN 1 AND 64),
  model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 200),
  provider TEXT CHECK (provider IS NULL OR char_length(provider) <= 200),
  prompt_version TEXT NOT NULL CHECK (char_length(prompt_version) BETWEEN 1 AND 100),
  item_type TEXT CHECK (item_type IS NULL OR char_length(item_type) <= 64),
  item_ref TEXT CHECK (item_ref IS NULL OR char_length(item_ref) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_user_created
  ON public.ai_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_item
  ON public.ai_generations(item_type, item_ref) WHERE item_ref IS NOT NULL;

COMMENT ON TABLE public.ai_generations IS
  'Log of AI-generated items: which model and prompt version produced what, for labeling and audit';
COMMENT ON COLUMN public.ai_generations.prompt_version IS 'PROMPT_VERSIONS in lib/prompts/versions.ts';
COMMENT ON COLUMN public.ai_generations.item_ref IS 'Id of the generated item (e.g. resumes.id) once it is saved; NULL for drafts';

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_generations_select_own ON public.ai_generations;
CREATE POLICY ai_generations_select_own ON public.ai_generations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ai_generations_insert_own ON public.ai_generations;
CREATE POLICY ai_generations_insert_own ON public.ai_generations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users may link a draft to the saved item, but not rewrite what produced it.
DROP POLICY IF EXISTS ai_generations_update_own ON public.ai_generations;
CREATE POLICY ai_generations_update_own ON public.ai_generations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.ai_generations FROM anon;
GRANT SELECT, INSERT ON public.ai_generations TO authenticated;
GRANT UPDATE (item_type, item_ref) ON public.ai_generations TO authenticated;
GRANT ALL ON public.ai_generations TO service_role;

-- ==================== CONTACT SUBMISSIONS RETENTION ====================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.purge_old_contact_submissions(p_months INTEGER DEFAULT 18)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_months IS NULL OR p_months < 1 THEN
    RAISE EXCEPTION 'purge_old_contact_submissions: p_months must be >= 1' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.contact_submissions
   WHERE created_at < NOW() - make_interval(months => p_months);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_contact_submissions(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_contact_submissions(INTEGER) TO service_role;

COMMENT ON FUNCTION public.purge_old_contact_submissions(INTEGER) IS
  'pg_cron 08:15 UTC daily: deletes contact_submissions older than p_months (default 18)';

-- cron.schedule(name, ...) upserts by job name, so re-running this migration is safe.
SELECT cron.schedule(
  'nextmilestone-contact-retention',
  '15 8 * * *',
  $cron$SELECT public.purge_old_contact_submissions()$cron$
);
