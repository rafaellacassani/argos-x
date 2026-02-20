
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  instance_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  filter_tag_ids JSONB DEFAULT '[]'::jsonb,
  filter_stage_ids JSONB DEFAULT '[]'::jsonb,
  filter_responsible_ids JSONB DEFAULT '[]'::jsonb,
  total_recipients INTEGER DEFAULT 0,
  interval_seconds INTEGER NOT NULL DEFAULT 30,
  schedule_start_time TIME,
  schedule_end_time TIME,
  schedule_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  personalized_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX idx_campaigns_workspace ON public.campaigns(workspace_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaign_recipients_pending ON public.campaign_recipients(campaign_id, status, position);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can manage campaigns"
  ON public.campaigns FOR ALL
  USING (workspace_id = get_user_workspace_id(auth.uid()))
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can manage campaign_recipients"
  ON public.campaign_recipients FOR ALL
  USING (campaign_id IN (SELECT id FROM public.campaigns WHERE workspace_id = get_user_workspace_id(auth.uid())))
  WITH CHECK (campaign_id IN (SELECT id FROM public.campaigns WHERE workspace_id = get_user_workspace_id(auth.uid())));
