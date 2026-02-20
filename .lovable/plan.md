
# Correcao: Integracao Meta (Facebook/Instagram) - workspace_id ausente

## Diagnostico

Foram identificados **3 bugs criticos** que impedem a integracao Meta de funcionar corretamente no modelo multi-tenant (por workspace):

### Bug 1: OAuth nao salva workspace_id
A Edge Function `facebook-oauth` insere registros em `meta_accounts` e `meta_pages` **sem workspace_id**. Ambas as tabelas tem `workspace_id NOT NULL`, entao o INSERT falha silenciosamente ou gera erro. Nenhum workspace consegue conectar sua conta Meta.

**Causa**: O fluxo OAuth e um redirect (GET callback), nao carrega contexto do usuario autenticado. O `workspace_id` precisa ser passado via parametro `state` do OAuth.

### Bug 2: Webhook nao salva workspace_id em meta_conversations
A Edge Function `facebook-webhook` salva mensagens recebidas na tabela `meta_conversations`, mas nunca inclui `workspace_id`. Como a coluna e `NOT NULL`, todas as mensagens recebidas falham ao serem salvas.

**Causa**: A funcao `saveMessage` nao busca o `workspace_id` da `meta_page` correspondente.

### Bug 3: meta-send-message nao salva workspace_id
A Edge Function `meta-send-message` insere mensagens outbound em `meta_conversations` sem `workspace_id`.

---

## Plano de Correcao

### Arquivo 1: `supabase/functions/facebook-oauth/index.ts`

Incluir `workspace_id` no fluxo OAuth:
- Na rota POST `/url`: receber `workspace_id` do body da requisicao (o frontend ja envia o auth token)
- Codificar o `workspace_id` dentro do parametro `state` do OAuth (junto com o HMAC existente)
- Na rota GET (callback): extrair `workspace_id` do `state` decodificado
- Passar `workspace_id` ao inserir em `meta_accounts` e `meta_pages`

Mudancas especificas:
- `generateState(workspaceId)` -> incluir workspace_id no payload
- `validateState(state)` -> retornar `{ valid, workspaceId }` em vez de apenas boolean
- INSERT `meta_accounts` -> adicionar `workspace_id`
- INSERT `meta_pages` -> adicionar `workspace_id`

### Arquivo 2: `supabase/functions/facebook-webhook/index.ts`

Incluir `workspace_id` ao salvar mensagens:
- Em `findMetaPage`: adicionar `workspace_id` ao SELECT (ja seleciona `id, page_access_token, platform`)
- Na funcao `saveMessage`: adicionar campo `workspace_id` ao parametro
- Em `processMessengerEvent`, `processInstagramEvent`, `processWhatsAppBusinessEvent`: passar `metaPage.workspace_id` para `saveMessage`

### Arquivo 3: `supabase/functions/meta-send-message/index.ts`

Incluir `workspace_id` ao salvar mensagem outbound:
- No SELECT de `meta_pages`: adicionar `workspace_id` ao select (ja seleciona `id, page_id, page_access_token, platform, instagram_account_id`)
- No INSERT em `meta_conversations`: adicionar `workspace_id: page.workspace_id`

### Arquivo 4: `src/pages/Settings.tsx`

Enviar `workspace_id` ao solicitar URL OAuth:
- Buscar `workspaceId` do contexto (useWorkspace)
- Enviar no body do invoke: `{ workspaceId }`

### Arquivo 5: `supabase/functions/send-scheduled-messages/index.ts`

Verificar se as queries de meta_pages incluem `workspace_id` para consistencia (este arquivo tambem busca `meta_pages` para enviar mensagens agendadas).

---

## Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `facebook-oauth/index.ts` | Incluir workspace_id no state OAuth e nos INSERTs |
| `facebook-webhook/index.ts` | Buscar e passar workspace_id ao salvar mensagens |
| `meta-send-message/index.ts` | Buscar e passar workspace_id ao salvar outbound |
| `Settings.tsx` | Enviar workspaceId no body do invoke OAuth |
| `send-scheduled-messages/index.ts` | Incluir workspace_id se necessario |

## Impacto
- Cada workspace passa a configurar sua propria conta Meta isoladamente
- Mensagens inbound (webhook) e outbound (send) sao corretamente associadas ao workspace
- O chat unificado passa a exibir as conversas Meta filtradas por workspace via RLS
- Edge Functions usam service_role, entao nao sao afetadas pelas policies de RLS criadas anteriormente
