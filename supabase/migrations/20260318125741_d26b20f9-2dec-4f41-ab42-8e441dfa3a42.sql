-- Normalize existing Brazilian phone numbers, skipping those that would create duplicates
UPDATE public.leads l
SET phone = '55' || regexp_replace(l.phone, '[^0-9]', '', 'g')
WHERE length(regexp_replace(l.phone, '[^0-9]', '', 'g')) IN (10, 11)
  AND regexp_replace(l.phone, '[^0-9]', '', 'g') NOT LIKE '55%'
  AND NOT EXISTS (
    SELECT 1 FROM public.leads l2
    WHERE l2.workspace_id = l.workspace_id
      AND l2.phone = '55' || regexp_replace(l.phone, '[^0-9]', '', 'g')
      AND l2.id != l.id
  );