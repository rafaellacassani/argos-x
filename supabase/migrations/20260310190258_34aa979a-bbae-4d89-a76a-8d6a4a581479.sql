-- Drop the partial index that doesn't work with PostgREST upsert
DROP INDEX IF EXISTS idx_meta_conversations_message_id;

-- Add a proper unique constraint on message_id
ALTER TABLE public.meta_conversations ADD CONSTRAINT uq_meta_conversations_message_id UNIQUE (message_id);