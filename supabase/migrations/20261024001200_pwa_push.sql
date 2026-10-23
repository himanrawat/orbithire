-- PRD v2 area 8: Mobile (PWA) and web push.
--
-- * push_subscriptions: one row per browser push endpoint (endpoint is globally unique; the
--   last person to subscribe on a device owns it). Written through upsert_push_subscription()
--   so a shared device can move between accounts. The worker removes rows on 404/410.
-- * notification_preferences: per-person switches for each push type plus the morning-plan
--   email fallback. No row means the defaults below.
-- * push_events: subscribed / unsubscribed / denied per platform, so push opt-out can be
--   measured separately for iOS and Android (PRD Section 8).
-- * notification_deliveries: one row per sent reminder (worker-owned), so a follow-up or
--   interview is announced once.
-- * learning_entries.client_id: makes the offline log outbox idempotent.
-- * push_reminders task type + pg_cron schedule (every 15 minutes).

-- ==================== PUSH SUBSCRIPTIONS ====================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (char_length(endpoint) <= 2048 AND endpoint ~* '^https://'),
  p256dh TEXT NOT NULL CHECK (char_length(p256dh) <= 256),
  auth TEXT NOT NULL CHECK (char_length(auth) <= 64),
  platform TEXT NOT NULL DEFAULT 'other' CHECK (platform IN ('ios', 'android', 'desktop', 'other')),
  user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMPTZ,
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

COMMENT ON TABLE public.push_subscriptions IS 'Web push endpoints per device (PRD area 8); removed on 404/410';

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Inserts and updates go through upsert_push_subscription() (SECURITY DEFINER) so an
-- endpoint that belonged to another account on the same device is handed over cleanly.
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_platform TEXT,
  p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, platform, user_agent)
  VALUES (v_user, p_endpoint, p_p256dh, p_auth, p_platform, left(p_user_agent, 512))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        platform = EXCLUDED.platform,
        user_agent = EXCLUDED.user_agent,
        failed_count = 0
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ==================== NOTIFICATION PREFERENCES ====================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  morning_plan BOOLEAN NOT NULL DEFAULT TRUE,
  follow_ups BOOLEAN NOT NULL DEFAULT TRUE,
  interviews BOOLEAN NOT NULL DEFAULT TRUE,
  -- R9: when no push subscription works, the morning plan goes out by email instead.
  email_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notification_preferences IS 'Settings → Notifications: each push type is switchable; no row = defaults';

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
CREATE POLICY notification_preferences_select_own ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
CREATE POLICY notification_preferences_insert_own ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;
CREATE POLICY notification_preferences_update_own ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

-- ==================== PUSH EVENTS (opt-out metric) ====================

CREATE TABLE IF NOT EXISTS public.push_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'desktop', 'other')),
  event TEXT NOT NULL CHECK (event IN ('subscribed', 'unsubscribed', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_events_platform_created ON public.push_events(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_events_user ON public.push_events(user_id);

COMMENT ON TABLE public.push_events IS 'Push opt-in/opt-out events per platform (PRD: opt-out < 20% on each platform)';

ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_events_select_own ON public.push_events;
CREATE POLICY push_events_select_own ON public.push_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_events_insert_own ON public.push_events;
CREATE POLICY push_events_insert_own ON public.push_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.push_events TO authenticated;
GRANT ALL ON public.push_events TO service_role;

-- Admin stat: events per platform over the last N days (service role only).
CREATE OR REPLACE FUNCTION public.push_event_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE (platform TEXT, subscribed BIGINT, unsubscribed BIGINT, denied BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.platform,
         count(*) FILTER (WHERE e.event = 'subscribed'),
         count(*) FILTER (WHERE e.event = 'unsubscribed'),
         count(*) FILTER (WHERE e.event = 'denied')
    FROM push_events e
   WHERE e.created_at > now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)))
   GROUP BY e.platform
   ORDER BY e.platform;
$$;

REVOKE ALL ON FUNCTION public.push_event_stats(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_event_stats(INTEGER) TO service_role;

-- ==================== DELIVERIES (dedupe) ====================

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('morning_plan', 'follow_up', 'interview')),
  -- what was announced, e.g. the follow-up id and its reminder time
  ref TEXT NOT NULL CHECK (char_length(ref) <= 200),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, kind, ref)
);

COMMENT ON TABLE public.notification_deliveries IS 'Worker log of sent reminders, so each is sent once';

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_deliveries_select_own ON public.notification_deliveries;
CREATE POLICY notification_deliveries_select_own ON public.notification_deliveries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;

-- ==================== OFFLINE LOG OUTBOX ====================

ALTER TABLE public.learning_entries ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_entries_user_client_id_key'
  ) THEN
    ALTER TABLE public.learning_entries
      ADD CONSTRAINT learning_entries_user_client_id_key UNIQUE (user_id, client_id);
  END IF;
END;
$$;

COMMENT ON COLUMN public.learning_entries.client_id IS 'Generated by the browser for offline log entries; makes the sync idempotent';

-- ==================== REMINDER TASK + SCHEDULE ====================

SELECT public.extend_task_types(ARRAY['push_reminders']);

-- One global task per tick (the worker does one set-based scan), unless one is pending.
CREATE OR REPLACE FUNCTION public.enqueue_push_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO tasks (type, payload, priority)
  SELECT 'push_reminders', jsonb_build_object('trigger', 'cron'), -1
   WHERE NOT EXISTS (
     SELECT 1 FROM tasks t WHERE t.type = 'push_reminders' AND t.status IN ('queued', 'running')
   );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_push_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_push_reminders() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      EXECUTE $cmd$SELECT cron.schedule('nextmilestone-push-reminders', '*/15 * * * *', 'SELECT public.enqueue_push_reminders()')$cmd$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron push reminder schedule skipped: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule enqueue_push_reminders() externally';
  END IF;
END;
$$;
