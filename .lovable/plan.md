

## Corrigir roteamento de pagamento: Stripe apenas para assinaturas ativas existentes

### Diagnóstico

O campo `payment_provider` em workspaces criados pelo painel admin está definido como `"stripe"` mesmo sem ter `stripe_customer_id`. Quando esses clientes tentam contratar, são enviados ao Stripe ao invés do Asaas.

Dados encontrados no banco:
- Workspaces com `payment_provider: "stripe"` + `stripe_customer_id: null` (ex: Tvlar Motos, LEGIS) → são redirecionados incorretamente ao Stripe
- Workspaces com `payment_provider: "stripe"` + `stripe_customer_id` preenchido + `subscription_status: active` → devem continuar no Stripe
- Workspaces com `payment_provider: "asaas"` → já funcionam corretamente

### Regra correta

Usar Stripe **somente** quando o workspace já tem um `stripe_customer_id` preenchido (indicando que já existe um cliente Stripe vinculado). Caso contrário, sempre usar Asaas.

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/pages/Planos.tsx` (linha 75) | Mudar lógica de `isAsaas` para: usar Asaas quando **não** tem `stripe_customer_id` |
| `src/components/layout/WorkspaceBlockedScreen.tsx` (linha 85) | Mesma lógica |

### Lógica nova (ambos os arquivos)

```typescript
// Antes:
const isAsaas = workspace?.payment_provider === "asaas";

// Depois: usar Stripe SOMENTE se já tem cliente Stripe vinculado
const useStripe = !!workspace?.stripe_customer_id;
```

Então inverter as condições: `if (!useStripe)` → Asaas, `else` → Stripe.

### Impacto

- Assinaturas Stripe ativas (com `stripe_customer_id`) continuam no Stripe sem alteração
- Workspaces gratuitos/admin sem `stripe_customer_id` agora vão para Asaas
- Workspaces Asaas continuam no Asaas (não têm `stripe_customer_id`)
- Zero risco de quebrar assinaturas existentes

