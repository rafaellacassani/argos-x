-- The whatsapp_messages table has TWO unique indexes on message_id:
--   idx_whatsapp_messages_message_id        UNIQUE (workspace_id, message_id)
--   idx_whatsapp_messages_message_id_unique UNIQUE (message_id)
-- The global one is the correct dedup; the per-workspace one is redundant and
-- doubles every insert cost AND emits a second "duplicate key" error every time
-- the webhook re-receives a message (which is constant on busy instances).
-- Drop the redundant one.
DROP INDEX IF EXISTS public.idx_whatsapp_messages_message_id;
