
# Correção Cirúrgica: Chat Duplicado e Conversa Quebrada

## Diagnóstico Confirmado (dados reais do banco)

Investiguei o banco de dados e o código fonte em profundidade. Identifiquei **5 causas raiz** que se alimentam mutuamente:

### Causa 1: JIDs `@lid` não são números de telefone
O WhatsApp usa internamente identificadores opacos como `148236601958502@lid` que **não contêm o telefone real**. O sistema trata esses IDs como se fossem telefones, falhando na deduplicação. No banco, confirmei que o mesmo contato real ("pablo matos") aparece com JID `108628430332101@lid` e telefone `+55 (77) 8809-6831` -- mas outro contato com JID diferente pode ter o mesmo telefone.

### Causa 2: `loadChatsFromDB` agrupa por `remote_jid` exato
A função que carrega chats do banco (linha 830-890 de Chats.tsx) faz `chatMap.set(msg.remote_jid, ...)`. Se o mesmo contato tem mensagens sob dois JIDs diferentes (ex: um `@lid` e um `@s.whatsapp.net`), aparecem como **dois chats separados**.

### Causa 3: Dedup de chats usa `phone.slice(-10)` como chave
O sistema tenta deduplicar por últimos 10 dígitos do telefone, mas para chats `@lid` o `phone` é frequentemente vazio ou inválido (>13 dígitos). Quando `phone` está vazio, a chave cai para `remoteJid`, anulando a deduplicação.

### Causa 4: Criação de leads não verifica telefone normalizado
O `createLeadSilent` verifica `whatsapp_jid === chat.remoteJid`, mas se o lead existente tem JID `@s.whatsapp.net` e o chat usa `@lid`, não encontra. A verificação por telefone (últimos 10 dígitos) existe mas falha quando o telefone não foi preenchido ou está em formato diferente.

### Causa 5: Mensagens carregadas por JID exato
`fetchMessages(targetInstance, selectedChat.remoteJid)` consulta a Evolution API pelo JID exato. Se o chat mostra `@lid` mas as mensagens outbound foram gravadas com `@s.whatsapp.net`, elas não aparecem -- resultando em "só mensagens do lead" ou "só mensagens nossas".

## Dados confirmados no banco

- **5 pares de leads duplicados** por `whatsapp_jid` idêntico no mesmo workspace
- **6 pares de leads duplicados** por telefone idêntico
- **12 remote_jids distintos** com mensagens, todos `@lid`, nenhum com outbound (0 mensagens outbound no banco inteiro deste workspace)
- O mesmo contato (`5527999064791@s.whatsapp.net`) aparece com 3 mensagens em uma instância e 2 em outra

## Plano de Correção (só futuro, conforme escolhido)

### 1. Unificar agrupamento de chats por lead/telefone (Chats.tsx)

**Arquivo:** `src/pages/Chats.tsx`

**`loadChatsFromDB` (linhas 815-895):** Mudar o agrupamento de `remote_jid` para usar o lead vinculado como chave primária. Para cada mensagem, buscar o lead correspondente (por JID ou telefone). Agrupar todas as mensagens do mesmo lead sob um único chat.

**Dedup final (linhas 986-996 e 1019-1032):** Quando o chat tem um lead vinculado, usar `lead.id` como chave de dedup em vez de `phoneDigits.slice(-10)`. Isso garante que mesmo com JIDs diferentes, o mesmo lead = mesmo chat.

### 2. Corrigir criação de leads para evitar duplicação (Chats.tsx)

**Arquivo:** `src/pages/Chats.tsx` (linhas 1041-1097)

Antes de chamar `createLeadSilent`:
- Além de checar `whatsapp_jid` exato e `remoteJidAlt`, também buscar no banco com query normalizada:
  - `leads.phone` com últimos 10 dígitos iguais
  - Para `@lid`, tentar resolver o telefone real via `remoteJidAlt` do chat antes de criar
- Se encontrar lead existente, vincular o JID novo ao lead existente via `updateLead(existingLead.id, { whatsapp_jid: chat.remoteJid })` ao invés de criar um novo

### 3. Unificar carregamento de mensagens (Chats.tsx)

**Arquivo:** `src/pages/Chats.tsx` (linhas 1208-1370)

Ao carregar mensagens de um chat:
- Se o lead vinculado tem `whatsapp_jid` diferente do `remoteJid` do chat, buscar mensagens de **ambos os JIDs**
- No fallback para DB (linha 1327+): buscar por todos os JIDs conhecidos do lead + por telefone normalizado
- Mesclar e ordenar por timestamp

### 4. Gravar outbound com JID correto (Chats.tsx)

**Arquivo:** `src/pages/Chats.tsx` (linhas 496-506)

Ao gravar mensagem outbound no `whatsapp_messages`:
- Usar o `whatsapp_jid` do lead vinculado (se existir) como `remote_jid`, não o `selectedChat.remoteJid`
- Isso garante que inbound e outbound ficam sob o mesmo `remote_jid`

### 5. Vincular JIDs alternativos ao lead (webhook + frontend)

**Arquivo:** `src/pages/Chats.tsx` (transformChatData, linhas 691-791)

Quando `transformChatData` encontra um lead com JID diferente do chat:
- Se o lead tem `@s.whatsapp.net` e o chat tem `@lid`, não sobrescrever
- Se o lead tem `@lid` e agora temos `@s.whatsapp.net` via `remoteJidAlt`, atualizar para o `@s.whatsapp.net` (mais estável)

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts` (linhas 999-1005)

Na busca por lead existente no webhook, além de `whatsapp_jid.eq.${remoteJid}`:
- Também buscar por telefone normalizado quando disponível
- Isso evita criar lead duplicado no backend

### 6. Normalizar telefone na criação de lead (useLeads.ts)

**Arquivo:** `src/hooks/useLeads.ts` (linhas 651-728, `createLeadSilent`)

Antes de inserir:
- Normalizar `phone` para formato consistente (só dígitos, sem formatação)
- A unique index `idx_leads_phone_workspace` já existe e vai prevenir duplicatas de telefone no mesmo workspace

## Resumo das mudanças por arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Chats.tsx` | Dedup por lead.id, busca mensagens multi-JID, outbound com JID do lead, vinculação de JIDs |
| `src/hooks/useLeads.ts` | Normalizar phone antes de insert, busca ampliada antes de criar |
| `supabase/functions/whatsapp-webhook/index.ts` | Busca de lead por telefone normalizado além de JID |

## O que NÃO será alterado
- Dados históricos (conforme escolhido)
- Arquivos auto-gerados (client.ts, types.ts, config.toml)
- Lógica de AI Agent e SalesBot (não relacionada)
- Estrutura do banco (sem migrações necessárias)

## Resultado esperado
- Cada contato real aparece como **um único chat**, independente de quantos JIDs tenha
- Todas as mensagens (inbound + outbound) aparecem **juntas** na mesma conversa
- Leads não são mais duplicados ao abrir a tela de Chat
- O painel lateral mostra os dados corretos do lead vinculado
