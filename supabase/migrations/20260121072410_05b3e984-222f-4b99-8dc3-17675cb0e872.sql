-- Tabela para registrar instâncias WhatsApp criadas pelo CRM
CREATE TABLE public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Política pública temporária (pode ser refinada depois com autenticação)
CREATE POLICY "Allow all operations on whatsapp_instances" 
  ON public.whatsapp_instances FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Inserir a instância "vendas" que já existe
INSERT INTO public.whatsapp_instances (instance_name, display_name)
VALUES ('vendas', 'Vendas')
ON CONFLICT (instance_name) DO NOTHING;