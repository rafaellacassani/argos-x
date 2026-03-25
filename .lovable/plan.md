

## Plano: Agentes de IA entenderem imagens (WABA/Meta)

### Situação atual

- **Evolution API** (whatsapp-webhook): Já funciona. Imagens são baixadas via Evolution API e enviadas como base64 para o `ai-agent-chat`, que monta conteúdo multimodal para o modelo de IA.
- **Meta/WABA** (facebook-webhook): **Não funciona**. Quando um lead envia uma imagem pelo WhatsApp Cloud API, o sistema salva apenas o caption (texto), mas nunca baixa a imagem e nunca a envia para a IA.
- **ai-agent-chat**: Já suporta receber `media_type`, `media_base64` e `media_mimetype` e montar mensagens multimodais. Nenhuma alteração necessária.

### O que será feito

**Arquivo: `supabase/functions/facebook-webhook/index.ts`**

1. **Atualizar `routeToAIAgent`** para aceitar parâmetros opcionais `mediaType`, `mediaId` e `accessToken` (para download).

2. **Baixar a imagem do Graph API** antes de chamar `ai-agent-chat`:
   - Quando `mediaType === "image"` e `mediaId` existe, fazer GET em `https://graph.facebook.com/v21.0/{mediaId}` para obter a URL de download.
   - Baixar o binário da imagem e converter para base64.
   - Limitar a 5MB (mesmo limite do Evolution).

3. **Passar `media_type`, `media_base64` e `media_mimetype`** no body da chamada a `ai-agent-chat`, exatamente como o `whatsapp-webhook` já faz.

4. **Atualizar a chamada no `processWhatsAppBusinessEvent`** para passar o `mediaId` e `mediaType` quando o tipo da mensagem for `image` (e futuramente `audio`).

### O que NÃO será alterado

- `ai-agent-chat` — já suporta multimodal
- `whatsapp-webhook` — já funciona para Evolution
- Nenhum componente frontend
- Nenhuma outra edge function

### Detalhes técnicos

```text
Lead envia foto (WABA)
  → facebook-webhook recebe msg.type = "image", msg.image.id = "MEDIA_ID"
  → GET https://graph.facebook.com/v21.0/{MEDIA_ID} (com access_token)
  → Obtém download URL + mime_type
  → GET download URL → binário → base64
  → Chama ai-agent-chat com media_type="image", media_base64, media_mimetype
  → IA vê e entende a imagem, responde ao lead
```

