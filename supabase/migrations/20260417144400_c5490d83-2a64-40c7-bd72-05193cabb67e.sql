
-- 1. Tabela de Departamentos
CREATE TABLE public.ai_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Building2',
  color TEXT DEFAULT '#3b82f6',
  is_reception BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_departments_workspace ON public.ai_departments(workspace_id);

ALTER TABLE public.ai_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view departments"
ON public.ai_departments FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Workspace members can manage departments"
ON public.ai_departments FOR ALL
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())))
WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE TRIGGER update_ai_departments_updated_at
BEFORE UPDATE ON public.ai_departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Vínculo agente <-> departamento
ALTER TABLE public.ai_agents ADD COLUMN department_id UUID REFERENCES public.ai_departments(id) ON DELETE SET NULL;
CREATE INDEX idx_ai_agents_department ON public.ai_agents(department_id);

-- 3. Lock por lead (qual IA é a "dona" agora)
ALTER TABLE public.leads ADD COLUMN active_agent_id UUID;
ALTER TABLE public.leads ADD COLUMN active_department_id UUID;
ALTER TABLE public.leads ADD COLUMN active_agent_set_at TIMESTAMPTZ;
CREATE INDEX idx_leads_active_agent ON public.leads(active_agent_id) WHERE active_agent_id IS NOT NULL;

-- 4. Anti-loop em agent_memories
ALTER TABLE public.agent_memories ADD COLUMN transfer_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.agent_memories ADD COLUMN last_transfer_at TIMESTAMPTZ;

-- 5. Log de transferências
CREATE TABLE public.department_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  from_agent_id UUID,
  to_agent_id UUID,
  from_department_id UUID,
  to_department_id UUID,
  reason TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'ai_auto', -- 'ai_auto' | 'human' | 'rule'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_department_transfers_workspace ON public.department_transfers(workspace_id);
CREATE INDEX idx_department_transfers_lead ON public.department_transfers(lead_id);

ALTER TABLE public.department_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view transfers"
ON public.department_transfers FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Service role can insert transfers"
ON public.department_transfers FOR INSERT
WITH CHECK (true);

-- 6. Função atômica para reivindicar lock de um lead (anti-race condition)
CREATE OR REPLACE FUNCTION public.claim_lead_agent(
  _lead_id UUID,
  _agent_id UUID,
  _department_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed BOOLEAN := false;
BEGIN
  UPDATE public.leads
  SET active_agent_id = _agent_id,
      active_department_id = _department_id,
      active_agent_set_at = now()
  WHERE id = _lead_id
    AND (
      active_agent_id IS NULL
      OR active_agent_id = _agent_id
      OR active_agent_set_at < now() - interval '24 hours'
    );
  GET DIAGNOSTICS _claimed = ROW_COUNT;
  RETURN _claimed;
END;
$$;
