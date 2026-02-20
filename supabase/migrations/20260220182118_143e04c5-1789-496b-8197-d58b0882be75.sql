-- Create unique index on message_id for deduplication in sync
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id_unique 
ON public.whatsapp_messages (message_id) 
WHERE message_id IS NOT NULL;