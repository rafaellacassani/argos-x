ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS annual_promo_expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_annual_promo_expires_at
ON public.workspaces (annual_promo_expires_at)
WHERE annual_promo_expires_at IS NOT NULL;