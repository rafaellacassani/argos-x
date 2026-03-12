

## Problemas identificados

### Problema 1: Filtro de instância não funciona
O `loadChatsFromDB` (linha 849) carrega **todos** os chats do workspace sem filtrar por `instance_name`. Quando o usuário seleciona "api-whatsapp-na-pratica", chats de outras instâncias aparecem misturados.

**Correção**: No `loadChatsFromDB`, quando o `instanceName` não é "all", filtrar os resultados do DB por `instance_name`. No `filteredChats` (useMemo), aplicar filtro por `instanceName` caso o `selectedInstance` não seja "all".

### Problema 2: Mensagens enviadas por campanhas WABA não aparecem no chat
O `process-campaigns/index.ts` envia mensagens via Graph API mas **nunca salva na tabela** `meta_conversations`. Portanto, essas mensagens simplesmente não existem no banco para o chat exibir.

**Correção**: Após envio bem-sucedido via WABA (linha 247), inserir um registro em `meta_conversations` com `direction: 'outbound'`, `platform: 'whatsapp_business'`, `content` com o texto personalizado, e o `sender_id` sendo o número do destinatário. Isso permite que as mensagens de campanha apareçam no chat quando o usuário abre a conversa WABA.

### Arquivos a editar

1. **`src/pages/Chats.tsx`** — Filtrar chats por `instance_name` quando uma instância específica é selecionada (não "all")
2. **`supabase/functions/process-campaigns/index.ts`** — Persistir mensagens WABA enviadas na tabela `meta_conversations`

### Detalhes técnicos

**Chats.tsx — filtro de instância:**
- Em `loadChatsFromDB`: quando `instanceName` não é "all" e não é undefined, adicionar `.eq('instance_name', instanceName)` à query do Supabase
- Na fase 2 (API fetch para instância específica), manter apenas chats da instância selecionada

**process-campaigns — persistir WABA:**
- Após `sendSuccess = true` no bloco WABA (linha 247), inserir em `meta_conversations`:
  - `workspace_id`: da campanha
  - `meta_page_id`: do `tpl.cloud_connection_id` (buscar o `meta_page_id` da conexão)
  - `sender_id`: `cleanPhone` do destinatário  
  - `content`: texto personalizado da mensagem (ou template name)
  - `direction`: `'outbound'`
  - `platform`: `'whatsapp_business'`
  - `message_type`: `'template'`
  - `message_id`: gerado ou retornado pela Graph API

