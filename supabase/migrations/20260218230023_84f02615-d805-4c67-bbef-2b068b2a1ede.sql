
-- Create a view that efficiently gets the latest message per conversation
-- This avoids fetching ALL messages and grouping client-side
CREATE OR REPLACE VIEW public.meta_conversation_summary AS
SELECT DISTINCT ON (meta_page_id, sender_id)
  meta_page_id,
  sender_id,
  sender_name,
  platform,
  content,
  message_type,
  direction,
  timestamp,
  workspace_id
FROM public.meta_conversations
ORDER BY meta_page_id, sender_id, timestamp DESC;
