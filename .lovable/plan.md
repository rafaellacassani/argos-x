

## Correção de 4 bugs WABA + Áudio no Chat

### Diagnóstico

**Bug 1 — WABA: não envia imagens pelo chat**
Em `handleSendMedia` (Chats.tsx:767), quando o chat é Meta/WABA, o `targetInstance` é algo como `meta:xxxx`. O código faz `sendMedia(targetInstance, ...)` que é da Evolution API — falha silenciosamente. Falta o branch `if (selectedChat.isMeta)` para enviar via `meta-send-message` com `messageType: "image"` e `mediaUrl`.

**Bug 2 — WABA: bloqueio desabilitado**
O botão de bloquear está `disabled={isMeta}` intencionalmente (linha 3082). A API oficial da Meta **não suporta** bloqueio de contatos. Isso está correto e não há correção possível — o que podemos fazer é **pausar a IA** para aquele contato (equivalente funcional).

**Bug 3 — WABA: agendamento de mensagem com erro**
Em `ScheduleMessagePopover`, o `channelType` para WABA é `"meta_whatsapp"`. No `send-scheduled-messages/index.ts`, o código só trata `"whatsapp"`, `"meta_facebook"` e `"meta_instagram"` — **não trata `"meta_whatsapp"`**, caindo no `else` que lança `Unknown channel_type: meta_whatsapp`.

**Bug 4 — Áudio não é transcrito/respondido (WABA e Evolution)**
No `ai-agent-chat`, a transcrição de áudio é restrita por plano: só `negocio`, `escala` e `active`. Se o workspace estiver em outro plano (trial, essencial), retorna mensagem pedindo texto. Preciso verificar se houve regressão recente ou se é apenas questão de plano. Além disso, no `whatsapp-webhook`, o download de mídia áudio via Evolution pode estar falhando silenciosamente.

---

### Plano de correção (4 etapas)

#### Etapa 1 — WABA: Enviar imagem/mídia pelo chat
**`src/pages/Chats.tsx`** — `handleSendMedia`
- Adicionar branch `if (selectedChat.isMeta)` no início (igual ao `handleSendMessage`)
- Fazer upload do arquivo para o bucket `campaign-attachments` (público) para obter URL
- Chamar `supabase.functions.invoke("meta-send-message", { body: { metaPageId, recipientId, message: caption, messageType: mediatype, mediaUrl } })`
- Adicionar mensagem otimista ao estado local

**`src/pages/Chats.tsx`** — `handleSendAudio`
- Mesmo branch `if (selectedChat.isMeta)`: upload do áudio para storage, enviar via `meta-send-message` com `messageType: "audio"`

**`supabase/functions/meta-send-message/index.ts`**
- Adicionar suporte a `messageType: "audio"` para WABA (payload `{ messaging_product: "whatsapp", to, type: "audio", audio: { link: mediaUrl } }`)

#### Etapa 2 — WABA: Agendamento de mensagem
**`supabase/functions/send-scheduled-messages/index.ts`**
- Adicionar `"meta_whatsapp"` ao branch de Meta: `msg.channel_type === "meta_facebook" || msg.channel_type === "meta_instagram" || msg.channel_type === "meta_whatsapp"`
- Para `meta_whatsapp`, usar payload WABA: `{ messaging_product: "whatsapp", to: msg.sender_id, type: "text", text: { body: msg.message } }`

#### Etapa 3 — WABA: Bloqueio → Pausar IA
**`src/pages/Chats.tsx`** — menu dropdown
- Para chats Meta, trocar label de "Bloquear" para "Pausar IA para este contato"
- Remover `disabled={isMeta}` e implementar: ao clicar, setar `is_paused: true` em `agent_memories`
- Isso é o equivalente funcional possível

#### Etapa 4 — Áudio: Verificar e corrigir transcrição
**`supabase/functions/whatsapp-webhook/index.ts`**
- Verificar se o download de base64 de áudio via Evolution está falhando (endpoint `/chat/getBase64FromMediaMessage`)
- Garantir fallback textual quando download falha, em vez de silenciar

**`supabase/functions/ai-agent-chat/index.ts`**
- Verificar se a checagem de plano (`audioAllowed`) não está bloqueando indevidamente
- Adicionar log mais explícito quando áudio é negado por plano

---

### Resumo de arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/Chats.tsx` | Branch Meta em handleSendMedia/handleSendAudio + menu bloquear→pausar IA |
| `supabase/functions/meta-send-message/index.ts` | Suporte a messageType "audio" para WABA |
| `supabase/functions/send-scheduled-messages/index.ts` | Tratar channel_type "meta_whatsapp" |
| `supabase/functions/whatsapp-webhook/index.ts` | Verificar download de áudio + fallback |
| `supabase/functions/ai-agent-chat/index.ts` | Logs de debug para áudio negado por plano |

### O que NÃO será alterado
- Nenhuma lógica de SalesBot, calendário, funil, campanhas
- Nenhuma tabela do banco
- Nenhum componente de UI além do Chats.tsx

