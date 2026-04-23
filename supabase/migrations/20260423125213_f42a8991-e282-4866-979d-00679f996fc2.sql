-- Cancel pending follow-ups for the lead Alexandro who already confirmed he is using the platform
UPDATE public.agent_followup_queue
SET status = 'canceled', canceled_reason = 'objective_completed_by_ai'
WHERE lead_id = '5750105c-e022-4f32-84b9-a0cf3745a584'
  AND status = 'pending';