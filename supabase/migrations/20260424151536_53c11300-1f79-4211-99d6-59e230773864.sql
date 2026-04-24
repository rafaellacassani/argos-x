-- 1) Destrava agora a lead da Márcia (e todas no mesmo estado) cujo ticket já foi resolvido e não há ticket ativo
UPDATE public.agent_memories am
SET is_paused = false, is_processing = false, processing_started_at = NULL, updated_at = now()
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

-- 2) Anexa o trigger que reativa a IA quando um ticket é resolvido (estava sem trigger ligado!)
DROP TRIGGER IF EXISTS trg_auto_unpause_agent_on_resolve ON public.human_support_queue;
CREATE TRIGGER trg_auto_unpause_agent_on_resolve
AFTER UPDATE OF status ON public.human_support_queue
FOR EACH ROW
EXECUTE FUNCTION public.auto_unpause_agent_on_resolve();

-- 3) Alarga o filtro do cleanup_stuck_agents para reativar QUALQUER sessão cujo ticket foi auto-resolvido por cron, independente do texto exato em notes
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
BEGIN
  UPDATE public.agent_memories
  SET is_processing=false, processing_started_at=NULL, updated_at=now()
  WHERE is_processing=true AND processing_started_at < now() - interval '1 hour';
  GET DIAGNOSTICS _unlocked_processing = ROW_COUNT;

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

  -- Reativa qualquer sessão pausada cujo ticket esteja resolvido e sem ticket ativo
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

  RETURN jsonb_build_object(
    'unlocked_processing', _unlocked_processing,
    'resolved_tickets', _resolved_tickets,
    'resumed_sessions', _resumed_sessions,
    'ran_at', now()
  );
END;
$function$;