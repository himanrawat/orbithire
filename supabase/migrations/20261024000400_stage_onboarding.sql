-- PRD v2, area 1: stage-aware onboarding.
-- Career stage, goals, target role and locations, weekly focus hours and the time the
-- 4-step setup was finished (or skipped) live on the profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS career_stage TEXT,
  ADD COLUMN IF NOT EXISTS goals TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_role TEXT,
  ADD COLUMN IF NOT EXISTS target_locations TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekly_focus_hours INTEGER,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_career_stage_check,
  ADD CONSTRAINT profiles_career_stage_check
    CHECK (career_stage IS NULL OR career_stage IN ('student', 'early', 'experienced', 'leader')),
  DROP CONSTRAINT IF EXISTS profiles_goals_limit_check,
  ADD CONSTRAINT profiles_goals_limit_check
    CHECK (cardinality(goals) <= 12),
  DROP CONSTRAINT IF EXISTS profiles_target_role_length_check,
  ADD CONSTRAINT profiles_target_role_length_check
    CHECK (target_role IS NULL OR char_length(target_role) <= 120),
  DROP CONSTRAINT IF EXISTS profiles_target_locations_limit_check,
  ADD CONSTRAINT profiles_target_locations_limit_check
    CHECK (cardinality(target_locations) <= 10),
  DROP CONSTRAINT IF EXISTS profiles_weekly_focus_hours_check,
  ADD CONSTRAINT profiles_weekly_focus_hours_check
    CHECK (weekly_focus_hours IS NULL OR weekly_focus_hours BETWEEN 0 AND 80);

-- People who signed up before this migration already know the app: don't send them
-- through setup. They can set their stage and goals in Settings.
UPDATE public.profiles
   SET onboarded_at = COALESCE(created_at, NOW())
 WHERE onboarded_at IS NULL;

-- RLS: profiles already allows each user to select and update only their own row
-- (profiles_select / profiles_update in the initial schema); the new columns inherit it.
-- Re-assert that RLS stays on.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
