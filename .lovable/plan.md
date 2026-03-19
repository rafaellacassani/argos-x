

## Plano: Ativar cobrança dos pacotes de leads adicionais

### Situação atual
- A tabela `lead_packs` já existe no banco com campos `stripe_item_id`, `pack_size`, `price_paid`, `active`, `workspace_id`
- O hook `usePlanLimits` já soma os `lead_packs` ativos ao limite de leads
- Os botões na página `/planos` estão com "Em breve" (disabled)
- Faltam: os **Stripe Price IDs** dos pacotes e o **fluxo de checkout**

### O que será feito

**1. Criar 4 secrets para os preços dos pacotes no Stripe**
- `STRIPE_PRICE_PACK_1000` → +1.000 leads (R$17/mês)
- `STRIPE_PRICE_PACK_5000` → +5.000 leads (R$47/mês)
- `STRIPE_PRICE_PACK_20000` → +20.000 leads (R$97/mês)
- `STRIPE_PRICE_PACK_50000` → +50.000 leads (R$197/mês)

Você precisará criar esses 4 produtos/preços recorrentes no Stripe Dashboard e me passar os IDs.

**2. Atualizar a Edge Function `create-checkout-session`**
- Adicionar suporte a `type: "lead_pack"` no body
- Mapear os `pack_size` para os respectivos Stripe Price IDs
- Criar sessão de checkout como subscription add-on vinculada ao mesmo `stripe_customer_id` do workspace

**3. Atualizar o `stripe-webhook`**
- No evento `checkout.session.completed`, detectar quando é um pacote de leads (via metadata `type: "lead_pack"`)
- Inserir registro na tabela `lead_packs` com `pack_size`, `price_paid`, `stripe_item_id`, `workspace_id`, `active: true`
- No evento `customer.subscription.deleted`, desativar (`active = false`) os lead_packs associados

**4. Atualizar a página `/planos`**
- Remover o `disabled` dos botões de pacote
- Adicionar `handleBuyPack(packSize)` que chama `create-checkout-session` com `type: "lead_pack"` e `packSize`
- Loading state individual por pacote

### Pré-requisito do seu lado
Antes de implementar, preciso que você crie os 4 preços recorrentes (subscription) no Stripe Dashboard e me passe os Price IDs (`price_xxx`). Posso prosseguir com o código e pedir os secrets depois.

### Detalhes técnicos

```text
Fluxo:
  Botão "Contratar" → create-checkout-session (type=lead_pack, packSize=1000)
       → Stripe Checkout → stripe-webhook (checkout.session.completed)
       → INSERT lead_packs → usePlanLimits recalcula limite
```

Arquivos modificados:
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/pages/Planos.tsx`

