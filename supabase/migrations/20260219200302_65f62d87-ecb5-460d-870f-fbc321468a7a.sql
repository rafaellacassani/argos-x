
-- Stage automations table
CREATE TABLE public.stage_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'on_enter',
  trigger_delay_hours INTEGER DEFAULT 0,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage stage_automations"
ON public.stage_automations FOR ALL TO authenticated
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE INDEX idx_stage_automations_stage_id ON public.stage_automations(stage_id);
CREATE INDEX idx_stage_automations_workspace_id ON public.stage_automations(workspace_id);

-- Stage automation queue for timed automations
CREATE TABLE public.stage_automation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.stage_automations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  execute_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stage_automation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage stage_automation_queue"
ON public.stage_automation_queue FOR ALL TO authenticated
USING (workspace_id = get_user_workspace_id(auth.uid()))
WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE INDEX idx_automation_queue_execute_at ON public.stage_automation_queue(execute_at) WHERE status = 'pending';
CREATE INDEX idx_automation_queue_workspace ON public.stage_automation_queue(workspace_id);
