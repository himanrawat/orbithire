-- Add message column to follow_ups table
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS message TEXT;

-- Add comment for documentation
COMMENT ON COLUMN follow_ups.message IS 'Reminder message to display to the user based on the application status';
