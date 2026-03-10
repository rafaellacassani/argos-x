
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cloud_connection_id UUID NOT NULL REFERENCES public.whatsapp_cloud_connections(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'pt_BR',
  category TEXT NOT NULL DEFAULT 'MARKETING',
  status TEXT NOT NULL DEFAULT 'PENDING',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, template_id)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage whatsapp_templates"
  ON public.whatsapp_templates
  FOR ALL
  TO public
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- Add template fields to campaigns table
ALTER TABLE public.campaigns 
  ADD COLUMN template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN template_variables JSONB DEFAULT '[]'::jsonb;
