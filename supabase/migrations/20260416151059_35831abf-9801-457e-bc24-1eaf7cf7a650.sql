
-- Add columns to support_tickets to link with leads and queue
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS lead_phone text,
  ADD COLUMN IF NOT EXISTS lead_name text,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS queue_item_id uuid;

-- Add ticket_id to human_support_queue
ALTER TABLE public.human_support_queue
  ADD COLUMN IF NOT EXISTS ticket_id uuid;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_lead_id ON public.support_tickets(lead_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_queue_item_id ON public.support_tickets(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_human_support_queue_ticket_id ON public.human_support_queue(ticket_id);
CREATE INDEX IF NOT EXISTS idx_human_support_queue_status ON public.human_support_queue(status);
CREATE INDEX IF NOT EXISTS idx_human_support_queue_lead_id ON public.human_support_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_human_support_queue_session_id ON public.human_support_queue(session_id);
