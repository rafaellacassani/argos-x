ALTER TABLE public.client_invites 
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip text,
  ADD COLUMN IF NOT EXISTS terms_accepted_user_agent text,
  ADD COLUMN IF NOT EXISTS terms_version text;