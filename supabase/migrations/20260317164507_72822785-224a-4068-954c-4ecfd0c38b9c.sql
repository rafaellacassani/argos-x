
-- 1. Custom field definitions per workspace
CREATE TABLE public.lead_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, field_key)
);

ALTER TABLE public.lead_custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage lead_custom_field_definitions"
ON public.lead_custom_field_definitions
FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- 2. Custom field values per lead
CREATE TABLE public.lead_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES public.lead_custom_field_definitions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, field_definition_id)
);

ALTER TABLE public.lead_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage lead_custom_field_values"
ON public.lead_custom_field_values
FOR ALL
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- 3. Add form_webhook_token to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS form_webhook_token TEXT DEFAULT encode(gen_random_bytes(24), 'hex');

-- 4. Add form_field_mapping to workspaces (JSON mapping config)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS form_field_mapping JSONB DEFAULT '{}'::jsonb;

-- 5. Add form_default_stage_id to workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS form_default_stage_id UUID;

-- 6. Indexes
CREATE INDEX idx_custom_field_defs_workspace ON public.lead_custom_field_definitions(workspace_id);
CREATE INDEX idx_custom_field_values_lead ON public.lead_custom_field_values(lead_id);
CREATE INDEX idx_custom_field_values_workspace ON public.lead_custom_field_values(workspace_id);
