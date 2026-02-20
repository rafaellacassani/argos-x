
-- Add lock columns to agent_memories
ALTER TABLE public.agent_memories
  ADD COLUMN IF NOT EXISTS is_processing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_message_id TEXT;

-- Create webhook_message_log for deduplication
CREATE TABLE IF NOT EXISTS public.webhook_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  workspace_id UUID,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_message_log_mid ON public.webhook_message_log(message_id);
CREATE INDEX idx_webhook_message_log_processed ON public.webhook_message_log(processed_at);

ALTER TABLE public.webhook_message_log ENABLE ROW LEVEL SECURITY;

-- Service-level access only (edge functions use service role key)
CREATE POLICY "Service role access on webhook_message_log" ON public.webhook_message_log
  FOR ALL USING (true) WITH CHECK (true);
