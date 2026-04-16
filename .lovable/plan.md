

## Plan: Filtro de Suporte no Chat + Chat Espelhado no Suporte

### Problema 1 — Filtro "Em suporte" nos filtros do Chat
O `ChatFilters.tsx` não possui nenhuma opção de filtro para suporte. O botão "Em suporte" existe como toggle inline (`showQueueOnly`) mas não dentro do drawer de filtros.

**Solução:**
1. **`src/components/chat/ChatFilters.tsx`**: Adicionar campo `supportStatus` ao `ChatFiltersFormData` (valores: `""` = todos, `"waiting"`, `"in_progress"`, `"any_active"`). Adicionar seção "Suporte" no drawer com opções:
   - Todos
   - ⏳ Aguardando atendente
   - 🔴 Em atendimento
   - Qualquer ativo (waiting + in_progress)
2. **`src/pages/Chats.tsx`**: No `filteredChats`, aplicar o filtro `supportStatus` usando `getChatSupportStatus()` — quando o valor for `"waiting"` ou `"in_progress"`, filtra exatamente esse status; quando `"any_active"`, filtra qualquer status não-nulo. Incluir `supportStatus` no `countActiveFilters`.

### Problema 2 — Chat espelhado na página de Suporte
Atualmente o SupportAdmin renderiza mensagens de forma simplificada (texto puro, sem mídia real, sem áudio, sem `MessageBubble`). O input é apenas texto básico sem emoji/mídia/áudio.

**Solução:**
1. **`src/pages/SupportAdmin.tsx`**: 
   - Substituir o loop de renderização de mensagens pelo componente `MessageBubble` já usado em Chats, passando as mesmas props (content, type, mediaUrl, time, sent/read, etc.)
   - Expandir a query de `whatsapp_messages` para incluir `media_url, media_base64, file_name, duration, remote_jid, message_id` (campos necessários para o MessageBubble)
   - Substituir o `<Input>` de reply pelo componente `ChatInput` com `onSendMessage`, `onSendMedia` e `onSendAudio`, reaproveitando a lógica de envio já existente via `evolution-api` (sendText, sendMedia, sendAudio)
   - Importar `useEvolutionAPI` para reutilizar `downloadMedia` no callback `onDownloadMedia` do MessageBubble

### Arquivos alterados
- `src/components/chat/ChatFilters.tsx` — novo campo `supportStatus` + UI
- `src/pages/Chats.tsx` — aplicar filtro `supportStatus` no `filteredChats`
- `src/pages/SupportAdmin.tsx` — usar `MessageBubble` + `ChatInput` + `useEvolutionAPI`

### Sem alterações em
- Estrutura de suporte (edge functions, tabelas, hooks)
- Nenhuma migration necessária

