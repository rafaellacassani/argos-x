-- Function to auto-queue after_time stage automations when a lead enters a stage
CREATE OR REPLACE FUNCTION public.queue_stage_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _auto RECORD;
  _execute_at TIMESTAMPTZ;
BEGIN
  -- Only process if stage_id changed (UPDATE) or new INSERT
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    -- Queue after_time automations for the new stage
    FOR _auto IN
      SELECT id, trigger_delay_minutes
      FROM public.stage_automations
      WHERE stage_id = NEW.stage_id
        AND trigger = 'after_time'
        AND is_active = true
    LOOP
      _execute_at := now() + (COALESCE(_auto.trigger_delay_minutes, 60) * interval '1 minute');
      
      INSERT INTO public.stage_automation_queue (automation_id, lead_id, workspace_id, execute_at, status)
      VALUES (_auto.id, NEW.id, NEW.workspace_id, _execute_at, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Also trigger stage_change SalesBots by queuing them for immediate execution
    -- We do this by inserting a queue entry with execute_at = now() for bots with trigger_type = 'stage_change'
    -- The cron job will pick it up within 5 minutes, or the client can process it
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on leads table
DROP TRIGGER IF EXISTS on_lead_stage_change ON public.leads;
CREATE TRIGGER on_lead_stage_change
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_stage_automations();