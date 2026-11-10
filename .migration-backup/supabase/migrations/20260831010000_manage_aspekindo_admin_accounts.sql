-- Centralize the Aspekindo admin hierarchy:
-- penshopx@gmail.com is the bootstrap super admin; other accounts can only
-- receive the operational admin role through a super-admin-only RPC.

CREATE OR REPLACE FUNCTION public.is_aspekindo_bootstrap_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(coalesce((
    SELECT email FROM auth.users WHERE id = _user_id
  ), '')) = 'penshopx@gmail.com'
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_aspekindo_bootstrap_super_admin(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.is_super_admin(auth.uid())
$$;

-- Seed the bootstrap account when it already exists.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'penshopx@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Also bootstrap the account if it is created after this migration.
CREATE OR REPLACE FUNCTION public.bootstrap_aspekindo_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF lower(coalesce(NEW.email, '')) = 'penshopx@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bootstrap_aspekindo_super_admin_on_signup ON auth.users;
CREATE TRIGGER bootstrap_aspekindo_super_admin_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.bootstrap_aspekindo_super_admin();

-- Existing policies used has_role('admin'); keep them working for the
-- bootstrap account while preventing a regular admin from self-escalating.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _role = 'super_admin'::public.app_role THEN
      public.is_super_admin(_user_id)
    WHEN _role = 'admin'::public.app_role THEN
      public.is_super_admin(_user_id) OR EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      )
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can insert admin roles" ON public.user_roles;
CREATE POLICY "Super admins can insert admin roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND role = 'admin'::public.app_role
    AND NOT public.is_super_admin(user_id)
  );

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete admin roles" ON public.user_roles;
CREATE POLICY "Super admins can delete admin roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    AND role = 'admin'::public.app_role
    AND NOT public.is_super_admin(user_id)
  );

CREATE OR REPLACE FUNCTION public.grant_admin_role(_target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the bootstrap super admin can grant admin access';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user) THEN
    RAISE EXCEPTION 'Target user was not found';
  END IF;

  IF public.is_super_admin(_target_user) THEN
    RAISE EXCEPTION 'The bootstrap account is already the super admin';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_target_user, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_role(_target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the bootstrap super admin can revoke admin access';
  END IF;

  IF public.is_super_admin(_target_user) THEN
    RAISE EXCEPTION 'The bootstrap super admin cannot be revoked';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user
    AND role = 'admin'::public.app_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_directory()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  company text,
  is_admin boolean,
  is_super_admin boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the bootstrap super admin can view admin access';
  END IF;

  RETURN QUERY
  SELECT
    account.id,
    account.email::text,
    coalesce(profile.full_name, ''),
    coalesce(profile.company, ''),
    EXISTS (
      SELECT 1
      FROM public.user_roles role_row
      WHERE role_row.user_id = account.id
        AND role_row.role = 'admin'::public.app_role
    ),
    public.is_super_admin(account.id)
  FROM auth.users account
  LEFT JOIN public.profiles profile ON profile.user_id = account.id
  ORDER BY lower(coalesce(profile.company, '')), lower(coalesce(account.email, ''));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_aspekindo_bootstrap_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_admin_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_admin_directory() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_admin_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_directory() TO authenticated;