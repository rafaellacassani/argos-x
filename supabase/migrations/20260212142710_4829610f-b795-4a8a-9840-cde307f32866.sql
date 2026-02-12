
-- 1. Create helper function
CREATE OR REPLACE FUNCTION public.is_any_workspace_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id
      AND role = 'admin'
      AND accepted_at IS NOT NULL
  )
$$;

-- 2. Fix user_profiles policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;

CREATE POLICY "Authenticated can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_any_workspace_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (is_any_workspace_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles FOR DELETE
  TO authenticated
  USING (is_any_workspace_admin(auth.uid()));

-- 3. Fix user_roles policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Authenticated can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_any_workspace_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (is_any_workspace_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (is_any_workspace_admin(auth.uid()));

-- 4. Fix notification_settings policies
DROP POLICY IF EXISTS "Workspace members can manage notification_settings" ON public.notification_settings;

CREATE POLICY "Workspace members can manage notification_settings"
  ON public.notification_settings FOR ALL
  TO authenticated
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));
