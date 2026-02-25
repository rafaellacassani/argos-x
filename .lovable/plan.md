

# Plano: IA Multimodal - Leitura de Imagens e Audio no WhatsApp

## Objetivo
Permitir que o Agente de IA processe imagens e audios recebidos no WhatsApp, respondendo com base no conteudo visual ou falado.

## Como funciona hoje
1. O webhook recebe a mensagem e extrai APENAS texto (`data.message?.conversation` ou `extendedTextMessage`)
2. Se a mensagem for imagem/audio/video, `messageText` fica vazio (`""`)
3. A condicao `if (matchingAgent && messageText)` falha e a IA nunca e acionada
4. O lead envia uma foto ou audio e nao recebe resposta

## Solucao proposta

### Etapa 1: Extrair tipo de midia no webhook
**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Apos a extracao do texto, detectar se a mensagem contem imagem, audio, video ou documento:
- `data.message?.imageMessage` (imagem)
- `data.message?.audioMessage` (audio/voz)
- `data.message?.videoMessage` (video)
- `data.message?.documentMessage` (documento)

Extrair o `mediaType` e o caption (legenda) se existir.

### Etapa 2: Baixar a midia via Evolution API
**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Quando for imagem ou audio:
1. Chamar o endpoint `getBase64FromMediaMessage` da Evolution API (ja existe no proxy) passando o `msgId`
2. Obter o base64 + mimetype da midia
3. Para audio: converter para texto usando a Lovable AI (Gemini suporta audio nativo)
4. Para imagem: enviar o base64 direto para o modelo multimodal

### Etapa 3: Adaptar a chamada ao ai-agent-chat
**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

Alterar o payload enviado ao `ai-agent-chat` para incluir:
```text
{
  message: "texto ou descricao",
  media_type: "image" | "audio" | null,
  media_base64: "base64...",
  media_mimetype: "image/jpeg" | "audio/ogg" | etc
}
```

A condicao `if (matchingAgent && messageText)` sera alterada para `if (matchingAgent && (messageText || mediaType))`.

### Etapa 4: Processar midia no ai-agent-chat
**Arquivo:** `supabase/functions/ai-agent-chat/index.ts`

1. Receber os novos campos `media_type`, `media_base64`, `media_mimetype`
2. Adaptar a validacao para aceitar mensagem vazia quando ha midia
3. Para **imagem**: montar o conteudo multimodal no formato da API:
```text
{
  role: "user",
  content: [
    { type: "text", text: "caption ou '[Imagem enviada pelo lead]'" },
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }
  ]
}
```
4. Para **audio**: transcrever primeiro usando Gemini (que suporta audio nativo) e depois enviar como texto com prefixo "[Audio transcrito]: ..."
5. Para **video**: extrair um frame ou descrever como "[Video recebido]" (limitacao de tamanho)

### Etapa 5: Guardrails e protecoes

- Limitar tamanho de base64 a ~5MB (imagens muito grandes serao ignoradas com mensagem amigavel)
- Timeout de 25s para download de midia (se falhar, IA responde que nao conseguiu ver a midia)
- Audios longos (>2 min) serao truncados
- Adicionar log detalhado de cada etapa para debug
- Manter compatibilidade total com mensagens de texto (sem regressao)

### Modelo utilizado
- **google/gemini-2.5-flash** (ja configurado) suporta nativamente tanto imagens quanto audio em formato multimodal, sem necessidade de servico externo de transcricao

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/whatsapp-webhook/index.ts` | Detectar midia, baixar base64, enviar ao ai-agent-chat |
| `supabase/functions/ai-agent-chat/index.ts` | Receber midia, montar conteudo multimodal, enviar ao Gemini |

Nenhuma migration de banco necessaria. Nenhuma alteracao no frontend.

