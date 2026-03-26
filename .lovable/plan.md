

## Habilitar interpretação de áudio pelos Agentes de IA

### O que será feito
Adicionar transcrição de áudio via Whisper (OpenAI) no `ai-agent-chat`, com gate por plano (Business/Escala + admin). Também habilitar o encaminhamento de áudio no `facebook-webhook` (WABA).

### Alterações

**1. `supabase/functions/ai-agent-chat/index.ts`**

- Adicionar função `transcribeAudio(base64, mimetype)`:
  - Converte base64 em Blob
  - Envia para `https://api.openai.com/v1/audio/transcriptions` (modelo `whisper-1`)
  - Retorna texto transcrito
  - Usa `OPENAI_API_KEY` (já configurada)

- Adicionar verificação de plano antes de transcrever:
  - Buscar `workspace.plan_type` via `workspaces` table usando o `agent.workspace_id`
  - Permitir transcrição apenas para planos `negocio`, `escala`, `active` (Business+) e workspaces admin
  - Se plano não permitir, responder com texto genérico: "Desculpa, não consigo ouvir áudios no momento. Me manda por texto!"

- Substituir o bloco `input_audio` (linhas 707-722) por transcrição Whisper:
  ```
  const transcription = await transcribeAudio(media_base64, media_mimetype);
  aiMessages.push({
    role: "user",
    content: `[Áudio do lead - transcrição]: ${transcription}`
  });
  ```

**2. `supabase/functions/facebook-webhook/index.ts`**

- Linha 628: expandir condição para incluir `audio`:
  ```
  if (content || (["image", "audio"].includes(msg.type) && rawMediaId)) {
  ```
- Passar `media_type: "audio"` e `mediaId` para `routeToAIAgent` quando `msg.type === "audio"`
- Na função `routeToAIAgent`, baixar áudio via Graph API (mesmo fluxo que imagem) e enviar `media_base64` + `media_mimetype`

### O que NÃO será alterado
- Nenhum componente frontend
- Nenhuma tabela do banco de dados
- O fluxo de imagens (já funciona)
- O fluxo da Evolution API para áudio no `whatsapp-webhook` (já baixa e envia base64 corretamente, só o modelo não entendia — agora vai transcrever)
- Nenhuma lógica de agentes, personalidade, tools, follow-ups

### Planos habilitados
- **Negócio** e **Escala**: áudio habilitado
- **Essencial** e **Trial**: resposta educada pedindo texto
- **Admin (vocês)**: sempre habilitado

