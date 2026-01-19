-- Admin System Migration
-- Adds admin users, credit management, and email change permissions

-- ==================== ADMIN USERS TABLE ====================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- ==================== ADMIN ACCESS CODES ====================

CREATE TABLE IF NOT EXISTS admin_access_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES admin_users(id),
  used_by UUID REFERENCES admin_users(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== UPDATE PROFILES FOR ADMIN FEATURES ====================

-- Add AI credits management fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS unlimited_access BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unlimited_access_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS can_change_email BOOLEAN DEFAULT FALSE;

-- ==================== EMAIL CHANGE AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS email_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  changed_by_admin BOOLEAN DEFAULT FALSE,
  admin_id UUID REFERENCES admin_users(id),
  required_verification BOOLEAN DEFAULT TRUE,
  verification_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_change_log_user ON email_change_log(user_id);

-- ==================== ADMIN ACTIVITY LOG ====================

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL,
  target_type TEXT, -- 'user', 'contact', 'settings', etc.
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_activity_admin ON admin_activity_log(admin_id);
CREATE INDEX idx_admin_activity_created ON admin_activity_log(created_at DESC);

-- ==================== UPDATE GENERATION QUOTA FUNCTION ====================

-- Drop and recreate the function to use new ai_credits field
CREATE OR REPLACE FUNCTION check_generation_quota(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile RECORD;
  v_settings RECORD;
  v_has_own_key BOOLEAN;
  v_can_generate BOOLEAN;
  v_remaining INTEGER;
  v_reason TEXT;
BEGIN
  -- Get user profile for credits
  SELECT
    ai_credits,
    unlimited_access,
    unlimited_access_expires_at
  INTO v_profile
  FROM profiles
  WHERE id = p_user_id;

  -- Get user settings for API key
  SELECT ai_api_key_encrypted
  INTO v_settings
  FROM user_settings
  WHERE user_id = p_user_id;

  -- Check if user has their own API key
  v_has_own_key := v_settings.ai_api_key_encrypted IS NOT NULL
                   AND v_settings.ai_api_key_encrypted != '';

  -- If user has own key, unlimited generations
  IF v_has_own_key THEN
    RETURN json_build_object(
      'can_generate', true,
      'remaining', -1,
      'has_own_key', true,
      'credits', COALESCE(v_profile.ai_credits, 2),
      'unlimited', false,
      'reason', 'own_key'
    );
  END IF;

  -- Check for unlimited access (admin granted)
  IF v_profile.unlimited_access = TRUE THEN
    -- Check if unlimited access has expired
    IF v_profile.unlimited_access_expires_at IS NULL OR v_profile.unlimited_access_expires_at > NOW() THEN
      RETURN json_build_object(
        'can_generate', true,
        'remaining', -1,
        'has_own_key', false,
        'credits', COALESCE(v_profile.ai_credits, 2),
        'unlimited', true,
        'unlimited_expires_at', v_profile.unlimited_access_expires_at,
        'reason', 'unlimited_access'
      );
    END IF;
  END IF;

  -- Use credits system
  v_remaining := COALESCE(v_profile.ai_credits, 2);
  v_can_generate := v_remaining > 0;

  IF v_can_generate THEN
    v_reason := 'credits_available';
  ELSE
    v_reason := 'no_credits';
  END IF;

  RETURN json_build_object(
    'can_generate', v_can_generate,
    'remaining', GREATEST(v_remaining, 0),
    'has_own_key', false,
    'credits', v_remaining,
    'unlimited', false,
    'reason', v_reason
  );
END;
$$;

-- ==================== UPDATE INCREMENT FUNCTION ====================

CREATE OR REPLACE FUNCTION decrement_ai_credits(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_own_key BOOLEAN;
  v_unlimited BOOLEAN;
  v_unlimited_expires TIMESTAMPTZ;
BEGIN
  -- Check if user has their own API key
  SELECT (ai_api_key_encrypted IS NOT NULL AND ai_api_key_encrypted != '')
  INTO v_has_own_key
  FROM user_settings
  WHERE user_id = p_user_id;

  -- Check for unlimited access
  SELECT unlimited_access, unlimited_access_expires_at
  INTO v_unlimited, v_unlimited_expires
  FROM profiles
  WHERE id = p_user_id;

  -- Don't decrement if user has own key or valid unlimited access
  IF v_has_own_key THEN
    RETURN;
  END IF;

  IF v_unlimited AND (v_unlimited_expires IS NULL OR v_unlimited_expires > NOW()) THEN
    RETURN;
  END IF;

  -- Decrement credits
  UPDATE profiles
  SET ai_credits = GREATEST(COALESCE(ai_credits, 2) - 1, 0),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION decrement_ai_credits(UUID) TO authenticated;

-- ==================== ROW LEVEL SECURITY ====================

-- Admin tables are accessed via service role only (no RLS policies needed for direct access)
-- API routes will use service role key for admin operations

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own email change history
CREATE POLICY email_change_log_select ON email_change_log
  FOR SELECT USING (auth.uid() = user_id);

-- ==================== TRIGGERS ====================

CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== INSERT DEFAULT ACCESS CODE ====================
-- This creates an initial access code for the first admin signup
-- Code: ADMIN2024 (you should change this after first use)

INSERT INTO admin_access_codes (code, expires_at)
VALUES ('ADMIN2024', NOW() + INTERVAL '30 days')
ON CONFLICT (code) DO NOTHING;
