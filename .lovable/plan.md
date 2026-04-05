
## Problema
Clientes que vieram pelo Asaas, ao fazerem upgrade de plano, comprarem pacotes de leads ou reativarem workspace bloqueado, são redirecionados ao Stripe — causando cobrança dupla e inconsistência.

## Solução
Criar uma Edge Function inteligente `asaas-manage-subscription` que faz upgrade e contratação de pacotes via API do Asaas, e alterar o frontend para rotear automaticamente com base no `payment_provider` do workspace.

---

### 1. Nova Edge Function: `asaas-manage-subscription`

Arquivo: `supabase/functions/asaas-manage-subscription/index.ts`

Responsabilidades:
- **Upgrade de plano**: Atualiza a assinatura existente no Asaas (`PUT /subscriptions/{id}`) com novo valor e descrição, e atualiza limites no workspace.
- **Pacote de leads**: Cria uma nova assinatura mensal no Asaas para o pacote (valor fixo: 1000→R$17, 5000→R$47, 20000→R$97, 50000→R$197), e insere na tabela `lead_packs`.

Fluxo do upgrade:
1. Autentica via JWT
2. Busca workspace e valida que `payment_provider = "asaas"` e `asaas_subscription_id` existe
3. Chama `PUT /subscriptions/{asaas_subscription_id}` com novo `value` e `description`
4. Atualiza `workspaces` com novos limites (`plan_name`, `lead_limit`, `whatsapp_limit`, etc.)
5. Retorna `{ success: true }`

Fluxo do pacote de leads:
1. Autentica via JWT
2. Busca workspace e valida `payment_provider = "asaas"` e `asaas_customer_id` existe
3. Cria nova assinatura mensal no Asaas (`POST /subscriptions`) com `value` do pacote e `externalReference` contendo `type=lead_pack|pack_size=X|workspace_id=Y`
4. Insere registro em `lead_packs` com `pack_size`, `workspace_id`, `price_paid`, `active = true`
5. Retorna `{ success: true }`

---

### 2. Atualizar frontend: `src/pages/Planos.tsx`

Modificar `handleSubscribe` e `handleBuyPack`:
- Verificar `workspace.payment_provider`
- Se `"asaas"` → chamar `asaas-manage-subscription` (sem redirect, resposta direta)
- Se outro → manter fluxo atual via `create-checkout-session` (Stripe)
- Após sucesso do Asaas, mostrar toast de sucesso e recarregar dados (`planLimits.refetch()`)

---

### 3. Atualizar `WorkspaceBlockedScreen.tsx`

Modificar `handleSubscribe`:
- Buscar `payment_provider` do workspace via `useWorkspace()`
- Se `"asaas"` → chamar `asaas-manage-subscription` com `action: "upgrade"`
- Se outro → manter fluxo Stripe atual
- Após sucesso, chamar `refreshWorkspace()` e fechar a tela

---

### 4. Atualizar `asaas-webhook` para processar pacotes de leads

Adicionar lógica no `PAYMENT_RECEIVED` para verificar se a assinatura tem `externalReference` com `type=lead_pack`:
- Se sim, verificar se já existe `lead_pack` para aquele `asaas_subscription_id`
- Se não existe, inserir em `lead_packs`

---

### Resumo dos arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/asaas-manage-subscription/index.ts` | Criar (nova edge function) |
| `src/pages/Planos.tsx` | Editar (rotear por provider) |
| `src/components/layout/WorkspaceBlockedScreen.tsx` | Editar (rotear por provider) |
| `supabase/functions/asaas-webhook/index.ts` | Editar (suporte a lead_packs) |

### Resultado
- Clientes Asaas fazem upgrade/compram pacotes pelo Asaas
- Clientes Stripe legados continuam pelo Stripe
- Zero risco de cobrança dupla
- Sistema reconhece upgrades e pacotes automaticamente
