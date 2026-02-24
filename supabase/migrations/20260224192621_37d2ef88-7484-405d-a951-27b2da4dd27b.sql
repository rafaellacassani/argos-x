
-- 1. Expand enum
ALTER TYPE meta_platform ADD VALUE IF NOT EXISTS 'whatsapp_business';

-- 2. Create whatsapp_cloud_connections table
CREATE TABLE IF NOT EXISTS public.whatsapp_cloud_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  meta_page_id UUID REFERENCES public.meta_pages(id) ON DELETE SET NULL,
  inbox_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending',
  last_webhook_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_cloud_connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy
CREATE POLICY "Workspace members can manage whatsapp_cloud_connections"
  ON public.whatsapp_cloud_connections FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid()
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid()
  ));

-- 5. Indexes
CREATE INDEX idx_wcc_workspace ON public.whatsapp_cloud_connections(workspace_id);
CREATE INDEX idx_wcc_phone_number_id ON public.whatsapp_cloud_connections(phone_number_id);

-- 6. Trigger for updated_at
CREATE TRIGGER update_wcc_updated_at
  BEFORE UPDATE ON public.whatsapp_cloud_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
