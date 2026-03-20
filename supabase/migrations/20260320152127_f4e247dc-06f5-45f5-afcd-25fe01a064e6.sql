CREATE TABLE public.lead_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  fbclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage lead_attribution"
  ON public.lead_attribution FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));