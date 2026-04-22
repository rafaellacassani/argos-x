ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS promo_campaign text,
  ADD COLUMN IF NOT EXISTS promo_starts_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS promo_locked_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_promo_trial boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workspaces_promo_campaign 
  ON public.workspaces(promo_campaign) 
  WHERE promo_campaign IS NOT NULL;