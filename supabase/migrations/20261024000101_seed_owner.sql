-- Seeds the single owner account (super_admin). No password is stored here: the row
-- gets an unusable hash, so nobody can sign in until scripts/set-owner-password.ts
-- sets a temporary password from OWNER_TEMP_PASSWORD. must_change_password then
-- forces a new password at first sign-in.

DO $$
DECLARE
  v_owner_email CONSTANT TEXT := 'hello@himanshurawat.in';
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id
    FROM public.admin_users
   WHERE lower(email) = v_owner_email;

  -- unique_super_admin allows one owner: hand any other super_admin the admin role.
  UPDATE public.admin_users
     SET role = 'admin', updated_at = NOW()
   WHERE role = 'super_admin'
     AND lower(email) <> v_owner_email;

  IF v_owner_id IS NULL THEN
    -- bcrypt hashes are 60 characters; this value can never match a password.
    INSERT INTO public.admin_users (email, password_hash, name, role, is_active, must_change_password)
    VALUES (v_owner_email, '!locked: run scripts/set-owner-password.ts', 'Owner', 'super_admin', TRUE, TRUE);
  ELSE
    -- An existing account keeps its password; it only becomes the owner.
    UPDATE public.admin_users
       SET role = 'super_admin', is_active = TRUE, updated_at = NOW()
     WHERE id = v_owner_id;
  END IF;
END $$;
