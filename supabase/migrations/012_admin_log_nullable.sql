-- Allow deleting admins without FK errors: keep activity logs but null out admin_id

-- Make admin_id nullable
ALTER TABLE admin_activity_log
ALTER COLUMN admin_id DROP NOT NULL;

-- Drop existing FK and recreate with ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'admin_activity_log_admin_id_fkey'
      AND table_name = 'admin_activity_log'
  ) THEN
    ALTER TABLE admin_activity_log
    DROP CONSTRAINT admin_activity_log_admin_id_fkey;
  END IF;
END $$;

ALTER TABLE admin_activity_log
ADD CONSTRAINT admin_activity_log_admin_id_fkey
FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
