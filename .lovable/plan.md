

## Análise completa: Bloqueio pós-trial e fluxo de ativação Stripe

### Status atual — O que FUNCIONA

| Item | Status | Detalhes |
|------|--------|----------|
| **Bloqueio após 7 dias** | ✅ OK | `useWorkspaceAccess` compara `trial_end` com `now()`. Trial expirado → `allowed: false` |
| **Tela de bloqueio** | ✅ OK | `WorkspaceBlockedScreen` aparece como Dialog modal sem fechar (sem X, sem ESC, sem clique fora) |
| **Botões "Assinar agora"** | ✅ OK | Chamam `create-checkout-session` → retorna URL do Stripe → redireciona |
| **Edge Function de checkout** | ✅ OK | Cria customer Stripe, session de subscription, retorna URL |
| **Stripe webhook - ativação** | ✅ OK | `invoice.payment_succeeded` → `plan_type: "active"`, `blocked_at: null` |
| **Stripe webhook - cancelamento** | ✅ OK | `subscription.deleted` → `plan_type: "canceled"`, `blocked_at: now()` |
| **Secrets do Stripe** | ✅ OK | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ESSENCIAL/NEGOCIO/ESCALA` todos configurados |
| **Página /planos acessível quando bloqueado** | ✅ OK | `AppLayout` tem exceção para `isPlansPage` |
| **Redirect pós-login** | ✅ OK | `ProtectedRoute` salva `returnTo`, `Auth.tsx` redireciona de volta |

### Problemas encontrados

#### 1. Webhook `subscription.updated` NÃO atualiza os limites do plano
Quando o Stripe muda status para `active`, o webhook atualiza `plan_type` e `blocked_at`, mas **não atualiza** `lead_limit`, `whatsapp_limit`, `user_limit`, `ai_interactions_limit`, nem `plan_name`. Ou seja, o cliente paga, desbloqueia, mas fica com os limites do trial (gratuito: 300 leads, 1 WA, etc.) em vez dos limites do plano pago.

**Correção**: No `invoice.payment_succeeded`, usar `getPlanConfig()` para calcular e atualizar os limites junto com a ativação.

#### 2. `createWorkspaceForCustomer` não se aplica a workspaces existentes
A função `createWorkspaceForCustomer` no `checkout.session.completed` só cria workspace novo. Para clientes que já têm workspace (trial expirado → assinou), o checkout completa mas **nenhum limite é atualizado** no `checkout.session.completed` porque `existingWs` já existe e a função faz `return`.

O `customer.subscription.created` atualiza status mas também **não atualiza limites**.

#### 3. Link de suporte com número fake
`WorkspaceBlockedScreen` tem `https://wa.me/5511999999999` — número placeholder.

### Solução

#### Arquivo: `supabase/functions/stripe-webhook/index.ts`

**Mudança 1** — No handler de `customer.subscription.created` (linha 376-391), além de atualizar status, também atualizar limites com `getPlanConfig`:

```typescript
if (existingWs) {
  const env = { STRIPE_PRICE_ESSENCIAL: ..., STRIPE_PRICE_NEGOCIO: ..., STRIPE_PRICE_ESCALA: ... };
  const planConfig = getPlanConfig(priceId || "", env);
  
  await supabaseAdmin.from("workspaces").update({
    subscription_status: "trialing",
    plan_type: "trialing",
    plan_name: planConfig.plan_name,
    lead_limit: planConfig.lead_limit,
    whatsapp_limit: planConfig.whatsapp_limit,
    user_limit: planConfig.user_limit,
    ai_interactions_limit: planConfig.ai_interactions_limit,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    trial_end: ...,
    blocked_at: null,
  }).eq("id", existingWs.id);
}
```

**Mudança 2** — No handler de `customer.subscription.updated` (linha 394-421), quando status é `active`, também atualizar limites:

```typescript
if (status === "active") {
  const env = { ... };
  const planConfig = getPlanConfig(updates.stripe_price_id || "", env);
  updates.plan_type = "active";
  updates.blocked_at = null;
  updates.plan_name = planConfig.plan_name;
  updates.lead_limit = planConfig.lead_limit;
  updates.whatsapp_limit = planConfig.whatsapp_limit;
  updates.user_limit = planConfig.user_limit;
  updates.ai_interactions_limit = planConfig.ai_interactions_limit;
}
```

**Mudança 3** — No `invoice.payment_succeeded` (linha 474-506), também atualizar limites (mesma lógica).

### Arquivos alterados
- `supabase/functions/stripe-webhook/index.ts` — atualizar limites do plano em 3 handlers (subscription.created, subscription.updated, invoice.payment_succeeded)
- `src/components/layout/WorkspaceBlockedScreen.tsx` — corrigir número de suporte (opcional, se você quiser informar o número correto)

### Resumo

O bloqueio após 7 dias **funciona corretamente**. Os botões de checkout **funcionam e levam ao Stripe**. O problema crítico é que **após o pagamento**, o workspace é desbloqueado mas **não recebe os limites do plano pago** — fica com os limites do trial. Isso significa que um cliente que assina o plano Escala (leads ilimitados) continuaria limitado a 300 leads. A correção é garantir que o webhook atualize `plan_name`, `lead_limit`, `whatsapp_limit`, `user_limit` e `ai_interactions_limit` em todos os eventos relevantes.

