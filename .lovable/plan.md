

## Adicionar mídia (imagem, áudio, vídeo) ao bloco "Enviar Mensagem" do SalesBot

### O que será feito
Permitir anexar imagem, áudio ou vídeo no bloco "Enviar Mensagem" do SalesBot. Quando for áudio, será enviado como áudio gravado (narração). Os arquivos serão enviados para um bucket de storage e a URL será salva no node data.

### Alterações

**1. Migração SQL — Criar bucket de storage**
- Criar bucket `salesbot-media` (público) para armazenar os arquivos de mídia dos bots
- RLS: permitir upload/leitura para usuários autenticados

**2. `src/components/salesbots/SendMessageNodeContent.tsx`**
- Adicionar botões de anexo abaixo do textarea: Imagem, Áudio, Vídeo (ícones `ImagePlus`, `Mic`, `Video`)
- Ao selecionar arquivo, fazer upload para `salesbot-media/{workspaceId}/{botNodeId}/{filename}`
- Salvar no node data: `{ mediaUrl, mediaType: "image"|"audio"|"video", mediaFileName }`
- Mostrar preview: imagem (thumbnail), áudio (player pequeno com nome), vídeo (nome do arquivo)
- Botão de remover mídia
- Se `mediaType === "audio"` e tem mídia, o campo de texto se torna opcional (caption)
- A mensagem de texto serve como caption para imagem/vídeo

**3. `supabase/functions/whatsapp-webhook/index.ts` — executeNode send_message**
- Após a lógica de texto existente, verificar `node.data.mediaUrl` e `node.data.mediaType`
- Se tem mídia:
  - Se `mediaType === "audio"`: usar `/message/sendMedia/${instanceName}` com `mediatype: "audio"` (enviado como PTT/narração usando endpoint dedicado `/message/sendWhatsAppAudio` ou flag `"audio"` que a Evolution API trata como voice note)
  - Se `mediaType === "image"` ou `"video"`: usar `/message/sendMedia/${instanceName}` com `mediatype` correspondente, texto como `caption`
- Se não tem mídia: manter comportamento atual (sendText)

**4. `src/hooks/useBotFlowExecution.ts` — executeNode send_message (client-side)**
- Mesmo ajuste: verificar `node.data.mediaUrl`/`mediaType` e chamar `sendMedia` ou `sendAudio` ao invés de `sendText`

### Detalhes técnicos

| Componente | Mudança |
|---|---|
| SQL migration | Bucket `salesbot-media` + RLS policies |
| `SendMessageNodeContent.tsx` | UI de upload + preview + dados no node |
| `whatsapp-webhook/index.ts` | `executeNode` case `send_message`: enviar mídia via Evolution API |
| `useBotFlowExecution.ts` | `executeNode`: enviar mídia via hook `sendMedia`/`sendAudio` |

### Envio de áudio como "gravado"
- Para a Evolution API, usar endpoint `/message/sendWhatsAppAudio` que envia como voice message (PTT), fazendo parecer que foi gravado e enviado (bolinha verde, como no WhatsApp)
- Na falta desse endpoint, usar `sendMedia` com `mediatype: "audio"` que já funciona

### O que NÃO será alterado
- Nenhuma lógica de agentes de IA
- Nenhuma lógica de calendário, tags, condições
- O fluxo WABA template permanece igual
- Nenhuma outra página ou componente

