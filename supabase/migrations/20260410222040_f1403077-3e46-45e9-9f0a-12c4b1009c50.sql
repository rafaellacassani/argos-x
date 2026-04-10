ALTER TABLE public.agent_executions
  DROP CONSTRAINT agent_executions_lead_id_fkey,
  ADD CONSTRAINT agent_executions_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id)
    ON DELETE SET NULL;