
-- Table: email_accounts (OAuth credentials per workspace)
CREATE TABLE public.email_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'gmail',
  email_address text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry timestamptz NOT NULL,
  sync_cursor text,
  last_synced_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

-- Members can view email accounts in their workspace
CREATE POLICY "Workspace members can view email_accounts"
  ON public.email_accounts FOR SELECT
  USING (workspace_id = get_user_workspace_id(auth.uid()));

-- Only admins can insert/delete; users can insert their own
CREATE POLICY "Users can insert own email_accounts"
  ON public.email_accounts FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update own email_accounts"
  ON public.email_accounts FOR UPDATE
  USING (workspace_id = get_user_workspace_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Admins can delete email_accounts"
  ON public.email_accounts FOR DELETE
  USING (is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Users can delete own email_accounts"
  ON public.email_accounts FOR DELETE
  USING (workspace_id = get_user_workspace_id(auth.uid()) AND user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_email_accounts_updated_at
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: emails (cached emails)
CREATE TABLE public.emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_account_id uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  thread_id text,
  from_name text,
  from_email text,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  subject text,
  body_text text,
  body_html text,
  snippet text,
  folder text NOT NULL DEFAULT 'inbox',
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, provider_id)
);

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view emails"
  ON public.emails FOR SELECT
  USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update emails"
  ON public.emails FOR UPDATE
  USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can insert emails"
  ON public.emails FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can delete emails"
  ON public.emails FOR DELETE
  USING (workspace_id = get_user_workspace_id(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_emails_workspace_folder ON public.emails(workspace_id, folder);
CREATE INDEX idx_emails_account_id ON public.emails(email_account_id);
CREATE INDEX idx_emails_thread_id ON public.emails(thread_id);
CREATE INDEX idx_emails_received_at ON public.emails(received_at DESC);
CREATE INDEX idx_email_accounts_workspace ON public.email_accounts(workspace_id);

-- Enable realtime for emails
ALTER PUBLICATION supabase_realtime ADD TABLE public.emails;
