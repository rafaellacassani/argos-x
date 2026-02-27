
-- Storage bucket for agent attachments (documents + style screenshots)
INSERT INTO storage.buckets (id, name, public) VALUES ('agent-attachments', 'agent-attachments', false);

-- Table to track agent attachments
CREATE TABLE public.agent_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'document' or 'style_screenshot'
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add website_url and style_analysis columns to ai_agents
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS style_analysis TEXT;

-- RLS for agent_attachments
ALTER TABLE public.agent_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage attachments in their workspace"
  ON public.agent_attachments
  FOR ALL
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

-- Storage RLS policies
CREATE POLICY "Users can upload agent attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'agent-attachments' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view agent attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agent-attachments' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete agent attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'agent-attachments' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.workspace_members WHERE user_id = auth.uid()));
