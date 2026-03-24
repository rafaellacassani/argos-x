
-- Table for granular permissions per workspace member
CREATE TABLE public.member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- Page access: array of allowed route paths (null = all pages)
  allowed_pages text[] DEFAULT NULL,
  -- WhatsApp instance access: array of instance IDs (null = all instances)
  allowed_instance_ids uuid[] DEFAULT NULL,
  -- Lead permissions
  can_create_leads boolean NOT NULL DEFAULT true,
  can_edit_leads boolean NOT NULL DEFAULT true,
  can_delete_leads boolean NOT NULL DEFAULT false,
  -- Instance management
  can_create_instances boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: workspace members can read their own permissions
CREATE POLICY "Members can read own permissions"
  ON public.member_permissions FOR SELECT
  USING (workspace_id = get_user_workspace_id(auth.uid()));

-- Policy: admins can manage all permissions in their workspace
CREATE POLICY "Admins can manage permissions"
  ON public.member_permissions FOR ALL
  USING (is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));
