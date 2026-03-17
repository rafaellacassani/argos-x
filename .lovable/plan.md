

## Situação Atual

**O que já funciona:**
- `POST /v1/leads` no API Gateway aceita: `name`, `phone`, `email`, `company`, `source`, `stage_id`, `responsible_user`, `value`
- Um site externo no Lovable **já pode** criar leads via API key + POST
- Webhooks outbound (nosso CRM dispara eventos) estão prontos

**O que falta (e você está pedindo):**
1. **Campos personalizados** — hoje a tabela `leads` tem campos fixos. Não existe `custom_fields` ou `lead_custom_fields`
2. **Webhook inbound** — um endpoint público que recebe dados de formulários externos sem precisar de API key (ou com token simples)
3. **Mapeamento de campos** — UI para o cliente configurar "campo X do formulário = campo Y do CRM"

## Plano de Implementação

### 1. Tabela `lead_custom_field_definitions` + `lead_custom_field_values`

Duas tabelas para campos dinâmicos por workspace:

```sql
-- Definições dos campos personalizados
CREATE TABLE lead_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,        -- slug: "cpf", "interesse", "origem_campanha"
  field_label TEXT NOT NULL,      -- "CPF", "Interesse", "Origem da Campanha"
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, date, select, boolean
  options JSONB DEFAULT '[]',     -- para tipo "select": ["Opção A", "Opção B"]
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, field_key)
);

-- Valores por lead
CREATE TABLE lead_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES lead_custom_field_definitions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lead_id, field_definition_id)
);
```

RLS via `workspace_id = get_user_workspace_id(auth.uid())`.

### 2. UI para gerenciar campos personalizados

Em **Configurações**, nova sub-aba "Campos de Lead" onde o admin pode:
- Criar campos (label, tipo, opções para select)
- Reordenar, ativar/desativar, excluir
- Preview dos campos que aparecem no formulário de lead

### 3. Campos personalizados visíveis na UI de Leads

- `CreateLeadDialog` e `LeadDetailModal` exibem os campos customizados do workspace
- `LeadSidePanel` mostra os valores preenchidos
- Exportação/importação de contatos inclui colunas extras

### 4. Endpoint público de inbound webhook para formulários

Nova edge function `form-webhook` com URL pública:

```
POST /functions/v1/form-webhook?token=<workspace_form_token>
```

- Token simples por workspace (armazenado em `workspaces.form_webhook_token`)
- Recebe JSON livre: `{ "name": "João", "phone": "27999...", "email": "...", "cpf": "...", ... }`
- Mapeia campos conhecidos (`name`, `phone`, `email`, `company`) direto para `leads`
- Campos extras são salvos em `lead_custom_field_values` usando o mapeamento configurado
- Retorna `{ lead_id, status: "created" | "updated" }`

### 5. UI de mapeamento de campos (Form Webhook Config)

Em Configurações → Webhooks (ou nova aba "Formulários"), o admin pode:
- Ver a URL do webhook + token (copiável)
- Configurar mapeamento: "campo do formulário" → "campo do CRM" (nativo ou personalizado)
- Definir o `stage_id` padrão para leads criados via formulário
- Testar com payload de exemplo

### 6. Atualizar API Gateway

`POST /v1/leads` passa a aceitar `custom_fields: { "cpf": "123...", "interesse": "Plano X" }` — o gateway resolve as definições e salva em `lead_custom_field_values`.

---

### Resumo do fluxo

```text
Site externo (formulário)
  → POST /functions/v1/form-webhook?token=xxx
    → Mapeia campos → Cria/atualiza lead + custom fields
      → Dispara evento webhook outbound "lead.created"
```

### Arquivos afetados

| Escopo | Arquivos |
|--------|----------|
| DB | 2 novas tabelas + coluna `form_webhook_token` em `workspaces` |
| Edge Function | `supabase/functions/form-webhook/index.ts` (novo) |
| Gateway | `supabase/functions/api-gateway/index.ts` (aceitar custom_fields) |
| UI Config | Novo componente `CustomFieldsManager.tsx` em settings |
| UI Config | Novo componente `FormWebhookConfig.tsx` em settings |
| UI Leads | `CreateLeadDialog`, `LeadDetailModal`, `LeadSidePanel` (exibir campos extras) |
| Hook | Novo `useCustomFields.ts` |

