

## Plan: Add WhatsApp Web-style Message Actions to Chat

### What changes

1. **Add context menu to MessageBubble** — Right-click or long-press on any message shows a dropdown with WhatsApp Web actions:
   - Responder (Reply) — quotes the message in the input
   - Reagir (React) — emoji reaction picker
   - Copiar (Copy) — copies text to clipboard
   - Apagar para mim (Delete for me) — removes from local DB
   - Apagar para todos (Delete for everyone) — calls Evolution API to delete remotely + removes from local DB
   - Editar (Edit) — only for sent text messages, calls Evolution API to update
   - Encaminhar (Forward) — opens chat picker to forward message
   - Selecionar mensagens (Select messages) — multi-select mode for bulk delete

2. **Add new Evolution API proxy routes** in `supabase/functions/evolution-api/index.ts`:
   - `DELETE /delete-message/:instanceName` → proxies to `DELETE /chat/deleteMessageForEveryone/:instance` with `{ id, remoteJid, fromMe }`
   - `POST /edit-message/:instanceName` → proxies to `POST /chat/updateMessage/:instance` with `{ key: { id, remoteJid, fromMe }, text }`
   - `POST /react-message/:instanceName` → proxies to `POST /message/sendReaction/:instance` with `{ key: { id, remoteJid, fromMe }, reaction }`

3. **Add new methods to `useEvolutionAPI.ts`**:
   - `deleteMessage(instanceName, messageId, remoteJid, fromMe)` 
   - `editMessage(instanceName, messageId, remoteJid, text)`
   - `reactToMessage(instanceName, messageId, remoteJid, fromMe, reaction)`

4. **Update MessageBubble component**:
   - Add `ContextMenu` (from Radix, already in project) wrapping each bubble
   - New props: `onReply`, `onDelete`, `onDeleteForEveryone`, `onEdit`, `onReact`, `onForward`, `onSelect`, `remoteJid`, `fromMe`, `isMeta`
   - Show "Apagar para todos" only for sent messages within ~1h (WhatsApp limit)
   - Show "Editar" only for sent text messages

5. **Update Chats.tsx**:
   - Add multi-select state (`selectionMode`, `selectedMessageIds`)
   - Add reply quote state (`replyingTo: Message | null`)
   - Wire all message action handlers
   - Add bottom toolbar when in selection mode (like WhatsApp: "X selecionadas | Apagar | Cancelar")
   - Pass `instanceName` and `remoteJid` to MessageBubble

6. **Update ChatInput**:
   - Add `replyingTo` prop to show quoted message preview above input
   - Add `onCancelReply` prop

7. **WABA/Meta support**:
   - For Meta instances, only enable Copy and Reply (Meta Graph API doesn't support delete/edit/react the same way)
   - Show appropriate actions based on `isMeta` flag

### Files to modify

- `supabase/functions/evolution-api/index.ts` — add 3 new proxy routes
- `src/hooks/useEvolutionAPI.ts` — add deleteMessage, editMessage, reactToMessage methods
- `src/components/chat/MessageBubble.tsx` — wrap in ContextMenu, add action callbacks
- `src/pages/Chats.tsx` — wire handlers, add selection mode, reply state
- `src/components/chat/ChatInput.tsx` — add reply quote preview

### Technical details

- Evolution API endpoints:
  - `DELETE /chat/deleteMessageForEveryone/{instance}` body: `{ id: messageId, remoteJid, fromMe: true/false }`
  - `POST /chat/updateMessage/{instance}` body: `{ text: newText, key: { id, remoteJid, fromMe } }`
  - `POST /message/sendReaction/{instance}` body: `{ key: { remoteJid, fromMe, id }, reaction: "👍" }`
- Local delete: remove from `whatsapp_messages` table + remove from messages state
- Remote delete: call Evolution API + local delete
- Copy: `navigator.clipboard.writeText(content)`
- ContextMenu from `@radix-ui/react-context-menu` already in the project

