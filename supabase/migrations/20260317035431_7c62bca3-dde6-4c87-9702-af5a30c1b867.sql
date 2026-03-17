
-- Add rate_limit_per_hour to api_keys
ALTER TABLE public.api_keys ADD COLUMN rate_limit_per_hour integer NOT NULL DEFAULT 1000;

-- Webhooks table
CREATE TABLE public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Webhook delivery log
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS: webhooks - workspace admins only
CREATE POLICY "Admins can manage webhooks"
  ON public.webhooks
  FOR ALL
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- RLS: webhook_deliveries - workspace admins only
CREATE POLICY "Admins can view webhook_deliveries"
  ON public.webhook_deliveries
  FOR SELECT
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Indexes
CREATE INDEX idx_webhooks_workspace ON public.webhooks(workspace_id);
CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_api_key_usage_log_created ON public.api_key_usage_log(api_key_id, created_at);
