-- Create ai_agents table for storing agent configurations
CREATE TABLE public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'sdr', -- sdr, support, scheduler, collector, custom
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperature DECIMAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  tools JSONB DEFAULT '[]'::jsonb, -- Array of enabled tools
  trigger_config JSONB DEFAULT '{}'::jsonb, -- When to activate the agent
  fallback_config JSONB DEFAULT '{}'::jsonb, -- What to do if fails
  pause_code TEXT DEFAULT '251213',
  resume_keyword TEXT DEFAULT 'Atendimento finalizado',
  message_split_enabled BOOLEAN DEFAULT true,
  message_split_length INTEGER DEFAULT 400,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on ai_agents" ON public.ai_agents
  FOR ALL USING (true) WITH CHECK (true);

-- Index for type lookup
CREATE INDEX idx_ai_agents_type ON public.ai_agents(type);
CREATE INDEX idx_ai_agents_active ON public.ai_agents(is_active);

-- Create agent_memories table for conversation history
CREATE TABLE public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- phone number of the lead
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {role, content, timestamp}
  summary TEXT, -- Generated summary periodically
  context_window INTEGER DEFAULT 50,
  is_paused BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, session_id)
);

-- Enable RLS
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on agent_memories" ON public.agent_memories
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookup
CREATE INDEX idx_agent_memories_session ON public.agent_memories(agent_id, session_id);
CREATE INDEX idx_agent_memories_lead ON public.agent_memories(lead_id);

-- Create agent_executions table for logging and analytics
CREATE TABLE public.agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id),
  session_id TEXT NOT NULL,
  input_message TEXT NOT NULL,
  output_message TEXT,
  tools_used JSONB DEFAULT '[]'::jsonb,
  tokens_used INTEGER,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, success, error, paused
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all on agent_executions" ON public.agent_executions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for analytics
CREATE INDEX idx_agent_executions_agent ON public.agent_executions(agent_id, executed_at DESC);
CREATE INDEX idx_agent_executions_status ON public.agent_executions(status);

-- Trigger for updated_at on ai_agents
CREATE TRIGGER update_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on agent_memories
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON public.agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();