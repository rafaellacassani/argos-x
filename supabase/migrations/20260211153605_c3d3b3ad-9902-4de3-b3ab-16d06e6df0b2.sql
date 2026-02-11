
-- Drop existing recursive policies
DROP POLICY IF EXISTS "Admins can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Members can view their workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON workspace_members;

-- Create a SECURITY DEFINER function to get user's workspace IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- SELECT: uses security definer function to avoid recursion
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- INSERT: user can insert themselves
CREATE POLICY "Users can insert themselves"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: admin check via security definer function
CREATE OR REPLACE FUNCTION public.is_workspace_admin(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id
    AND workspace_id = _workspace_id
    AND role = 'admin'
  )
$$;

CREATE POLICY "Admins can update members"
  ON workspace_members FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete members"
  ON workspace_members FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
