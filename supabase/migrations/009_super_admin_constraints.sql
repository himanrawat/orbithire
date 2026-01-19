-- Enforce a single super admin
CREATE UNIQUE INDEX IF NOT EXISTS unique_super_admin
  ON admin_users ((role))
  WHERE role = 'super_admin';

-- Optional safety: if multiple super_admin rows existed before this migration,
-- the index creation would fail; resolve manually by keeping only one row with role='super_admin'.
