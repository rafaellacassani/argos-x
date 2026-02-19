
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  instance_name TEXT NOT NULL,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN DEFAULT false,
  direction TEXT NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_id TEXT,
  push_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_workspace ON public.whatsapp_messages(workspace_id);
CREATE INDEX idx_whatsapp_messages_jid ON public.whatsapp_messages(workspace_id, remote_jid);
CREATE INDEX idx_whatsapp_messages_timestamp ON public.whatsapp_messages(workspace_id, timestamp);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage whatsapp_messages"
  ON public.whatsapp_messages
  FOR ALL
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));
