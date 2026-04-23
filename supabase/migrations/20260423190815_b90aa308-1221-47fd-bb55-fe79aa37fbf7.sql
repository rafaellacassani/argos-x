
-- Função idempotente para liberar agentes travados
CREATE OR REPLACE FUNCTION public.cleanup_stuck_agents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _unlocked_processing int;
  _resolved_tickets int;
  _resumed_sessions int;
BEGIN
  -- Liberar locks de processamento órfãos (>1h)
  UPDATE public.agent_memories
  SET is_processing=false, processing_started_at=NULL, updated_at=now()
  WHERE is_processing=true AND processing_started_at < now() - interval '1 hour';
  GET DIAGNOSTICS _unlocked_processing = ROW_COUNT;

  -- Auto-resolver tickets de suporte abandonados (>48h, sem assignee)
  WITH resolved AS (
    UPDATE public.human_support_queue
    SET status='resolved', resolved_at=now(), updated_at=now(),
        notes=COALESCE(notes,'') || ' [auto-resolvido por cron: abandonado +48h]'
    WHERE status IN ('waiting','in_progress')
      AND assigned_to IS NULL
      AND created_at < now() - interval '48 hours'
    RETURNING id, lead_id, session_id
  )
  SELECT COUNT(*) INTO _resolved_tickets FROM resolved;

  -- Retomar IA das sessões cujos tickets foram resolvidos agora
  UPDATE public.agent_memories am
  SET is_paused=false, updated_at=now()
  FROM public.human_support_queue hsq
  WHERE hsq.resolved_at > now() - interval '5 minutes'
    AND hsq.notes LIKE '%auto-resolvido por cron%'
    AND (
      (hsq.session_id IS NOT NULL AND am.session_id = hsq.session_id)
      OR (hsq.lead_id IS NOT NULL AND am.lead_id = hsq.lead_id)
    )
    AND am.is_paused = true;
  GET DIAGNOSTICS _resumed_sessions = ROW_COUNT;

  RETURN jsonb_build_object(
    'unlocked_processing', _unlocked_processing,
    'resolved_tickets', _resolved_tickets,
    'resumed_sessions', _resumed_sessions,
    'ran_at', now()
  );
END;
$$;

-- Agendar a cada hora
SELECT cron.schedule(
  'cleanup-stuck-agents-hourly',
  '15 * * * *',
  $$ SELECT public.cleanup_stuck_agents(); $$
);
