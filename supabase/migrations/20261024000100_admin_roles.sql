-- Admin and owner (PRD area 12): owner / admin / moderator roles and a forced
-- password change for temporary passwords. Sessions live in admin_sessions
-- (20261023000001); the cookie holds only an opaque token whose SHA-256 is stored.

-- ==================== ROLES ====================

UPDATE public.admin_users SET role = 'admin' WHERE role IS NULL;

ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'admin', 'moderator'));
ALTER TABLE public.admin_users ALTER COLUMN role SET DEFAULT 'admin';
ALTER TABLE public.admin_users ALTER COLUMN role SET NOT NULL;

COMMENT ON COLUMN public.admin_users.role IS
  'super_admin = the single owner (unique_super_admin index); admin = runs the product; moderator = moderation queue and contact inbox only.';

-- ==================== FORCED PASSWORD CHANGE ====================

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- ==================== RETIRE THE DEFAULT ACCESS CODE ====================

-- 20250101000010 seeded a public "ADMIN2024" signup code that stays valid for 30 days
-- after a fresh database is migrated. Nobody should be able to self-register with it.
UPDATE public.admin_access_codes
   SET is_active = FALSE
 WHERE code = 'ADMIN2024'
   AND used_by IS NULL;

-- ==================== SESSION HOUSEKEEPING ====================

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON public.admin_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_activity_action
  ON public.admin_activity_log(action, created_at DESC);

-- ==================== ROW LEVEL SECURITY ====================

-- Admin tables are server-only: the Next.js routes use the service role after
-- checking the admin session. RLS stays on with no policies, and the client roles
-- get no table privileges, so anon/authenticated keys can never read them.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_activity_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_access_codes FROM PUBLIC, anon, authenticated;
