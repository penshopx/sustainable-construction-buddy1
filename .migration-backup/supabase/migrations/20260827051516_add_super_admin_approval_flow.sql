-- Add super_admin role tier + self-service admin request/approval flow.

-- 1. Extend the role enum with 'super_admin'.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Redefine has_role so that anywhere the app already checks for 'admin',
--    a 'super_admin' passes too. This means existing RLS policies across the
--    schema (all written as has_role(uid, 'admin')) keep working unchanged
--    for super admins, without having to touch every single policy.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin' AND role = 'super_admin')
      )
  )
$$;

-- 3. Table tracking self-service requests to become admin.
CREATE TABLE IF NOT EXISTS public.admin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

-- Only one pending request per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS admin_requests_one_pending_per_user
  ON public.admin_requests (user_id)
  WHERE status = 'pending';

ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own request or super admin views all" ON public.admin_requests;
CREATE POLICY "Users view own request or super admin views all"
  ON public.admin_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users create own request" ON public.admin_requests;
CREATE POLICY "Users create own request"
  ON public.admin_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admin updates requests" ON public.admin_requests;
CREATE POLICY "Super admin updates requests"
  ON public.admin_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 4. Approve/reject RPC: only a super_admin may call it. Approving grants
--    the 'admin' role atomically alongside marking the request reviewed.
CREATE OR REPLACE FUNCTION public.approve_admin_request(_request_id uuid, _approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_user uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super admin can review admin requests';
  END IF;

  SELECT user_id INTO _target_user
  FROM public.admin_requests
  WHERE id = _request_id AND status = 'pending';

  IF _target_user IS NULL THEN
    RAISE EXCEPTION 'Request not found or already reviewed';
  END IF;

  IF _approve THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.admin_requests
    SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE id = _request_id;
  ELSE
    UPDATE public.admin_requests
    SET status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE id = _request_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_admin_request(uuid, boolean) TO authenticated;
