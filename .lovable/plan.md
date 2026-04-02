

## Corrigir: Mensagens WABA não chegam no chat (webhook não subscrito)

### Problema raiz

O OAuth flow (`facebook-oauth/index.ts`) faz subscription de webhooks apenas para **Pages** (`subscribed_fields: messages, messaging_postbacks, feed, leadgen`). Isso cobre Facebook Messenger, Instagram DMs e Lead Ads.

Porém, **mensagens WABA (WhatsApp Cloud API)** são eventos do objeto `whatsapp_business_account`, que requer uma subscription separada na Graph API:

```
POST https://graph.facebook.com/v18.0/{WABA_ID}/subscribed_apps
```

Sem isso, a Meta nunca envia eventos de mensagens WhatsApp para o nosso webhook. Por isso o Fellipe não recebe nada — o webhook simplesmente não está inscrito para o WABA dele.

Os seus eventos WABA (`980377115162609`) funcionam porque foram configurados manualmente no Meta Dashboard.

### Solução

Adicionar a subscription do WABA **automaticamente** no fluxo OAuth e no fluxo de conexão CloudAPI.

### Alterações

**Arquivo: `supabase/functions/facebook-oauth/index.ts`**

Após salvar o `whatsapp_cloud_connections` e o `meta_pages` com platform `whatsapp_business`, adicionar chamada:

```typescript
// Subscribe WABA to webhook
const wabaId = waba.id; // WABA ID from Graph API
const subscribeRes = await fetch(
  `https://graph.facebook.com/v18.0/${wabaId}/subscribed_apps`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: finalUserToken,
    }),
  }
);
```

Isso inscreve o WABA no webhook do nosso app, fazendo a Meta enviar eventos `whatsapp_business_account` para o endpoint `facebook-webhook`.

**Investigação adicional necessária**: O OAuth flow atual detecta WABAs? Preciso verificar se o código já itera por WABAs para saber onde inserir a subscription.

**Arquivo: `supabase/functions/facebook-oauth/index.ts`** — verificar o trecho que processa WABAs (provavelmente entre linhas 100-240 que ainda não li).

### Ação imediata para o Fellipe

Enquanto o fix automático não é implementado, posso fazer uma chamada manual via Graph API para subscribir o WABA dele:

```
POST https://graph.facebook.com/v18.0/{WABA_ID}/subscribed_apps
```

Mas preciso do WABA ID dele (não é o `phone_number_id`). Posso buscar isso via Graph API se tivermos o access_token.

### Resumo

| Arquivo | Alteração |
|---|---|
| `supabase/functions/facebook-oauth/index.ts` | Após detectar/salvar WABA, chamar `POST /{wabaId}/subscribed_apps` para inscrever webhook |

### O que NÃO muda
- Handler de eventos WABA no `facebook-webhook/index.ts` (já funciona)
- Fluxo de mensagens Facebook/Instagram (já funciona)
- Lead Ads (já funciona)

