ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS website_content TEXT,
  ADD COLUMN IF NOT EXISTS website_scraped_at TIMESTAMPTZ;