-- Pin search_path on SECURITY DEFINER functions.
-- Triggers on auth.users run as supabase_auth_admin, whose search_path does not
-- include public, so unqualified table names (e.g. profiles) fail to resolve on
-- self-hosted Supabase. Pinning search_path also prevents search_path hijacking.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
  END LOOP;
END $$;
