
ALTER TABLE public.ai_agents 
  ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_sequence JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS followup_end_stage_id TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.agent_followup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  step_index INTEGER NOT NULL DEFAULT 0,
  execute_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  canceled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_followup_queue_pending ON public.agent_followup_queue(status, execute_at);
CREATE INDEX idx_followup_queue_session ON public.agent_followup_queue(session_id, status);

ALTER TABLE public.agent_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage agent_followup_queue"
  ON public.agent_followup_queue
  FOR ALL
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));
