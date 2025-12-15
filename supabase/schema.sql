-- CVLeap AI Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PROFILES ====================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  headline TEXT,
  phone TEXT,
  location TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  avatar_url TEXT,
  avatar_key TEXT,
  
  -- Parsed resume data
  skills TEXT[] DEFAULT '{}',
  experience_summary TEXT,
  extended_profile TEXT, -- JSON: work_experience[], education[], custom_fields[], customSections[]
  
  -- Preferences
  target_job_titles TEXT[] DEFAULT '{}',
  preferred_locations TEXT[] DEFAULT '{}',
  work_type TEXT CHECK (work_type IN ('remote', 'hybrid', 'onsite')),
  salary_range TEXT,
  start_availability TEXT CHECK (start_availability IN ('immediately', '2weeks', '1month', 'flexible')),
  
  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 1,
  
  -- Notifications
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==================== COMPANIES ====================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT DEFAULT 'saved' CHECK (status IN ('saved', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_companies_status ON companies(user_id, status);

-- ==================== RESUMES ====================

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  
  -- Content
  content_json JSONB NOT NULL DEFAULT '{}',
  content_text TEXT,
  
  -- Generation context
  job_description TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  template TEXT NOT NULL DEFAULT 'modern',
  model_used TEXT DEFAULT 'quality' CHECK (model_used IN ('quality', 'fast')),
  
  -- Analysis
  keyword_analysis JSONB,
  bullet_variants JSONB,
  
  -- Storage
  pdf_url TEXT,
  pdf_key TEXT,
  docx_url TEXT,
  docx_key TEXT,
  
  -- Sharing
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  share_access_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_company_id ON resumes(company_id);
CREATE INDEX idx_resumes_share_token ON resumes(share_token) WHERE share_token IS NOT NULL;

-- ==================== COVER LETTERS ====================

CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  
  content TEXT NOT NULL,
  job_description TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  template TEXT NOT NULL DEFAULT 'professional',
  model_used TEXT DEFAULT 'quality' CHECK (model_used IN ('quality', 'fast')),
  
  pdf_url TEXT,
  pdf_key TEXT,
  docx_url TEXT,
  docx_key TEXT,
  
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  share_access_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX idx_cover_letters_company_id ON cover_letters(company_id);
CREATE INDEX idx_cover_letters_share_token ON cover_letters(share_token) WHERE share_token IS NOT NULL;

-- ==================== FOLLOW-UPS ====================

CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  
  -- Send tracking
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_method TEXT DEFAULT 'email' CHECK (sent_method IN ('email', 'linkedin', 'portal', 'other')),
  recipient_email TEXT,
  recipient_name TEXT,
  
  -- Reminder scheduling
  next_reminder_at TIMESTAMPTZ,
  reminder_cadence_days INTEGER DEFAULT 3,
  reminder_count INTEGER DEFAULT 0,
  max_reminders INTEGER DEFAULT 3,
  
  -- State
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'snoozed', 'stopped', 'completed')),
  snoozed_until TIMESTAMPTZ,
  response_received BOOLEAN DEFAULT FALSE,
  response_notes TEXT,
  
  -- Notification state
  last_notification_at TIMESTAMPTZ,
  last_notification_status TEXT CHECK (last_notification_status IN ('sent', 'failed', 'pending')),
  notification_retry_count INTEGER DEFAULT 0,
  opted_out BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX idx_follow_ups_next_reminder ON follow_ups(next_reminder_at) WHERE status = 'active';
CREATE INDEX idx_follow_ups_company ON follow_ups(company_id);

-- ==================== FOLLOW-UP NOTIFICATIONS ====================

CREATE TABLE IF NOT EXISTS follow_up_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follow_up_id UUID NOT NULL REFERENCES follow_ups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_pending ON follow_up_notifications(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_follow_up ON follow_up_notifications(follow_up_id);

-- ==================== FILE UPLOADS ====================

CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('resume', 'cover_letter', 'profile_photo', 'other')),
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  
  storage_key TEXT NOT NULL,
  storage_url TEXT,
  
  parsed_successfully BOOLEAN,
  parse_error TEXT,
  extracted_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);

-- ==================== SHARE LINKS ====================

CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  resource_type TEXT NOT NULL CHECK (resource_type IN ('resume', 'cover_letter')),
  resource_id UUID NOT NULL,
  
  token TEXT NOT NULL UNIQUE,
  is_public BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON share_links(token);
CREATE INDEX idx_share_links_resource ON share_links(resource_type, resource_id);

-- ==================== SHARE ACCESS LOG ====================

CREATE TABLE IF NOT EXISTS share_accesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX idx_share_accesses_link ON share_accesses(share_link_id);

-- ==================== USER ACTIVITY / ANALYTICS ====================

CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_event_type ON user_activities(event_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);

-- ==================== COUNTRY TEMPLATES ====================

CREATE TABLE IF NOT EXISTS country_templates (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  
  photo_allowed BOOLEAN DEFAULT TRUE,
  photo_required BOOLEAN DEFAULT FALSE,
  
  section_order TEXT[] DEFAULT '{"personal", "summary", "experience", "education", "skills"}',
  available_templates TEXT[] DEFAULT '{"modern", "professional", "minimal"}',
  default_template TEXT DEFAULT 'modern',
  
  date_format TEXT DEFAULT 'MMM YYYY',
  address_format TEXT DEFAULT 'city_state_country',
  
  prompt_additions TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common country templates
INSERT INTO country_templates (country_code, country_name, photo_allowed, photo_required, prompt_additions) VALUES
  ('US', 'United States', FALSE, FALSE, 'Do not include photo. Focus on achievements with metrics. Use action verbs.'),
  ('UK', 'United Kingdom', FALSE, FALSE, 'Do not include photo. Include achievements. Dates in DD MMM YYYY format.'),
  ('DE', 'Germany', TRUE, TRUE, 'Include professional photo. Include date of birth, nationality. Detailed education section.'),
  ('FR', 'France', TRUE, FALSE, 'Photo optional but common. Include date of birth. French CV format.'),
  ('NL', 'Netherlands', TRUE, FALSE, 'Photo optional. Include nationality if non-EU. Concise format.'),
  ('AU', 'Australia', FALSE, FALSE, 'No photo. Similar to US style. Include visa status if relevant.'),
  ('CA', 'Canada', FALSE, FALSE, 'No photo. Mix of US/UK styles. Bilingual consideration.'),
  ('IN', 'India', TRUE, FALSE, 'Photo common. Include personal details. Detailed format.')
ON CONFLICT (country_code) DO NOTHING;

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = id);

-- Companies: users can only access their own
CREATE POLICY companies_all ON companies FOR ALL USING (auth.uid() = user_id);

-- Resumes: users can access their own, public shares accessible to all
CREATE POLICY resumes_owner ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY resumes_public ON resumes FOR SELECT USING (is_public = TRUE);

-- Cover Letters: same as resumes
CREATE POLICY cover_letters_owner ON cover_letters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY cover_letters_public ON cover_letters FOR SELECT USING (is_public = TRUE);

-- Follow-ups: users can only access their own
CREATE POLICY follow_ups_all ON follow_ups FOR ALL USING (auth.uid() = user_id);

-- Notifications: users can only access their own
CREATE POLICY notifications_all ON follow_up_notifications FOR ALL USING (auth.uid() = user_id);

-- File uploads: users can only access their own
CREATE POLICY file_uploads_all ON file_uploads FOR ALL USING (auth.uid() = user_id);

-- Share links: users can manage their own
CREATE POLICY share_links_all ON share_links FOR ALL USING (auth.uid() = user_id);

-- Share accesses: service role only (no direct user access)
CREATE POLICY share_accesses_insert ON share_accesses FOR INSERT WITH CHECK (TRUE);

-- User activities: users can insert/read their own
CREATE POLICY user_activities_owner ON user_activities FOR ALL USING (auth.uid() = user_id);

-- Country templates: readable by all authenticated users
CREATE POLICY country_templates_read ON country_templates FOR SELECT TO authenticated USING (TRUE);

-- ==================== UPDATED_AT TRIGGER ====================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER cover_letters_updated_at BEFORE UPDATE ON cover_letters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER follow_ups_updated_at BEFORE UPDATE ON follow_ups FOR EACH ROW EXECUTE FUNCTION update_updated_at();
