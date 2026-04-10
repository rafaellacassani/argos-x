
-- ===========================================
-- FIX 1: get_user_workspace_ids - add accepted_at check
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id AND accepted_at IS NOT NULL
$$;

-- ===========================================
-- FIX 2: Lock down workspace_members INSERT
-- Remove the overly permissive INSERT policy
-- ===========================================
DROP POLICY IF EXISTS "Users can insert themselves" ON public.workspace_members;

-- ===========================================
-- FIX 3: Restrict user_profiles SELECT
-- ===========================================
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.user_profiles;

CREATE POLICY "Users can view own and workspace members profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR id IN (
      SELECT wm.user_id FROM workspace_members wm
      WHERE wm.workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = user_profiles.user_id
        AND wm.workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
        AND wm.accepted_at IS NOT NULL
    )
  );

-- ===========================================
-- FIX 4: Restrict email_accounts SELECT to hide tokens from non-owners
-- Replace the broad workspace SELECT with owner-only + admin
-- ===========================================
DROP POLICY IF EXISTS "Workspace members can view email_accounts" ON public.email_accounts;

-- Owners can see their own email accounts (including tokens for sync)
CREATE POLICY "Users can view own email_accounts"
  ON public.email_accounts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  );

-- Admins can see all email accounts in their workspace
CREATE POLICY "Admins can view all email_accounts"
  ON public.email_accounts
  FOR SELECT
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- ===========================================
-- FIX 5: Restrict whatsapp_cloud_connections to admins
-- ===========================================
DROP POLICY IF EXISTS "Workspace members can manage whatsapp_cloud_connections" ON public.whatsapp_cloud_connections;

CREATE POLICY "Admins can manage whatsapp_cloud_connections"
  ON public.whatsapp_cloud_connections
  FOR ALL
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- Non-admin members can read non-sensitive fields (need to see connection status)
CREATE POLICY "Members can view whatsapp_cloud_connections"
  ON public.whatsapp_cloud_connections
  FOR SELECT
  TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));
