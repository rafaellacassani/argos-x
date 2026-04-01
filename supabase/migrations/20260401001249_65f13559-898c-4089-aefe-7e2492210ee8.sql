ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe';