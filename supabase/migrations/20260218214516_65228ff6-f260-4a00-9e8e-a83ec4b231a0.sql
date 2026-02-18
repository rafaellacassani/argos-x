
-- Table to track user login sessions
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  device_label text, -- e.g. "Chrome on Windows"
  city text,
  region text,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can view sessions
CREATE POLICY "Admins can view sessions"
  ON public.user_sessions
  FOR SELECT
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (edge function uses service role)
-- No insert policy needed for authenticated users since edge function uses service role

-- Admins can update sessions (to deactivate)
CREATE POLICY "Admins can update sessions"
  ON public.user_sessions
  FOR UPDATE
  USING (is_workspace_admin(auth.uid(), workspace_id));

-- Index for quick lookups
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_workspace_id ON public.user_sessions(workspace_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;
