-- Interview prep, PRD area 4.
--
-- * questions: the shared question bank (curated sets and, later, approved user reports).
--   Readable by every signed-in user; written only by admins through the service role.
-- * question_reports: questions a user says they were asked in a real interview (R7).
-- * practice_attempts: one answer (typed or a voice transcript) and its AI feedback.
--   Feedback is written once by the API with the user's JWT; afterwards the user can only
--   flag it as wrong. No DELETE grant, so the monthly feedback count stays honest.
-- * interviews: an interview card tied to an application (companies row): date, round,
--   checklist and notes. Read by Today (rule 1: an interview within 3 days -> prep).
--
-- Practice happens before the interview, never during it (PRD non-goal).

-- ==================== QUESTIONS ====================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  role TEXT NOT NULL CHECK (role IN ('frontend_engineer', 'software_engineer')),
  topic TEXT NOT NULL CHECK (topic IN (
    'behavioral', 'javascript', 'react', 'web_fundamentals', 'system_design', 'leadership'
  )),
  level TEXT NOT NULL CHECK (level IN ('entry', 'mid', 'senior', 'lead')),
  stages TEXT[] NOT NULL DEFAULT '{}'
    CHECK (stages <@ ARRAY['recruiter_screen', 'technical_screen', 'onsite', 'system_design', 'hiring_manager']::TEXT[]),
  company_types TEXT[] NOT NULL DEFAULT '{}'
    CHECK (company_types <@ ARRAY['early_stage', 'growth', 'big_tech', 'enterprise']::TEXT[]),
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 10 AND 1000),
  framework_hint TEXT CHECK (framework_hint IS NULL OR char_length(framework_hint) <= 500),
  most_asked BOOLEAN NOT NULL DEFAULT FALSE,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('curated', 'user_reports')),
  source_note TEXT NOT NULL CHECK (char_length(source_note) BETWEEN 1 AND 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.questions IS 'Interview prep question bank (PRD area 4); every question shows its source';
COMMENT ON COLUMN public.questions.source_kind IS 'curated = written by our team; user_reports = reported by people who were asked it';
COMMENT ON COLUMN public.questions.source_note IS 'Shown under every question, e.g. "NextMilestone curated set, Oct 2026"';

CREATE INDEX IF NOT EXISTS idx_questions_filters ON public.questions(role, topic, level);
CREATE INDEX IF NOT EXISTS idx_questions_most_asked ON public.questions(most_asked) WHERE most_asked;
CREATE INDEX IF NOT EXISTS idx_questions_stages ON public.questions USING GIN (stages);
CREATE INDEX IF NOT EXISTS idx_questions_company_types ON public.questions USING GIN (company_types);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS questions_select_authenticated ON public.questions;
CREATE POLICY questions_select_authenticated ON public.questions
  FOR SELECT TO authenticated USING (TRUE);

REVOKE ALL ON public.questions FROM anon;
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

-- ==================== QUESTION REPORTS ====================

CREATE TABLE IF NOT EXISTS public.question_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_type TEXT CHECK (company_type IS NULL OR company_type IN ('early_stage', 'growth', 'big_tech', 'enterprise')),
  role TEXT CHECK (role IS NULL OR char_length(role) <= 120),
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 10 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.question_reports IS 'Questions users report being asked in real interviews (research R7); reviewed before joining the bank';

CREATE INDEX IF NOT EXISTS idx_question_reports_user ON public.question_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reports_question ON public.question_reports(question_id) WHERE question_id IS NOT NULL;

ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_reports_select_own ON public.question_reports;
CREATE POLICY question_reports_select_own ON public.question_reports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS question_reports_insert_own ON public.question_reports;
CREATE POLICY question_reports_insert_own ON public.question_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS question_reports_delete_own ON public.question_reports;
CREATE POLICY question_reports_delete_own ON public.question_reports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.question_reports FROM anon;
GRANT SELECT, INSERT, DELETE ON public.question_reports TO authenticated;
GRANT ALL ON public.question_reports TO service_role;

-- ==================== PRACTICE ATTEMPTS ====================

CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL CHECK (char_length(answer_text) BETWEEN 1 AND 10000),
  transcript TEXT CHECK (transcript IS NULL OR char_length(transcript) <= 20000),
  input_mode TEXT NOT NULL DEFAULT 'text' CHECK (input_mode IN ('text', 'voice')),
  feedback JSONB CHECK (feedback IS NULL OR jsonb_typeof(feedback) = 'object'),
  feedback_model TEXT CHECK (feedback_model IS NULL OR char_length(feedback_model) <= 200),
  mock_id UUID,
  flagged_wrong BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.practice_attempts IS 'Practice answers with AI feedback: one strength, one gap, one next read';
COMMENT ON COLUMN public.practice_attempts.transcript IS 'Raw voice transcript before the user edited it (answer_text holds the edited answer)';
COMMENT ON COLUMN public.practice_attempts.mock_id IS 'Groups the attempts of one timed 30-minute mock interview';
COMMENT ON COLUMN public.practice_attempts.flagged_wrong IS 'User reported the AI feedback as wrong';

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_created
  ON public.practice_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_question
  ON public.practice_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_flagged
  ON public.practice_attempts(created_at DESC) WHERE flagged_wrong;

ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS practice_attempts_select_own ON public.practice_attempts;
CREATE POLICY practice_attempts_select_own ON public.practice_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS practice_attempts_insert_own ON public.practice_attempts;
CREATE POLICY practice_attempts_insert_own ON public.practice_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS practice_attempts_update_own ON public.practice_attempts;
CREATE POLICY practice_attempts_update_own ON public.practice_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.practice_attempts FROM anon;
GRANT SELECT, INSERT ON public.practice_attempts TO authenticated;
GRANT UPDATE (flagged_wrong) ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;

-- ==================== INTERVIEWS ====================

CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  round TEXT NOT NULL DEFAULT 'technical_screen'
    CHECK (round IN ('recruiter_screen', 'technical_screen', 'onsite', 'system_design', 'hiring_manager', 'other')),
  company_type TEXT CHECK (company_type IS NULL OR company_type IN ('early_stage', 'growth', 'big_tech', 'enterprise')),
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(checklist) = 'array' AND jsonb_array_length(checklist) <= 20),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.interviews IS 'Interview cards linked to an application (companies row); Today rule 1 reads these';
COMMENT ON COLUMN public.interviews.checklist IS 'Array of {"id": text, "label": text, "done": bool}';

CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON public.interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_company ON public.interviews(company_id);

DROP TRIGGER IF EXISTS interviews_updated_at ON public.interviews;
CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS interviews_select_own ON public.interviews;
CREATE POLICY interviews_select_own ON public.interviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- The linked application must belong to the same user.
DROP POLICY IF EXISTS interviews_insert_own ON public.interviews;
CREATE POLICY interviews_insert_own ON public.interviews
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS interviews_update_own ON public.interviews;
CREATE POLICY interviews_update_own ON public.interviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS interviews_delete_own ON public.interviews;
CREATE POLICY interviews_delete_own ON public.interviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.interviews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
