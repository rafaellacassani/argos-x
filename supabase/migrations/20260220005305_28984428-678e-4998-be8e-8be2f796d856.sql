-- CORREÇÃO: Restringir acesso a meta_accounts para admins do workspace
-- Edge Functions usam service_role e não são afetadas pelo RLS

-- meta_accounts: substituir política permissiva por políticas granulares (admin-only)
DROP POLICY IF EXISTS "Workspace members can manage meta_accounts" ON public.meta_accounts;

CREATE POLICY "Admins can select meta_accounts"
ON public.meta_accounts FOR SELECT
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can insert meta_accounts"
ON public.meta_accounts FOR INSERT
WITH CHECK (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can update meta_accounts"
ON public.meta_accounts FOR UPDATE
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can delete meta_accounts"
ON public.meta_accounts FOR DELETE
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);

-- meta_pages: substituir política permissiva por políticas granulares (admin-only)
DROP POLICY IF EXISTS "Workspace members can manage meta_pages" ON public.meta_pages;

CREATE POLICY "Admins can select meta_pages"
ON public.meta_pages FOR SELECT
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can insert meta_pages"
ON public.meta_pages FOR INSERT
WITH CHECK (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can update meta_pages"
ON public.meta_pages FOR UPDATE
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);

CREATE POLICY "Admins can delete meta_pages"
ON public.meta_pages FOR DELETE
USING (
  is_workspace_admin(auth.uid(), workspace_id)
);