-- Add recruiter_email to companies for contact tracking
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS recruiter_email TEXT;

COMMENT ON COLUMN companies.recruiter_email IS 'Email of recruiter or hiring manager';
