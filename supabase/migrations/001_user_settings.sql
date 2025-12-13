-- User Settings Table for API Keys and Preferences
-- Run this migration to add user_settings table

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- AI Provider Settings
  ai_provider TEXT DEFAULT 'groq' CHECK (ai_provider IN ('openai', 'groq', 'custom')),
  ai_api_key_encrypted TEXT,  -- Encrypted API key storage
  ai_base_url TEXT,           -- Custom base URL for custom providers
  ai_default_model TEXT,      -- Preferred model
  
  -- Connection status cache
  ai_connection_verified BOOLEAN DEFAULT FALSE,
  ai_last_verified_at TIMESTAMPTZ,
  
  -- Resume preferences
  default_template TEXT DEFAULT 'modern',
  default_country TEXT DEFAULT 'US',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- RLS Policy
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY user_settings_all ON user_settings 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated at trigger
CREATE TRIGGER user_settings_updated_at 
  BEFORE UPDATE ON user_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at();

-- Auto-create settings for new users
CREATE OR REPLACE FUNCTION handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create settings when profile is created
DROP TRIGGER IF EXISTS on_profile_created_settings ON profiles;
CREATE TRIGGER on_profile_created_settings
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_settings();
