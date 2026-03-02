
-- Global cadence config (one row, managed by super admin)
CREATE TABLE public.reactivation_cadence_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  cadence_days jsonb NOT NULL DEFAULT '[6, 7, 9, 14, 21]'::jsonb,
  whatsapp_instance_name text,
  whatsapp_template text NOT NULL DEFAULT 'Olá, {nome}! 👋

Seu período de teste no Argos X acabou. 😢

Não perca seus dados e leads! Reative agora com um plano a partir de R$ 47,90/mês.

👉 {link}

Qualquer dúvida, estamos aqui! 🚀',
  email_subject text NOT NULL DEFAULT 'Reative seu Argos X — seus leads estão esperando!',
  email_template text NOT NULL DEFAULT 'Olá, {nome}!

Seu período de teste no Argos X expirou. Mas seus dados continuam salvos!

Escolha um plano para continuar aproveitando:
- Funil de vendas inteligente
- Agente de IA 24h
- WhatsApp integrado

Ative agora: {link}

Equipe Argos X',
  send_whatsapp boolean NOT NULL DEFAULT true,
  send_email boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reactivation_cadence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can manage reactivation config"
ON public.reactivation_cadence_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Log of reactivation messages sent per workspace
CREATE TABLE public.reactivation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cadence_day integer NOT NULL,
  channel text NOT NULL, -- 'whatsapp' or 'email'
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reactivation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins can view reactivation_log"
ON public.reactivation_log
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_reactivation_cadence_config_updated_at
BEFORE UPDATE ON public.reactivation_cadence_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config row
INSERT INTO public.reactivation_cadence_config (id) VALUES (gen_random_uuid());
