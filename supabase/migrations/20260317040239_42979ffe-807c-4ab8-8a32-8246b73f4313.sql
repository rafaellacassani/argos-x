
-- Enhance api_key_usage_log with audit fields
ALTER TABLE public.api_key_usage_log 
  ADD COLUMN ip_address text,
  ADD COLUMN user_agent text,
  ADD COLUMN latency_ms integer,
  ADD COLUMN rate_limited boolean NOT NULL DEFAULT false,
  ADD COLUMN idempotency_key text,
  ADD COLUMN payload_size integer;

-- Add allowed_agent_ids to api_keys for execute allowlist
ALTER TABLE public.api_keys
  ADD COLUMN allowed_agent_ids jsonb DEFAULT NULL,
  ADD COLUMN rate_limit_messages_per_min integer NOT NULL DEFAULT 30,
  ADD COLUMN rate_limit_executions_per_hour integer NOT NULL DEFAULT 60;

-- Add payload_id for webhook idempotency
ALTER TABLE public.webhook_deliveries
  ADD COLUMN payload_id text,
  ADD COLUMN next_retry_at timestamptz;

-- Index for idempotency key lookups
CREATE INDEX idx_api_key_usage_idempotency ON public.api_key_usage_log(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for webhook delivery retries
CREATE INDEX idx_webhook_deliveries_retry ON public.webhook_deliveries(status, next_retry_at) WHERE status = 'pending';
