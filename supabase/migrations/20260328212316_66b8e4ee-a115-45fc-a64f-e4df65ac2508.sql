
-- Table: pre_billing_cadence_config
CREATE TABLE public.pre_billing_cadence_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  assunto text NOT NULL,
  corpo text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_type)
);

ALTER TABLE public.pre_billing_cadence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can manage pre_billing_cadence_config"
  ON public.pre_billing_cadence_config
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table: pre_billing_email_logs
CREATE TABLE public.pre_billing_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  tipo_email text NOT NULL,
  timestamp_envio timestamptz NOT NULL DEFAULT now(),
  status_entrega text NOT NULL DEFAULT 'enviado',
  resend_message_id text,
  error_message text
);

ALTER TABLE public.pre_billing_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can manage pre_billing_email_logs"
  ON public.pre_billing_email_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
