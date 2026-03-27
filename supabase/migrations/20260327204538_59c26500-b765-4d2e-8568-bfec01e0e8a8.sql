ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS ai_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_score_label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_scored_at timestamptz DEFAULT NULL;