-- Add bot_id column to funnel_stages to link automation
ALTER TABLE public.funnel_stages 
ADD COLUMN bot_id UUID REFERENCES public.salesbots(id) ON DELETE SET NULL;

-- Create bot_execution_logs table to track flow executions
CREATE TABLE public.bot_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.salesbots(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),
  message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_bot_logs_bot_id ON public.bot_execution_logs(bot_id);
CREATE INDEX idx_bot_logs_lead_id ON public.bot_execution_logs(lead_id);
CREATE INDEX idx_bot_logs_executed_at ON public.bot_execution_logs(executed_at DESC);

-- Enable RLS
ALTER TABLE public.bot_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on bot_execution_logs" 
ON public.bot_execution_logs 
FOR ALL 
USING (true) 
WITH CHECK (true);