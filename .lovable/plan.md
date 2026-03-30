

## Melhorar qualidade de correspondência do Meta Pixel — enviar em, ph, fn, ln

### Problema
A qualidade de correspondência está baixa (7.1 e 6.1/10) porque:

1. **Cadastro.tsx — `fbq("init")` sem advanced matching**: O pixel é inicializado sem nenhum dado do usuário (linha 84/96). Quando o `InitiateCheckout` é disparado, os dados do formulário (nome, email, telefone) estão disponíveis mas não são passados.

2. **Cadastro.tsx — `InitiateCheckout` sem user data**: O evento (linha 175) envia apenas `content_name` e `currency`, sem `em`, `ph`, `fn`, `ln`.

3. **CadastroSucesso.tsx — `CompleteRegistration` com advanced matching parcial**: Só passa `em` (email) no `fbq("init")`. Não passa `ph` (telefone) nem `fn`/`ln` (nome), que estão disponíveis via query params.

4. **CAPI (stripe-webhook) — `CompleteRegistration` sem `fn`/`ln`**: Envia `em` e `ph` mas não envia nome hasheado.

5. **CAPI (signup-checkout) — `InitiateCheckout` sem `fn`**: Envia `em` e `ph` mas não `fn`/`ln`.

### Correções

#### 1. `src/pages/Cadastro.tsx`
- Antes de disparar `InitiateCheckout`, re-inicializar o pixel com advanced matching completo usando os dados do formulário:
  - `em`: email (lowercase, trimmed)
  - `ph`: telefone com DDI (digits only)
  - `fn`: primeiro nome (lowercase)
  - `ln`: sobrenome (lowercase)
- O `fbq("init")` aceita esses campos e os hasheia automaticamente (SHA-256 feito pelo SDK do Meta)

```tsx
// Antes do fbq("track", "InitiateCheckout"):
const nameParts = form.name.trim().toLowerCase().split(/\s+/);
w.fbq("init", PIXEL_ID, {
  em: form.email.trim().toLowerCase(),
  ph: `${selectedCountry.code}${form.phone.replace(/\D/g, "")}`,
  fn: nameParts[0] || "",
  ln: nameParts.slice(1).join(" ") || "",
});
w.fbq("track", "InitiateCheckout", { ... }, { eventID: eventId });
```

#### 2. `src/pages/CadastroSucesso.tsx`
- Receber `phone` e `name` como query params adicionais (já vêm do redirect do signup-checkout)
- Passar `em`, `ph`, `fn`, `ln` no `fbq("init")` advanced matching

```tsx
const phone = searchParams.get("phone") || "";
const name = searchParams.get("name") || "";

const advancedMatching: Record<string, string> = {};
if (email) advancedMatching.em = email.trim().toLowerCase();
if (phone) advancedMatching.ph = phone.replace(/\D/g, "");
const nameParts = name.trim().toLowerCase().split(/\s+/);
if (nameParts[0]) advancedMatching.fn = nameParts[0];
if (nameParts.length > 1) advancedMatching.ln = nameParts.slice(1).join(" ");
```

#### 3. `supabase/functions/signup-checkout/index.ts`
- No `successUrl`, incluir `&phone=...&name=...` para que CadastroSucesso receba os dados
- No `sendMetaConversionEvent`, adicionar `fn` e `ln` hasheados no `user_data`

#### 4. `supabase/functions/stripe-webhook/index.ts`
- No `CompleteRegistration` CAPI, buscar o nome do customer e adicionar `fn`/`ln` hasheados
- Já tem `customer.name` disponível do Stripe

### Arquivos alterados
- `src/pages/Cadastro.tsx` — re-init pixel com dados completos antes do InitiateCheckout
- `src/pages/CadastroSucesso.tsx` — receber phone/name nos query params, passar no advanced matching
- `supabase/functions/signup-checkout/index.ts` — incluir phone/name no successUrl + fn/ln no CAPI
- `supabase/functions/stripe-webhook/index.ts` — adicionar fn/ln no CompleteRegistration CAPI

