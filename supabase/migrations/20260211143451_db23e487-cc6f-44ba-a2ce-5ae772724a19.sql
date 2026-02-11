
-- Create scheduled_messages table
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Message content
  message TEXT NOT NULL,
  -- When to send
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- Channel routing info
  channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'meta_facebook', 'meta_instagram')),
  -- WhatsApp fields
  instance_name TEXT,
  remote_jid TEXT,
  phone_number TEXT,
  -- Meta fields
  meta_page_id UUID REFERENCES public.meta_pages(id),
  sender_id TEXT,
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  -- Chat display info
  contact_name TEXT,
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy - authenticated users can manage
CREATE POLICY "Authenticated users can manage scheduled_messages"
  ON public.scheduled_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for the cron job to find pending messages efficiently
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages (scheduled_at)
  WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
