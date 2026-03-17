
-- Table: api_keys
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: api_key_usage_log
CREATE TABLE public.api_key_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS: api_keys - only workspace admins
CREATE POLICY "Admins can manage api_keys"
  ON public.api_keys
  FOR ALL
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (is_workspace_admin(auth.uid(), workspace_id));

-- RLS: api_key_usage_log - only workspace admins can view
CREATE POLICY "Admins can view api_key_usage_log"
  ON public.api_key_usage_log
  FOR SELECT
  TO authenticated
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Index for fast key lookups by hash
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_workspace ON public.api_keys(workspace_id);
CREATE INDEX idx_api_key_usage_log_key ON public.api_key_usage_log(api_key_id);
