-- Today (home), PRD area 2.
--
-- * profiles.timezone: IANA zone used for the 6:30 AM daily plan (US-first default).
-- * daily_plans: one plan of 3-5 items per user per local date (RLS: own rows).
-- * tasks.type gains 'generate_daily_plan'.
-- * enqueue_due_daily_plans(): pg_cron every 15 minutes enqueues one task per user whose
--   local time is past 6:30 AM (within a catch-up window) and who has no plan for today.
--
-- Plan item shape (written by worker/orbithire_worker/today/plan.py and lib/today/nextStep.ts):
--   {"id": text, "kind": text, "title": text, "reason": text, "href": text, "done": bool}

-- ==================== PROFILES: TIME ZONE ====================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/New_York'
      CONSTRAINT profiles_timezone_valid CHECK (is_valid_timezone(timezone));
  END IF;
END;
$$;

COMMENT ON COLUMN profiles.timezone IS 'IANA time zone for the Today plan (generated at 6:30 AM local)';

-- ==================== DAILY PLANS ====================

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,                                   -- local date in profiles.timezone
  items JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 10),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'worker' CHECK (source IN ('worker', 'on_demand')),
  next_step_dismissed_at TIMESTAMPTZ,                   -- "Not today" on the next-step card
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

COMMENT ON TABLE daily_plans IS 'Today page: daily plan of 3-5 items per user per local date';

DROP TRIGGER IF EXISTS daily_plans_updated_at ON daily_plans;
CREATE TRIGGER daily_plans_updated_at
  BEFORE UPDATE ON daily_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE daily_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_plans_select_own ON daily_plans;
CREATE POLICY daily_plans_select_own ON daily_plans
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_plans_insert_own ON daily_plans;
CREATE POLICY daily_plans_insert_own ON daily_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_plans_update_own ON daily_plans;
CREATE POLICY daily_plans_update_own ON daily_plans
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_plans_delete_own ON daily_plans;
CREATE POLICY daily_plans_delete_own ON daily_plans
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON daily_plans TO authenticated;
GRANT ALL ON daily_plans TO service_role;

-- ==================== TASK TYPE ====================
-- Append 'generate_daily_plan' via the shared helper from 20261024000200_us_job_supply.sql,
-- so migrations that add task types compose.

SELECT public.extend_task_types(ARRAY['generate_daily_plan']);

-- ==================== DAILY ENQUEUE (cron) ====================
-- Users whose local time is between 06:30 and 08:30 (a catch-up window for missed ticks),
-- with no plan for their local date and no generate_daily_plan task pending.
-- One set-based INSERT; the worker builds the plan (handlers/daily_plan.py).

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, date DESC);

CREATE OR REPLACE FUNCTION enqueue_due_daily_plans()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO tasks (type, payload, priority, user_id)
  SELECT 'generate_daily_plan',
         jsonb_build_object('user_id', p.id, 'date', l.local_day, 'trigger', 'cron'),
         -1,
         p.id
    FROM profiles p
   CROSS JOIN LATERAL (
         SELECT (now() AT TIME ZONE p.timezone)::date AS local_day,
                (now() AT TIME ZONE p.timezone)::time AS local_time
         ) l
   WHERE l.local_time >= TIME '06:30'
     AND l.local_time < TIME '08:30'
     AND NOT EXISTS (
           SELECT 1 FROM daily_plans d
            WHERE d.user_id = p.id AND d.date = l.local_day
         )
     AND NOT EXISTS (
           SELECT 1 FROM tasks t
            WHERE t.type = 'generate_daily_plan'
              AND t.user_id = p.id
              AND t.status IN ('queued', 'running')
         );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION enqueue_due_daily_plans() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION enqueue_due_daily_plans() TO service_role;

COMMENT ON FUNCTION enqueue_due_daily_plans() IS
  'pg_cron every 15 min: one generate_daily_plan task per user past 6:30 AM local with no plan today';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      -- cron.schedule(job_name, ...) upserts by name, so rerunning is safe.
      EXECUTE $cmd$SELECT cron.schedule('nextmilestone-daily-plan', '*/15 * * * *', 'SELECT public.enqueue_due_daily_plans()')$cmd$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron daily plan schedule skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule enqueue_due_daily_plans() externally';
  END IF;
END;
$$;
