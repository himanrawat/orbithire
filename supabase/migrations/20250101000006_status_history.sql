-- Add status_history column to track all status changes
-- This logs every status change with timestamps

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN companies.status_history IS 'Array of status changes: [{from, to, changed_at}]';
