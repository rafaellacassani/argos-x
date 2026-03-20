CREATE TRIGGER trg_queue_stage_automations
  AFTER INSERT OR UPDATE OF stage_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_stage_automations();