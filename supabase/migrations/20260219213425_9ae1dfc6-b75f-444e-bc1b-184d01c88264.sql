
-- Add new columns to ai_agents for knowledge base, behavior, and qualification
ALTER TABLE public.ai_agents 
  ADD COLUMN IF NOT EXISTS respond_to TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS respond_to_stages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS response_delay_seconds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_length TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS use_emojis BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS instance_name TEXT,
  ADD COLUMN IF NOT EXISTS company_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_products TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS knowledge_faq JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS knowledge_rules TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS knowledge_extra TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS qualification_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualification_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trainer_phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS agent_role TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT DEFAULT 'consultivo',
  ADD COLUMN IF NOT EXISTS main_objective TEXT DEFAULT 'vender',
  ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT '';
