-- Add interview_at column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ;
