-- Allow admins to grant a separate resume contact email without changing the login email
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS resume_email TEXT;
