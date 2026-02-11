
-- ===== WORKSPACES =====
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can view their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can update" ON workspaces;

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Workspace admins can update"
  ON workspaces FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), id));

-- ===== WORKSPACE_MEMBERS =====
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can delete members" ON workspace_members;

CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users can insert themselves"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update members"
  ON workspace_members FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete members"
  ON workspace_members FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
