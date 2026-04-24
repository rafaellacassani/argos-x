
CREATE OR REPLACE FUNCTION public.cleanup_stuck_agents()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _unlocked_processing int;
  _resolved_tickets int;
  _resumed_sessions int;
  _resumed_orphans int;
BEGIN
  -- 1) Destrava memórias presas em is_processing há mais de 1h
  UPDATE public.agent_memories
  SET is_processing=false, processing_started_at=NULL, updated_at=now()
  WHERE is_processing=true AND processing_started_at < now() - interval '1 hour';
  GET DIAGNOSTICS _unlocked_processing = ROW_COUNT;

  -- 2) Auto-resolve tickets abandonados há +48h sem assignee
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

  -- 3) Reativa memórias cujo ticket virou 'resolved' e não há outro ativo
  UPDATE public.agent_memories am
  SET is_paused=false, updated_at=now()
  WHERE am.is_paused = true
    AND EXISTS (
      SELECT 1 FROM public.human_support_queue hsq
      WHERE hsq.workspace_id = am.workspace_id
        AND (hsq.lead_id = am.lead_id OR hsq.session_id = am.session_id)
        AND hsq.status = 'resolved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.human_support_queue hsq2
      WHERE hsq2.workspace_id = am.workspace_id
        AND (hsq2.lead_id = am.lead_id OR hsq2.session_id = am.session_id)
        AND hsq2.status IN ('waiting','in_progress')
    );
  GET DIAGNOSTICS _resumed_sessions = ROW_COUNT;

  -- 4) [NOVO] Safety net: libera memórias órfãs (pausadas sem NENHUM ticket ativo)
  -- Pega is_paused=true há > 15min sem ticket waiting/in_progress correspondente
  UPDATE public.agent_memories am
  SET is_paused = false, updated_at = now()
  WHERE am.is_paused = true
    AND am.updated_at < now() - interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.human_support_queue hsq
      WHERE hsq.workspace_id = am.workspace_id
        AND hsq.status IN ('waiting','in_progress')
        AND ((hsq.lead_id IS NOT NULL AND hsq.lead_id = am.lead_id)
             OR (hsq.session_id IS NOT NULL AND hsq.session_id = am.session_id))
    );
  GET DIAGNOSTICS _resumed_orphans = ROW_COUNT;

  RETURN jsonb_build_object(
    'unlocked_processing', _unlocked_processing,
    'resolved_tickets', _resolved_tickets,
    'resumed_sessions', _resumed_sessions,
    'resumed_orphans', _resumed_orphans,
    'ran_at', now()
  );
END;
$function$;
