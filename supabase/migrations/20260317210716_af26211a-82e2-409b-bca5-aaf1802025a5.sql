
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  pais TEXT DEFAULT 'Brasil',
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  municipio TEXT,
  estado TEXT,
  cep TEXT,
  socio_nome TEXT NOT NULL,
  socio_cpf TEXT,
  socio_email TEXT,
  socio_telefone TEXT,
  stakeholder_nome TEXT,
  stakeholder_email TEXT,
  financeiro_email TEXT,
  pacote TEXT NOT NULL DEFAULT 'Express',
  valor_negociado NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_extenso TEXT,
  data_inicio_pagamento DATE,
  negociacoes_personalizadas TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  stage TEXT NOT NULL DEFAULT 'Cancelado',
  closer TEXT,
  bdr TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_clients_cnpj ON public.clients(cnpj);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view clients"
  ON public.clients FOR SELECT
  USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can update clients"
  ON public.clients FOR UPDATE
  USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE POLICY "Workspace members can delete clients"
  ON public.clients FOR DELETE
  USING (workspace_id = get_user_workspace_id(auth.uid()));

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
