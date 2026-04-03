
## Implementar WhatsApp Embedded Signup

### O que é
O Embedded Signup da Meta permite que clientes conectem sua WABA direto pelo Argos X, sem sair da plataforma. O cliente clica em "Conectar WhatsApp", faz login no Facebook num popup, seleciona/cria sua conta de negócios e número, e tudo é salvo automaticamente.

### Pré-requisitos no Meta Developers (manual, feito por você)
1. No app Meta, ir em **WhatsApp > Embedded Signup** e criar um **Configuration ID**
2. Em **Facebook Login for Business > Settings**, adicionar o domínio do Argos X em "Allowed Domains for JavaScript SDK"
3. Garantir que os escopos `whatsapp_business_management` e `whatsapp_business_messaging` estão aprovados

### Implementação

#### 1. Adicionar secret `FACEBOOK_CONFIG_ID`
- O Configuration ID do Embedded Signup precisa estar disponível no frontend e backend

#### 2. Novo componente: `WhatsAppEmbeddedSignup.tsx`
- Carrega o Facebook JavaScript SDK (`connect.facebook.net/en_US/sdk.js`)
- Botão "Conectar WhatsApp" que chama `FB.login()` com:
  ```js
  FB.login(callback, {
    config_id: FACEBOOK_CONFIG_ID,
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      feature: 'whatsapp_embedded_signup',
      version: 2,
      sessionInfoVersion: '3',
    }
  });
  ```
- Escuta `window.addEventListener('message')` para capturar o evento `WA_EMBEDDED_SIGNUP` com `phone_number_id` e `waba_id`
- Envia `code` + `phone_number_id` + `waba_id` + `workspace_id` para a edge function

#### 3. Nova edge function: `whatsapp-embedded-signup/index.ts`
- Recebe: `code`, `phone_number_id`, `waba_id`, `workspace_id`
- Troca o `code` por access token via Graph API (`/oauth/access_token`)
- Busca detalhes do número via `GET /{phone_number_id}?fields=display_phone_number,verified_name`
- Cria `meta_accounts`, `meta_pages` (platform=whatsapp_business), `whatsapp_cloud_connections`
- Inscreve WABA no webhook: `POST /{waba_id}/subscribed_apps`
- Retorna sucesso com dados da conexão

#### 4. Atualizar Settings.tsx
- Na aba "WhatsApp API Cloud", substituir/adicionar o botão "Nova Conexão" para abrir o Embedded Signup
- Manter o modal manual como opção avançada (fallback)

### Fluxo do cliente
1. Vai em Configurações > WhatsApp API Cloud
2. Clica "Conectar WhatsApp"
3. Popup do Facebook abre → login → seleciona conta de negócios → seleciona/cria número
4. Popup fecha → sistema salva tudo automaticamente
5. Conexão aparece ativa na lista ✅

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/whatsapp/WhatsAppEmbeddedSignup.tsx` | **Novo** — componente com Facebook SDK + botão |
| `supabase/functions/whatsapp-embedded-signup/index.ts` | **Novo** — processa callback do Embedded Signup |
| `src/pages/Settings.tsx` | Adicionar botão Embedded Signup na aba Cloud API |
| `index.html` | Nenhuma alteração (SDK carregado dinamicamente) |

### O que NÃO muda
- Fluxo OAuth de Facebook/Instagram para mensagens (continua igual)
- Modal manual de conexão WABA (mantido como fallback)
- Webhook `facebook-webhook` (já processa mensagens WABA)
- Lead Ads (já funciona)
