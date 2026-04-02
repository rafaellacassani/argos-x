

## Corrigir telefone enviado ao Asaas (remover código do país)

### Problema
O Asaas espera o telefone no formato brasileiro **sem** código do país: `DDD + número` (ex: `35991442125`). O código atual faz o contrário — adiciona o prefixo `55` antes de enviar, resultando em `5535991442125`. Como o campo `mobilePhone` do Asaas não suporta código de país, o `55` é interpretado como DDD e o número fica truncado/errado.

### Correção

**Arquivo:** `supabase/functions/asaas-checkout/index.ts`

**3 pontos de correção:**

1. **Linha 331-334** — `mobilePhone` para criação do customer Asaas:
   - Inverter a lógica: em vez de adicionar `55`, **remover** o `55` se já existir
   ```typescript
   let mobilePhone = cleanPhone;
   if (mobilePhone.startsWith("55") && mobilePhone.length > 11) {
     mobilePhone = mobilePhone.substring(2);
   }
   ```

2. **Linha 377-381** — `holderMobilePhone` para creditCardHolderInfo:
   - Mesma lógica: remover `55` em vez de adicionar
   ```typescript
   if (holderMobilePhone.startsWith("55") && holderMobilePhone.length > 11) {
     holderMobilePhone = holderMobilePhone.substring(2);
   }
   ```

3. O `cleanPhone` usado para salvar no banco (`user_profiles`, `client_invites`, lead interno, Meta CAPI) continua com `55` — isso é correto para o CRM e WhatsApp. Apenas o valor enviado ao Asaas perde o prefixo.

### O que NÃO muda
- Telefone salvo no banco de dados (mantém com `55`)
- Telefone enviado ao Meta CAPI (mantém com `55`)
- Qualquer outra edge function
- Frontend (`Cadastro.tsx`)

