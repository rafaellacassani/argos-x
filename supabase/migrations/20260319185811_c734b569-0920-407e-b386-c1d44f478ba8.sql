
-- Follow-up campaigns table
CREATE TABLE public.followup_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  meta_page_id uuid REFERENCES public.meta_pages(id),
  instance_name text,
  instance_type text NOT NULL DEFAULT 'evolution',
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id),
  context_prompt text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_contacts integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage followup_campaigns"
  ON public.followup_campaigns FOR ALL
  TO public
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- Follow-up campaign contacts table
CREATE TABLE public.followup_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.followup_campaigns(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  sender_id text,
  last_message_preview text,
  message_sent text,
  status text NOT NULL DEFAULT 'pending',
  skip_reason text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.followup_campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage followup_campaign_contacts"
  ON public.followup_campaign_contacts FOR ALL
  TO public
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

-- Enable realtime for progress tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_campaigns;
