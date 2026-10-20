-- Add job tracking fields to companies table
-- Applied automatically by `supabase start` / `supabase migration up` (see docs/DATABASE.md)

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS job_description TEXT,
ADD COLUMN IF NOT EXISTS job_url TEXT,
ADD COLUMN IF NOT EXISTS recruiter_name TEXT,
ADD COLUMN IF NOT EXISTS salary_range TEXT,
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ;

-- Add index for follow-up dates
CREATE INDEX IF NOT EXISTS idx_companies_follow_up ON companies(user_id, follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN companies.job_title IS 'The job position title being applied for';
COMMENT ON COLUMN companies.job_description IS 'Full job description text';
COMMENT ON COLUMN companies.job_url IS 'Link to the job posting';
COMMENT ON COLUMN companies.recruiter_name IS 'Name of recruiter or hiring manager';
COMMENT ON COLUMN companies.salary_range IS 'Expected or offered salary range';
COMMENT ON COLUMN companies.follow_up_date IS 'Date to follow up on the application';
