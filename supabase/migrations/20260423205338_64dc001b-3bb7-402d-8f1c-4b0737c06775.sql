-- Trigger function: auto-unpause AI memory when support ticket is resolved
CREATE OR REPLACE FUNCTION public.auto_unpause_agent_on_resolve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when status transitions to 'resolved'
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    -- Primary: match by session_id within the same workspace
    IF NEW.session_id IS NOT NULL THEN
      UPDATE public.agent_memories
      SET is_paused = false,
          updated_at = now()
      WHERE workspace_id = NEW.workspace_id
        AND session_id = NEW.session_id
        AND is_paused = true;
    END IF;

    -- Fallback: match by lead_id within the same workspace
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE public.agent_memories
      SET is_paused = false,
          updated_at = now()
      WHERE workspace_id = NEW.workspace_id
        AND lead_id = NEW.lead_id
        AND is_paused = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_unpause_agent_on_resolve ON public.human_support_queue;

CREATE TRIGGER trg_auto_unpause_agent_on_resolve
AFTER UPDATE OF status ON public.human_support_queue
FOR EACH ROW
EXECUTE FUNCTION public.auto_unpause_agent_on_resolve();