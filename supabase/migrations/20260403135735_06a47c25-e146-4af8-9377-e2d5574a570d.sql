-- Remove duplicates first (keep the most recent per workspace+phone_number_id)
DELETE FROM whatsapp_cloud_connections
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id, phone_number_id ORDER BY created_at DESC) as rn
    FROM whatsapp_cloud_connections
  ) sub WHERE rn > 1
);

-- Add unique constraint
ALTER TABLE whatsapp_cloud_connections
ADD CONSTRAINT whatsapp_cloud_connections_workspace_phone_unique
UNIQUE (workspace_id, phone_number_id);

-- Create audit log table
CREATE TABLE public.connection_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES whatsapp_cloud_connections(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  performed_by UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connection_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view connection_audit_log"
ON public.connection_audit_log
FOR SELECT
TO authenticated
USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE INDEX idx_connection_audit_log_workspace ON public.connection_audit_log(workspace_id);
CREATE INDEX idx_connection_audit_log_connection ON public.connection_audit_log(connection_id);