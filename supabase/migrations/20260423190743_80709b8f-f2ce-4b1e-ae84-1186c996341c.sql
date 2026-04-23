
-- Resolver ticket órfão do workspace Contas Agil (Derzelay) e retomar IA
UPDATE public.human_support_queue 
SET status='resolved', resolved_at=now(), updated_at=now(),
    notes=COALESCE(notes,'') || ' [auto-resolvido: ticket sem lead_id, IA travada]'
WHERE workspace_id='9df5640c-2814-4e58-accb-749502dbdc63' AND status IN ('waiting','in_progress');

UPDATE public.agent_memories SET is_paused=false, updated_at=now()
WHERE agent_id='afae280d-52f3-4763-aa97-699ac4112038' AND is_paused=true;

-- Limpar processing travado há mais de 1h (libera locks órfãos)
UPDATE public.agent_memories 
SET is_processing=false, processing_started_at=NULL, updated_at=now()
WHERE is_processing=true AND processing_started_at < now() - interval '1 hour';

-- Auto-resolver tickets de suporte humano abandonados há mais de 48h sem assignee
-- (libera leads que ficaram presos esperando atendimento que nunca veio)
UPDATE public.human_support_queue
SET status='resolved', resolved_at=now(), updated_at=now(),
    notes=COALESCE(notes,'') || ' [auto-resolvido: abandonado há +48h sem assignee]'
WHERE status IN ('waiting','in_progress')
  AND assigned_to IS NULL
  AND created_at < now() - interval '48 hours';

-- Para os tickets auto-resolvidos acima, retomar a IA das sessões correspondentes
UPDATE public.agent_memories am
SET is_paused=false, updated_at=now()
FROM public.human_support_queue hsq
WHERE hsq.resolved_at > now() - interval '1 minute'
  AND hsq.notes LIKE '%auto-resolvido%'
  AND (
    (hsq.session_id IS NOT NULL AND am.session_id = hsq.session_id)
    OR (hsq.lead_id IS NOT NULL AND am.lead_id = hsq.lead_id)
  )
  AND am.is_paused = true;
