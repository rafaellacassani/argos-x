
CREATE TABLE public.human_support_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  session_id text,
  reason text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'waiting',
  assigned_to uuid,
  instance_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.human_support_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage human_support_queue"
  ON public.human_support_queue
  FOR ALL
  TO public
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE INDEX idx_human_support_queue_workspace_status 
  ON public.human_support_queue(workspace_id, status);

CREATE INDEX idx_human_support_queue_lead 
  ON public.human_support_queue(lead_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.human_support_queue;
