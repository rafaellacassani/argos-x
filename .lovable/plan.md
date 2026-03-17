

## Problema

A aba "Webhooks" na documentação da API (Configurações → API Keys) descreve um fluxo que ainda não existe:
- `POST /v1/webhooks` para registrar webhooks
- Resposta com `secret: "whsec_..."` 
- `POST /v1/webhooks/test` para testar

Nenhum desses endpoints está implementado. O `WEBHOOK_SIGNING_SECRET` no vault é um secret interno do servidor — **não é o que o cliente usa**. Cada webhook registrado teria seu próprio secret individual.

## Plano: Implementar Webhooks v1 (Fase 2)

### 1. Migração de banco — tabela `webhooks` e `webhook_deliveries`

```sql
CREATE TABLE public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  api_key_id UUID REFERENCES api_keys(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret_hash TEXT NOT NULL,  -- SHA-256 do whsec_...
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB,
  status_code INT,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Com RLS para workspace_id.

### 2. Gateway — novos endpoints

No `api-gateway/index.ts`, adicionar:

| Endpoint | Scope | Descrição |
|---|---|---|
| `POST /v1/webhooks` | `webhooks:write` | Registra webhook, gera `whsec_...`, retorna o secret **uma única vez** |
| `GET /v1/webhooks` | `webhooks:read` | Lista webhooks do workspace |
| `DELETE /v1/webhooks/:id` | `webhooks:write` | Remove webhook |
| `POST /v1/webhooks/:id/test` | `webhooks:write` | Envia evento de teste |

Ao criar: gera `whsec_<random>`, salva `SHA-256(whsec_...)` no banco, retorna o raw secret na resposta.

### 3. Disparo de eventos

Função utilitária `fireWebhookEvent(supabase, workspaceId, eventType, data)` que:
- Busca webhooks ativos do workspace com o evento inscrito
- Assina payload com HMAC-SHA256 usando o secret
- Envia com headers `X-Argos-Signature`, `X-Argos-Event`, `X-Argos-Timestamp`, `X-Argos-Delivery-Id`
- Registra resultado em `webhook_deliveries`
- Retry com backoff (até 5 tentativas)

### 4. UI no painel — gerenciar webhooks

Adicionar na página de Configurações (ou dentro da aba Webhooks existente) uma seção funcional:
- Botão "Registrar Webhook" → form com URL + eventos
- Lista de webhooks ativos com toggle on/off e delete
- O secret `whsec_...` aparece **uma única vez** após criação (igual ao fluxo de API keys)
- Log de deliveries recentes por webhook

### 5. Atualizar OpenAPI spec

Incluir os endpoints de webhooks no `buildOpenApiSpec()`.

### 6. Novos scopes

Adicionar `webhooks:read` e `webhooks:write` aos scopes válidos no gateway e na UI de criação de API keys.

---

**Resumo**: O cliente obtém o `WEBHOOK_SIGNING_SECRET` **ao registrar um webhook** — seja via API ou via UI. O secret é exibido uma única vez e usado para validar as assinaturas HMAC nos eventos recebidos.

