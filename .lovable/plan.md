

## Corrigir cobrança para usar Asaas quando workspace é Asaas

### O que muda

**Problema**: Clientes que vieram pelo Asaas, ao fazerem upgrade/pacotes/reativação, são redirecionados ao Stripe — causando cobrança dupla.

**Solução**: Rotear automaticamente com base no `payment_provider` do workspace.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/asaas-manage-subscription/index.ts` | **Criar** — nova edge function para upgrade e pacotes via API Asaas |
| `src/pages/Planos.tsx` | **Editar** — rotear por `payment_provider` |
| `src/components/layout/WorkspaceBlockedScreen.tsx` | **Editar** — rotear por `payment_provider` |
| `supabase/functions/asaas-webhook/index.ts` | **Editar** — suporte a `lead_packs` via Asaas |

### Nova Edge Function: `asaas-manage-subscription`

- **Upgrade**: Atualiza assinatura existente no Asaas (`PUT /subscriptions/{id}`), atualiza limites no workspace imediatamente.
- **Pacote de leads**: Cria nova assinatura mensal no Asaas para o pacote (1000→R$17, 5000→R$47, 20000→R$97, 50000→R$197), insere em `lead_packs`.

### Frontend (Planos + WorkspaceBlockedScreen)

- Se `workspace.payment_provider === "asaas"` → chama `asaas-manage-subscription` (sem redirect, resposta direta, toast de sucesso)
- Senão → mantém fluxo Stripe via `create-checkout-session`

### Webhook Asaas

- Adiciona detecção de `type=lead_pack` no `externalReference` para inserir automaticamente em `lead_packs` quando pagamento confirmado.

### Resultado

- Clientes Asaas fazem tudo pelo Asaas
- Clientes Stripe legados continuam pelo Stripe
- Zero risco de cobrança dupla

