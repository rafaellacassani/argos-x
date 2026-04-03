

## Conexão automática de WhatsApp (WABA) via OAuth Meta — é possível e já está quase pronto

### Resposta direta

**Sim, é totalmente possível.** O OAuth da Meta já suporta isso. Na verdade, o código atual **já detecta WABAs e números automaticamente** (Step 7 do `facebook-oauth/index.ts`). O problema é que faltam 2 coisas para funcionar de ponta a ponta:

1. **Escopo OAuth `whatsapp_business_management`** — não está na lista de scopes solicitados, então a Meta não dá acesso às WABAs do usuário
2. **Registro em `meta_pages`** — o OAuth salva o WABA em `whatsapp_cloud_connections` mas não cria o registro correspondente em `meta_pages` com `platform = "whatsapp_business"`, que é onde o webhook procura para rotear mensagens

### O que precisa ser feito

**1. Adicionar escopo no OAuth** (`facebook-oauth/index.ts`)

Adicionar `whatsapp_business_management` e `whatsapp_business_messaging` à lista de scopes:

```text
Scopes atuais:
  pages_show_list, pages_messaging, pages_manage_metadata,
  pages_read_engagement, instagram_basic, instagram_manage_messages,
  instagram_manage_comments, business_management, leads_retrieval

Adicionar:
  whatsapp_business_management
  whatsapp_business_messaging
```

**2. Criar `meta_pages` para cada número WABA** (`facebook-oauth/index.ts`)

No Step 7, após salvar em `whatsapp_cloud_connections`, criar também um registro em `meta_pages`:

```text
meta_pages:
  page_id = phone_number_id
  page_name = "WhatsApp - {display_phone_number}"
  page_access_token = finalUserToken
  platform = "whatsapp_business"
  workspace_id = workspaceId
  meta_account_id = metaAccount.id
  is_active = true
```

E vincular o `meta_page_id` no `whatsapp_cloud_connections`.

**3. Fallback no webhook** (`facebook-webhook/index.ts`)

Adicionar fallback para quando o webhook receber evento WABA e não encontrar `meta_pages`: buscar direto em `whatsapp_cloud_connections` por `phone_number_id`.

### Resultado

Depois dessas 3 alterações:
- Cliente clica em "Conectar Facebook" no Settings
- Faz login no Meta
- O sistema detecta automaticamente: páginas Facebook, contas Instagram **E números WhatsApp**
- Tudo fica conectado e funcional sem configuração manual adicional
- Mensagens WABA chegam no Chat automaticamente

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/facebook-oauth/index.ts` | Adicionar 2 scopes WABA + criar `meta_pages` para cada número WABA detectado |
| `supabase/functions/facebook-webhook/index.ts` | Fallback de resolução por `whatsapp_cloud_connections` quando `meta_pages` não encontra |

### Pré-requisito no Meta Developers

Os escopos `whatsapp_business_management` e `whatsapp_business_messaging` precisam estar aprovados no app Meta (no painel de Use Cases). Se já estiverem como "Ready to use" ou "Advanced Access", basta adicionar no código.

### O que NÃO muda
- Fluxo manual de conexão WABA (`CloudAPIConnectionModal`) — continua funcionando
- Mensagens Facebook/Instagram — sem alteração
- Lead Ads — sem alteração
- Tabelas do banco — sem alteração de schema

