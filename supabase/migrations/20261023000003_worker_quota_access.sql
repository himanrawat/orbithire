-- Give trusted background workers a quota lookup that is not exposed to users.
-- The user-facing check_generation_quota remains bound to auth.uid().

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

