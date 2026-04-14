

# Registro automático WABA — Implementação

## 3 Mudanças

### 1. `whatsapp-embedded-signup/index.ts`
- **Linha 29**: Detectar `action === "register"` com `connection_id` — nova rota server-side que busca token/IDs do banco, executa register + subscription, retorna resultado
- **Linha 132**: Adicionar `subscribed_fields: "messages"` no URLSearchParams do Step 3
- **Após linha 143**: Novo Step 3.5 — `POST /v21.0/{finalPhoneNumberId}/register` com `messaging_product: "whatsapp"` e `pin: "123456"`

### 2. `facebook-oauth/index.ts`
- **Linha 393**: Adicionar `subscribed_fields: "messages"` no URLSearchParams
- **Após linha 405 (dentro do loop de phones)**: Bloco de register para cada phone number

### 3. `WABAConnectionCard.tsx`
- Estado `registering` + handler `handleRegister` que chama `supabase.functions.invoke("whatsapp-embedded-signup", { body: { action: "register", connection_id: conn.id } })`
- Botão "Registrar" com ícone `Wifi` entre os botões Token e Webhook (visível quando `isEnabled`)
- Toast de sucesso/erro

### Deploy
Deploy automático das 2 edge functions: `whatsapp-embedded-signup` e `facebook-oauth`

