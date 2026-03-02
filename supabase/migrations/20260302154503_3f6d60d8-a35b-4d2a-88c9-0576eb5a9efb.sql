
CREATE TABLE public.salesbot_wait_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.salesbots(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  wait_node_id text NOT NULL,
  target_node_id text NOT NULL,
  condition_id text NOT NULL,
  condition_type text NOT NULL,
  session_id text,
  execute_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  canceled_reason text,
  executed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_salesbot_wait_queue_status_execute ON public.salesbot_wait_queue (status, execute_at);
CREATE INDEX idx_salesbot_wait_queue_lead_node ON public.salesbot_wait_queue (lead_id, wait_node_id, status);
CREATE INDEX idx_salesbot_wait_queue_session ON public.salesbot_wait_queue (session_id, status);

ALTER TABLE public.salesbot_wait_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage salesbot_wait_queue"
  ON public.salesbot_wait_queue
  FOR ALL
  TO authenticated
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));
