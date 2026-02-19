
-- Add plan/subscription columns to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'trial_manual',
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- Set existing workspaces to trial_manual with 30 days
UPDATE public.workspaces
SET trial_end = now() + INTERVAL '30 days'
WHERE trial_end IS NULL;

-- Indexes for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_subscription_status ON public.workspaces(subscription_status);
