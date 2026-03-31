
-- Clean up duplicate active queue items: keep only the most recent per session_id
DELETE FROM public.human_support_queue a
USING public.human_support_queue b
WHERE a.session_id = b.session_id
  AND a.session_id IS NOT NULL
  AND a.status IN ('waiting', 'in_progress')
  AND b.status IN ('waiting', 'in_progress')
  AND a.created_at < b.created_at;

-- Clean up duplicate active queue items: keep only the most recent per lead_id
DELETE FROM public.human_support_queue a
USING public.human_support_queue b
WHERE a.lead_id = b.lead_id
  AND a.lead_id IS NOT NULL
  AND a.session_id IS NULL
  AND b.session_id IS NULL
  AND a.status IN ('waiting', 'in_progress')
  AND b.status IN ('waiting', 'in_progress')
  AND a.created_at < b.created_at;

-- Now create the unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_hsq_active_session 
  ON public.human_support_queue (session_id) 
  WHERE status IN ('waiting', 'in_progress') AND session_id IS NOT NULL;
