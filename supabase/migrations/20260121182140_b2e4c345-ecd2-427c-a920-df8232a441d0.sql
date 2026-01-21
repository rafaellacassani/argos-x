-- Enum para status do lead
CREATE TYPE public.lead_status AS ENUM ('active', 'won', 'lost', 'archived');

-- Tabela de Funis
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Estágios/Fases do Funil
CREATE TABLE public.funnel_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#E5E7EB',
  position INTEGER NOT NULL DEFAULT 0,
  is_win_stage BOOLEAN DEFAULT false,
  is_loss_stage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Tags
CREATE TABLE public.lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  company TEXT,
  value DECIMAL(12, 2) DEFAULT 0,
  status lead_status NOT NULL DEFAULT 'active',
  stage_id UUID NOT NULL REFERENCES public.funnel_stages(id) ON DELETE RESTRICT,
  source TEXT DEFAULT 'manual',
  whatsapp_jid TEXT,
  instance_name TEXT,
  responsible_user TEXT,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de histórico de movimentação do lead
CREATE TABLE public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_stage_id UUID REFERENCES public.funnel_stages(id),
  to_stage_id UUID REFERENCES public.funnel_stages(id),
  performed_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de relação Lead-Tags (many-to-many)
CREATE TABLE public.lead_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.lead_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - can be restricted later with auth)
CREATE POLICY "Allow all on funnels" ON public.funnels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on funnel_stages" ON public.funnel_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lead_tags" ON public.lead_tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lead_history" ON public.lead_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on lead_tag_assignments" ON public.lead_tag_assignments FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX idx_leads_whatsapp_jid ON public.leads(whatsapp_jid);
CREATE INDEX idx_lead_history_lead_id ON public.lead_history(lead_id);
CREATE INDEX idx_funnel_stages_funnel_id ON public.funnel_stages(funnel_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_funnels_updated_at BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_funnel_stages_updated_at BEFORE UPDATE ON public.funnel_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default funnel with stages
INSERT INTO public.funnels (id, name, description, is_default) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Funil Principal', 'Funil padrão de vendas', true);

INSERT INTO public.funnel_stages (funnel_id, name, color, position, is_win_stage, is_loss_stage) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Leads de Entrada', '#E5E7EB', 0, false, false),
  ('00000000-0000-0000-0000-000000000001', 'Em Qualificação', '#0171C3', 1, false, false),
  ('00000000-0000-0000-0000-000000000001', 'Venda Fechada', '#22C55E', 2, true, false),
  ('00000000-0000-0000-0000-000000000001', 'Lixo', '#F87171', 3, false, true);

-- Insert default tags
INSERT INTO public.lead_tags (name, color) VALUES
  ('WhatsApp', '#25D366'),
  ('Quente', '#EF4444'),
  ('Morno', '#F59E0B'),
  ('Frio', '#3B82F6'),
  ('VIP', '#8B5CF6');

-- Enable realtime for leads table
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_stages;