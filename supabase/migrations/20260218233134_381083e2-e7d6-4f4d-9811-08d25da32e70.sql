
-- Adicionar coluna created_by
ALTER TABLE public.whatsapp_instances 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Remover política antiga
DROP POLICY IF EXISTS "Workspace members can manage whatsapp_instances" ON public.whatsapp_instances;

-- SELECT: admins/managers veem tudo, sellers só as suas
CREATE POLICY "Users can view own or admin view instances"
ON public.whatsapp_instances FOR SELECT
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR is_workspace_admin(auth.uid(), workspace_id)
    OR has_role(auth.uid(), 'manager')
  )
);

-- INSERT: qualquer membro do workspace pode criar
CREATE POLICY "Workspace members can insert instances"
ON public.whatsapp_instances FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id = get_user_workspace_id(auth.uid())
);

-- UPDATE: dono ou admin
CREATE POLICY "Owner or admin can update instances"
ON public.whatsapp_instances FOR UPDATE
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
);

-- DELETE: dono ou admin
CREATE POLICY "Owner or admin can delete instances"
ON public.whatsapp_instances FOR DELETE
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
);
