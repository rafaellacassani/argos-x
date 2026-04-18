UPDATE public.agent_memories
SET is_paused = false, updated_at = now()
WHERE workspace_id = '41efdc6d-d4ba-4589-9761-7438a5911d57'
  AND session_id = '5511965700375@s.whatsapp.net'
  AND is_paused = true;