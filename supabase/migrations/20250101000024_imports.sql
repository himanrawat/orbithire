-- Imports from the old ai-job-search workflow (docs/PLAN.md §4.7, Phase 6).
--
-- Imported resumes (source = 'import') are existing PDFs, not generated ones, so
-- they should not raise a "Resume Created ... generated successfully" notification
-- each (a one-time import adds dozens). Everything else is unchanged from
-- 20250101000007_notifications.sql.

CREATE OR REPLACE FUNCTION notify_resume_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.source = 'import' THEN
    RETURN NEW;
  END IF;
  PERFORM create_notification(
    NEW.user_id,
    'resume_created',
    'Resume Created',
    'Your resume "' || NEW.title || '" has been generated successfully.',
    'resume',
    NEW.id,
    '/resumes'
  );
  RETURN NEW;
END;
$$;

-- Imported PDFs use a deterministic key per user + file ({user}/resumes/import-<file>.pdf),
-- which is how a re-import detects files that are already there.
CREATE INDEX IF NOT EXISTS idx_resumes_import_key ON resumes(user_id, pdf_key) WHERE source = 'import';
CREATE INDEX IF NOT EXISTS idx_cover_letters_import_key ON cover_letters(user_id, pdf_key) WHERE source = 'import';
