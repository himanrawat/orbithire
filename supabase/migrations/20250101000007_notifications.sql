-- Notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL CHECK (type IN ('resume_created', 'resume_downloaded', 'interview_reminder', 'follow_up_reminder', 'application_update', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Related resources (optional)
  resource_type TEXT CHECK (resource_type IN ('resume', 'company', 'interview', 'follow_up')),
  resource_id UUID,

  -- Link to navigate to when clicked
  action_url TEXT,

  -- State
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only access their own notifications
CREATE POLICY notifications_all ON notifications FOR ALL USING (auth.uid() = user_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id, action_url)
  VALUES (p_user_id, p_type, p_title, p_message, p_resource_type, p_resource_id, p_action_url)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when a resume is created
CREATE OR REPLACE FUNCTION notify_resume_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'resume_created',
    'Resume Created',
    'Your resume "' || NEW.title || '" has been generated successfully.',
    'resume',
    NEW.id,
    '/resumes'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_resume_created ON resumes;
CREATE TRIGGER on_resume_created
  AFTER INSERT ON resumes
  FOR EACH ROW EXECUTE FUNCTION notify_resume_created();
