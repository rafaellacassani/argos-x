

## Correções: Vínculo Stripe-Workspace + Bloqueio de Trials Expirados

### Contexto
- **144 workspaces** com trial expirado e `blocked_at = null` — continuam acessíveis
- O webhook `subscription.updated` falha silenciosamente quando `stripe_customer_id` não bate com nenhum workspace (caso Wesley: `cus_UD1cn9s52l10mQ` vs `cus_UFXywXTxZfUSp0`)

---

### Item 1: Corrigir vínculo Stripe → Workspace no webhook

**Problema:** No `subscription.updated` e `subscription.created`, a busca é feita apenas por `stripe_customer_id`. Se o checkout criou um customer ID diferente do que está no workspace, o update não encontra nada.

**Solução:** No case `customer.subscription.updated` do `stripe-webhook`, quando não encontrar workspace por `stripe_customer_id`, fazer fallback:
1. Buscar o email do customer no Stripe (`stripe.customers.retrieve`)
2. Buscar o usuário por email no `user_profiles`
3. Encontrar o workspace via `workspace_members`
4. Vincular o `stripe_customer_id` correto ao workspace e aplicar o update

**Arquivo:** `supabase/functions/stripe-webhook/index.ts`
- Linhas ~655-665: após o `update` retornar 0 rows, adicionar lógica de fallback por email

---

### Item 2: Bloquear trials expirados em batch

**Solução em 2 partes:**

#### 2a. Bloqueio imediato dos 144 existentes
- Executar um UPDATE via migration/insert tool para setar `blocked_at = now()` em todos os workspaces com trial expirado e sem `blocked_at`
- Excluir workspaces com `plan_type = 'active'` e o workspace Default (ID `00000000-...`)

#### 2b. Garantir bloqueio automático futuro
- A função `check-workspace-access` já bloqueia trials expirados quando consultada, mas depende de alguém acessar o workspace
- Adicionar lógica no cron `check-no-response-alerts` (que já roda periodicamente) para bloquear trials expirados automaticamente, OU criar uma query simples no próprio `check-workspace-access` que faz batch update

**Abordagem escolhida:** Adicionar no início da função `check-no-response-alerts` um bloco que executa:
```sql
UPDATE workspaces SET blocked_at = now() 
WHERE plan_type IN ('trialing', 'trial_manual') 
AND trial_end < now() 
AND blocked_at IS NULL 
AND plan_type != 'active'
```

**Arquivo:** `supabase/functions/check-no-response-alerts/index.ts` — adicionar no início do handler

---

### Resumo de arquivos
1. `supabase/functions/stripe-webhook/index.ts` — fallback de busca por email no `subscription.updated`
2. `supabase/functions/check-no-response-alerts/index.ts` — batch block de trials expirados
3. Execução única de UPDATE para bloquear os 144 existentes (via insert tool)

### Impacto
- Sem efeito colateral para workspaces ativos ou em trial válido
- Wesley e casos similares serão resolvidos automaticamente no próximo evento Stripe
- Trials expirados serão bloqueados a cada execução do cron

