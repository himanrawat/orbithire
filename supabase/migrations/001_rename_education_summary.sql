-- Migration: Rename education_summary to extended_profile
-- This column stores more than just education - it contains:
--   - work_experience[]
--   - education[]
--   - custom_fields[]
--   - customSections[] (e.g., Projects)
--
-- Run this in your Supabase SQL Editor BEFORE deploying the code changes

-- Step 1: Rename the column
ALTER TABLE profiles 
RENAME COLUMN education_summary TO extended_profile;

-- Step 2: Add a comment to document the column purpose
COMMENT ON COLUMN profiles.extended_profile IS 
'JSON storage for extended profile data: work_experience[], education[], custom_fields[], customSections[]';

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'extended_profile';
