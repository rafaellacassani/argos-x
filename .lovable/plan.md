

## Cadência Pré-Cobrança — Plano Revisado

### Resumo
Sistema separado de e-mails pré-cobrança (D-3, D-1, dia da cobrança) com painel admin e edge function de disparo via Resend. Sem alterar a cadência de reativação existente.

### Nota sobre links de cancelamento
O projeto **não tem** Stripe Customer Portal configurado. A edge function `process-pre-billing` vai gerar dinamicamente uma sessão do Stripe Billing Portal (`stripe.billingPortal.sessions.create()`) para cada cliente no momento do envio. Isso gera uma URL temporária onde o cliente pode cancelar ou gerenciar a assinatura. Tanto `{link_cancelamento}` quanto `{link_gerenciar_assinatura}` usarão essa URL. Se o workspace não tiver `stripe_customer_id`, usará a URL interna do app (`https://argos-x.lovable.app/settings`).

### Alterações

**1. Migration SQL** — Criar 2 tabelas + popular dados padrão
- `pre_billing_cadence_config` (email_type, ativo, assunto, corpo, updated_at) com RLS admin
- `pre_billing_email_logs` (workspace_id, user_id, tipo_email, timestamp_envio, status_entrega, resend_message_id, error_message) com RLS admin
- INSERT dos 3 templates padrão (D-3, D-1, dia_cobranca)

**2. Componente `src/components/admin/PreBillingCadencePanel.tsx`**
- Busca os 3 registros de config
- Para cada: switch ativo/desativo, campo assunto, textarea corpo
- Legenda de variáveis disponíveis
- Botão "Salvar alterações"
- Histórico recente de envios (últimos 20 logs)

**3. `src/pages/AdminClients.tsx`**
- Adicionar aba "Pré-Cobrança" com ícone Mail, renderizando `<PreBillingCadencePanel />`

**4. Edge Function `supabase/functions/process-pre-billing/index.ts`**
- Carrega configs ativas de `pre_billing_cadence_config`
- Busca workspaces em trial com `trial_end` em D-3, D-1, hoje
- Verifica se já enviou (consulta `pre_billing_email_logs`)
- Para `{link_cancelamento}` e `{link_gerenciar_assinatura}`:
  - Se workspace tem `stripe_customer_id`: cria sessão do Stripe Billing Portal via `stripe.billingPortal.sessions.create({ customer, return_url })` e usa a URL gerada
  - Se não tem: usa `https://argos-x.lovable.app/settings`
- Substitui variáveis nos templates e envia via Resend
- Registra resultado em `pre_billing_email_logs`

**5. Cron job** — Agendar via `pg_cron` + `pg_net` para rodar 1x/dia às 09:00 UTC

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabelas + dados padrão |
| `src/components/admin/PreBillingCadencePanel.tsx` | Novo componente |
| `src/pages/AdminClients.tsx` | Adicionar aba |
| `supabase/functions/process-pre-billing/index.ts` | Nova edge function |
| Insert SQL (cron) | Agendar execução diária |

### O que NÃO será alterado
- Cadência de reativação existente
- Nenhuma edge function existente
- Nenhum outro componente

