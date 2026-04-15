CREATE TABLE public.reactivation_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  asaas_customer_id TEXT,
  phone TEXT NOT NULL,
  client_name TEXT,
  plan_name TEXT,
  message_sent TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  campaign_batch TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage reactivation_campaigns"
  ON public.reactivation_campaigns
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_reactivation_campaigns_phone ON public.reactivation_campaigns (phone);
CREATE INDEX idx_reactivation_campaigns_batch ON public.reactivation_campaigns (campaign_batch);