
-- Create meta_conversations table for storing Meta platform messages
CREATE TABLE public.meta_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_page_id UUID REFERENCES public.meta_pages(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'facebook',
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  message_id TEXT,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX idx_meta_conversations_message_id ON public.meta_conversations(message_id) WHERE message_id IS NOT NULL;

-- Index for querying conversations by sender
CREATE INDEX idx_meta_conversations_sender ON public.meta_conversations(meta_page_id, sender_id, timestamp DESC);

-- Index for platform filtering
CREATE INDEX idx_meta_conversations_platform ON public.meta_conversations(platform);

-- Enable RLS
ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY;

-- Allow all (matching existing pattern in this project)
CREATE POLICY "Allow all on meta_conversations"
  ON public.meta_conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_conversations;
