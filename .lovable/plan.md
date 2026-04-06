

## Corrigir billingType no checkout do Asaas

### Problema
No `asaas-checkout/index.ts`, o campo `billingType` está definido como `"UNDEFINED"`, o que faz o Asaas ignorar os dados do cartão de crédito e criar a assinatura com forma de pagamento "Pergunte ao cliente".

### Correção
Apenas **1 linha** em **1 arquivo**:

**`supabase/functions/asaas-checkout/index.ts` (linha 385)**:
```
"UNDEFINED"  →  "CREDIT_CARD"
```

### Verificação
- `asaas-manage-subscription` já usa `"CREDIT_CARD"` para pacotes de leads (linha 185) — OK, não precisa mexer.
- O upgrade usa PUT na assinatura existente, sem billingType — OK também.

### Resultado
Novas assinaturas criadas pelo `/cadastro` serão cobradas automaticamente no cartão informado pelo cliente, sem mais "Pergunte ao cliente" no painel do Asaas.

