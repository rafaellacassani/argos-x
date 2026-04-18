
UPDATE public.agent_memories
SET is_paused = false, updated_at = now()
WHERE workspace_id = '41efdc6d-d4ba-4589-9761-7438a5911d57'
  AND agent_id = '8d0a9ecf-217a-4fac-a002-fa477c54c5d4'
  AND is_paused = true
  AND session_id IN (
    '551131644604@s.whatsapp.net','5511965700375@s.whatsapp.net','5527992426285@s.whatsapp.net',
    '554396368775@s.whatsapp.net','556184786626@s.whatsapp.net','556293148414@s.whatsapp.net',
    '558791961410@s.whatsapp.net'
  );

UPDATE public.agent_followup_queue
SET status = 'canceled', canceled_reason = 'manual_recovery_catchup'
WHERE workspace_id = '41efdc6d-d4ba-4589-9761-7438a5911d57'
  AND status = 'pending'
  AND session_id IN (
    '97057738063966@lid','229274095243379@lid','145861451489442@lid',
    '553298052413@s.whatsapp.net','556184786626@s.whatsapp.net','5511942577287@s.whatsapp.net',
    '551131644604@s.whatsapp.net','5511996336252@s.whatsapp.net','556293148414@s.whatsapp.net',
    '556798119205@s.whatsapp.net','558182119734@s.whatsapp.net','5511936232032@s.whatsapp.net',
    '5511965700375@s.whatsapp.net','254915452637394@lid','5516997074669@s.whatsapp.net',
    '558588329612@s.whatsapp.net','5511948502297@s.whatsapp.net','5517981825598@s.whatsapp.net',
    '558791961410@s.whatsapp.net','554396368775@s.whatsapp.net','5527992426285@s.whatsapp.net',
    '5511991166200@s.whatsapp.net','37319709073424@lid'
  );
