-- Pricing and billing, PRD area 10.
--
-- * subscriptions: one row per user, mirrored from Stripe by the webhook
--   (app/api/billing/webhook). Users read their own row; only the service role writes.
-- * billing_events: processed Stripe event ids, so webhook retries are idempotent.
-- * billing_has_active_pro(): the single SQL definition of "has Pro right now".
-- * The generation-credit functions (20261023000001 / 20261023000003) learn that an
--   active Pro plan means unlimited generations, alongside an own API key and an
--   admin unlimited_access grant. Their behavior is otherwise unchanged.
-- * tasks.type gains 'billing_reminder' (the worker emails before an annual renewal).

-- ==================== SUBSCRIPTIONS ====================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  -- Stripe subscription status, or 'none' before the first checkout completes.
  status TEXT NOT NULL DEFAULT 'none' CHECK (status IN (
    'none', 'active', 'trialing', 'past_due', 'unpaid', 'canceled',
    'incomplete', 'incomplete_expired', 'paused'
  )),
  "interval" TEXT CHECK ("interval" IN ('month', 'year')),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- When the user ticked the auto-renewal consent box next to the checkout button.
  renewal_terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscriptions IS 'Billing plan per user, mirrored from Stripe by the webhook (service role writes only)';

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

-- ==================== BILLING EVENTS (IDEMPOTENCY) ====================

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.billing_events IS 'Stripe webhook events; processed_at set once handled (retries are skipped)';

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.billing_events TO service_role;

-- ==================== ACTIVE PRO CHECK ====================

-- Matches resolvePlan() in lib/billing/plan.ts: past_due keeps access while Stripe retries.
CREATE OR REPLACE FUNCTION public.billing_has_active_pro(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.subscriptions s
     WHERE s.user_id = p_user_id
       AND s.plan = 'pro'
       AND s.status IN ('active', 'trialing', 'past_due')
       AND (s.current_period_end IS NULL OR s.current_period_end > NOW() - INTERVAL '1 day')
  );
$$;

REVOKE ALL ON FUNCTION public.billing_has_active_pro(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_has_active_pro(UUID) TO service_role;

-- ==================== GENERATION CREDITS: PRO IS UNLIMITED ====================
-- Same bodies as 20261023000001 / 20261023000003 with one extra branch after the
-- own-key check.

CREATE OR REPLACE FUNCTION public.reserve_generation_credit()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_has_own_key BOOLEAN := FALSE;
  v_profile public.profiles%ROWTYPE;
  v_reservation_id UUID;
  v_remaining INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(ai_api_key_encrypted IS NOT NULL AND ai_api_key_encrypted <> '', FALSE)
    INTO v_has_own_key
    FROM public.user_settings
   WHERE user_id = v_user_id;

  SELECT * INTO v_profile
    FROM public.profiles
   WHERE id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_has_own_key, FALSE) THEN
    RETURN jsonb_build_object(
      'reserved', TRUE, 'charged', FALSE, 'reservation_id', NULL,
      'remaining', -1, 'reason', 'own_key'
    );
  END IF;

  IF public.billing_has_active_pro(v_user_id) THEN
    RETURN jsonb_build_object(
      'reserved', TRUE, 'charged', FALSE, 'reservation_id', NULL,
      'remaining', -1, 'reason', 'pro_plan'
    );
  END IF;

  IF v_profile.unlimited_access = TRUE
     AND (v_profile.unlimited_access_expires_at IS NULL
          OR v_profile.unlimited_access_expires_at > NOW()) THEN
    RETURN jsonb_build_object(
      'reserved', TRUE, 'charged', FALSE, 'reservation_id', NULL,
      'remaining', -1, 'reason', 'unlimited_access'
    );
  END IF;

  IF COALESCE(v_profile.ai_credits, 2) <= 0 THEN
    RETURN jsonb_build_object(
      'reserved', FALSE, 'charged', FALSE, 'reservation_id', NULL,
      'remaining', 0, 'reason', 'no_credits'
    );
  END IF;

  UPDATE public.profiles
     SET ai_credits = COALESCE(ai_credits, 2) - 1,
         updated_at = NOW()
   WHERE id = v_user_id
   RETURNING ai_credits INTO v_remaining;

  INSERT INTO public.generation_credit_reservations(user_id, charged)
  VALUES (v_user_id, TRUE)
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'reserved', TRUE, 'charged', TRUE, 'reservation_id', v_reservation_id,
    'remaining', v_remaining, 'reason', 'credit_reserved'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_generation_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_generation_credit() TO authenticated;

CREATE OR REPLACE FUNCTION public.check_generation_quota(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_has_own_key BOOLEAN := FALSE;
  v_remaining INTEGER;
BEGIN
  IF v_user_id IS NULL OR p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(ai_api_key_encrypted IS NOT NULL AND ai_api_key_encrypted <> '', FALSE)
    INTO v_has_own_key
    FROM public.user_settings
   WHERE user_id = v_user_id;

  IF COALESCE(v_has_own_key, FALSE) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', TRUE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', FALSE,
      'reason', 'own_key'
    );
  END IF;

  IF public.billing_has_active_pro(v_user_id) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', FALSE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', TRUE,
      'reason', 'pro_plan'
    );
  END IF;

  IF v_profile.unlimited_access = TRUE
     AND (v_profile.unlimited_access_expires_at IS NULL
          OR v_profile.unlimited_access_expires_at > NOW()) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', FALSE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', TRUE,
      'reason', 'unlimited_access'
    );
  END IF;

  v_remaining := GREATEST(COALESCE(v_profile.ai_credits, 2), 0);
  RETURN json_build_object(
    'can_generate', v_remaining > 0, 'remaining', v_remaining,
    'has_own_key', FALSE, 'credits', v_remaining, 'unlimited', FALSE,
    'reason', CASE WHEN v_remaining > 0 THEN 'credits_available' ELSE 'no_credits' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_generation_quota(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_generation_quota(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_generation_quota_server(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_has_own_key BOOLEAN := FALSE;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(ai_api_key_encrypted IS NOT NULL AND ai_api_key_encrypted <> '', FALSE)
    INTO v_has_own_key
    FROM public.user_settings
   WHERE user_id = p_user_id;

  IF COALESCE(v_has_own_key, FALSE) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', TRUE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', FALSE,
      'reason', 'own_key'
    );
  END IF;

  IF public.billing_has_active_pro(p_user_id) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', FALSE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', TRUE,
      'reason', 'pro_plan'
    );
  END IF;

  IF v_profile.unlimited_access = TRUE
     AND (v_profile.unlimited_access_expires_at IS NULL
          OR v_profile.unlimited_access_expires_at > NOW()) THEN
    RETURN json_build_object(
      'can_generate', TRUE, 'remaining', -1, 'has_own_key', FALSE,
      'credits', COALESCE(v_profile.ai_credits, 2), 'unlimited', TRUE,
      'reason', 'unlimited_access'
    );
  END IF;

  v_remaining := GREATEST(COALESCE(v_profile.ai_credits, 2), 0);
  RETURN json_build_object(
    'can_generate', v_remaining > 0, 'remaining', v_remaining,
    'has_own_key', FALSE, 'credits', v_remaining, 'unlimited', FALSE,
    'reason', CASE WHEN v_remaining > 0 THEN 'credits_available' ELSE 'no_credits' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_generation_quota_server(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_generation_quota_server(UUID) TO service_role;

-- ==================== TASK TYPE ====================

SELECT public.extend_task_types(ARRAY['billing_reminder']);
