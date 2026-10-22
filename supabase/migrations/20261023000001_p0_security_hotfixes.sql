-- P0 security hotfixes: opaque admin sessions and atomic generation credits.

-- ==================== ADMIN SESSIONS ====================

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
  ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active
  ON public.admin_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_sessions FROM PUBLIC, anon, authenticated;

-- ==================== GENERATION CREDIT RESERVATIONS ====================

CREATE TABLE IF NOT EXISTS public.generation_credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charged BOOLEAN NOT NULL DEFAULT FALSE,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_credit_reservations_user
  ON public.generation_credit_reservations(user_id, created_at DESC);

ALTER TABLE public.generation_credit_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.generation_credit_reservations FROM PUBLIC, anon, authenticated;

-- Atomically decides eligibility and consumes a credit for the authenticated user.
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
      'reserved', TRUE,
      'charged', FALSE,
      'reservation_id', NULL,
      'remaining', -1,
      'reason', 'own_key'
    );
  END IF;

  IF v_profile.unlimited_access = TRUE
     AND (v_profile.unlimited_access_expires_at IS NULL
          OR v_profile.unlimited_access_expires_at > NOW()) THEN
    RETURN jsonb_build_object(
      'reserved', TRUE,
      'charged', FALSE,
      'reservation_id', NULL,
      'remaining', -1,
      'reason', 'unlimited_access'
    );
  END IF;

  IF COALESCE(v_profile.ai_credits, 2) <= 0 THEN
    RETURN jsonb_build_object(
      'reserved', FALSE,
      'charged', FALSE,
      'reservation_id', NULL,
      'remaining', 0,
      'reason', 'no_credits'
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
    'reserved', TRUE,
    'charged', TRUE,
    'reservation_id', v_reservation_id,
    'remaining', v_remaining,
    'reason', 'credit_reserved'
  );
END;
$$;

-- Refunds are server-only and idempotent. Ownership comes from the reservation,
-- so callers never supply an arbitrary user id.
CREATE OR REPLACE FUNCTION public.refund_generation_credit(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  UPDATE public.generation_credit_reservations
     SET refunded_at = NOW()
   WHERE id = p_reservation_id
     AND charged = TRUE
     AND refunded_at IS NULL
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
     SET ai_credits = COALESCE(ai_credits, 0) + 1,
         updated_at = NOW()
   WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_generation_credit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_generation_credit() TO authenticated;

REVOKE ALL ON FUNCTION public.refund_generation_credit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_generation_credit(UUID) TO service_role;

-- Keep the read-only compatibility API for existing clients, but bind it to
-- auth.uid() and reject attempts to inspect another user's quota.
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

-- Retire the arbitrary-user mutation APIs. Existing definitions remain only
-- for migration compatibility and are no longer callable by application users.
ALTER FUNCTION public.decrement_ai_credits(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_free_generation(UUID) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.decrement_ai_credits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_free_generation(UUID) FROM PUBLIC, anon, authenticated;

