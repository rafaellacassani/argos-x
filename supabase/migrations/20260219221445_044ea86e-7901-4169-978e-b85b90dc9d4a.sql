
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id 
  ON public.whatsapp_messages(workspace_id, message_id) 
  WHERE message_id IS NOT NULL;
