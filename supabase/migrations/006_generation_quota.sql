-- Generation Quota System
-- Adds free generation tracking and quota enforcement

-- 1. Add free_generations_used column to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS free_generations_used INTEGER DEFAULT 0;

-- 2. Create function to check if user can generate
-- Returns: can_generate, remaining, has_own_key, reason
CREATE OR REPLACE FUNCTION check_generation_quota(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_free_limit INTEGER := 2;
  v_remaining INTEGER;
  v_has_own_key BOOLEAN;
  v_can_generate BOOLEAN;
  v_reason TEXT;
BEGIN
  -- Get user settings
  SELECT
    ai_api_key_encrypted,
    free_generations_used
  INTO v_settings
  FROM user_settings
  WHERE user_id = p_user_id;

  -- If no settings found, user can generate (will use defaults, count as free)
  IF NOT FOUND THEN
    RETURN json_build_object(
      'can_generate', true,
      'remaining', v_free_limit,
      'has_own_key', false,
      'used', 0,
      'limit', v_free_limit,
      'reason', 'new_user'
    );
  END IF;

  -- Check if user has their own API key
  v_has_own_key := v_settings.ai_api_key_encrypted IS NOT NULL
                   AND v_settings.ai_api_key_encrypted != '';

  -- If user has own key, unlimited generations
  IF v_has_own_key THEN
    RETURN json_build_object(
      'can_generate', true,
      'remaining', -1,  -- -1 means unlimited
      'has_own_key', true,
      'used', v_settings.free_generations_used,
      'limit', v_free_limit,
      'reason', 'own_key'
    );
  END IF;

  -- Calculate remaining free generations
  v_remaining := v_free_limit - COALESCE(v_settings.free_generations_used, 0);
  v_can_generate := v_remaining > 0;

  IF v_can_generate THEN
    v_reason := 'free_tier';
  ELSE
    v_reason := 'quota_exceeded';
  END IF;

  RETURN json_build_object(
    'can_generate', v_can_generate,
    'remaining', GREATEST(v_remaining, 0),
    'has_own_key', false,
    'used', COALESCE(v_settings.free_generations_used, 0),
    'limit', v_free_limit,
    'reason', v_reason
  );
END;
$$;

-- 3. Create function to increment free generation count
-- Only increments if user is using free tier (no own key)
CREATE OR REPLACE FUNCTION increment_free_generation(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_own_key BOOLEAN;
BEGIN
  -- Check if user has their own API key
  SELECT (ai_api_key_encrypted IS NOT NULL AND ai_api_key_encrypted != '')
  INTO v_has_own_key
  FROM user_settings
  WHERE user_id = p_user_id;

  -- Only increment if user doesn't have their own key
  IF NOT v_has_own_key OR v_has_own_key IS NULL THEN
    -- Upsert to handle case where settings don't exist yet
    INSERT INTO user_settings (user_id, free_generations_used)
    VALUES (p_user_id, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET
      free_generations_used = COALESCE(user_settings.free_generations_used, 0) + 1,
      updated_at = NOW();
  END IF;
END;
$$;

-- 4. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_generation_quota(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_free_generation(UUID) TO authenticated;

-- 5. Add comment for documentation
COMMENT ON FUNCTION check_generation_quota IS 'Check if user can generate content. Returns quota status including remaining free generations.';
COMMENT ON FUNCTION increment_free_generation IS 'Increment free generation count for users without their own API key.';
