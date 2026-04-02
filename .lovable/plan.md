

## Página "Plano & Faturamento" — Reformulação

### Situação atual
A página `/planos` mostra apenas os cards de planos disponíveis para assinar e pacotes de leads. Não mostra:
- Qual plano está ativo e seu status (trial, ativo, vencido)
- Data do trial / próxima cobrança
- Provedor de pagamento (Asaas ou Stripe)
- Histórico de pagamentos
- Uso atual (leads, IA, WhatsApp, usuários)

### O que será construído

A página será reorganizada em **3 seções**:

**Seção 1 — Resumo do plano ativo** (card no topo)
- Nome do plano (Essencial, Negócio, Escala)
- Status: Trial (X dias restantes), Ativo, Vencido, Cancelado
- Data de início / fim do trial
- Barras de uso: leads, interações IA, conexões WhatsApp, usuários
- Botão "Trocar plano" que rola para a seção de planos

**Seção 2 — Histórico de pagamentos** (tabela)
- Consultado via nova action na edge function `admin-clients` (ou query direta na tabela de workspaces + Asaas API)
- Como não existe tabela de histórico de pagamentos no banco, e o Asaas/Stripe guardam isso externamente, a abordagem mais prática é:
  - Mostrar dados disponíveis localmente: `plan_type`, `plan_name`, `trial_end`, `created_at`, `payment_provider`
  - Para histórico real de faturas, criar uma **nova edge function** `billing-portal` que consulta a API do Asaas (`/payments?subscription=`) ou Stripe (`listInvoices`) e retorna as faturas ao frontend
- Colunas: Data, Descrição, Valor, Status (pago/pendente/falhou)

**Seção 3 — Planos disponíveis e Pacotes de leads** (o conteúdo atual, mantido abaixo)

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/Planos.tsx` | Adicionar seção de resumo do plano + seção de histórico + reorganizar layout |
| `src/hooks/usePlanLimits.ts` | Já fornece os dados de uso — sem mudança |
| `src/hooks/useWorkspace.tsx` | Já expõe `workspace.plan_type`, `trial_end`, etc — sem mudança |
| `supabase/functions/billing-portal/index.ts` | **Nova edge function** que consulta faturas no Asaas (ou Stripe conforme `payment_provider`) e retorna ao frontend |

### Detalhes técnicos

**Edge function `billing-portal`**:
- Recebe `{ workspaceId }` no body
- Autentica o usuário via token JWT
- Busca o workspace para pegar `payment_provider`, `asaas_customer_id` ou `stripe_customer_id`
- Se Asaas: `GET /payments?customer={asaas_customer_id}` com header `access_token`
- Se Stripe: `GET /v1/invoices?customer={stripe_customer_id}` com `STRIPE_SECRET_KEY`
- Retorna array de `{ date, description, amount, status, invoiceUrl? }`

**Resumo do plano** (dados do workspace já disponíveis no frontend):
- `workspace.plan_name` → nome
- `workspace.plan_type` → status (trialing, active, canceled, past_due)
- `workspace.trial_end` → data fim trial
- `usePlanLimits()` → uso de leads, IA, limites

### O que NÃO muda
- Fluxo de checkout (Asaas/Stripe)
- Edge functions existentes
- Tabelas do banco

