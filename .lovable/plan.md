

## Auto-handoff para mídias visuais (imagem/vídeo)

### Problema
Quando um lead envia imagem ou vídeo, a IA processa via vision gastando 80-188K tokens por chamada. Isso é caro e geralmente desnecessário.

### Solução
Interceptar imagens e vídeos **antes** de chamar a IA. O agente responde automaticamente com uma mensagem educada, pausa a sessão, cancela follow-ups e abre um ticket na fila de suporte humano.

### Mensagem automática
> "Recebi seu arquivo! 📎 Vou encaminhar para nossa equipe analisar com atenção. Um atendente vai te responder em breve — fique tranquilo(a)! 😊"

### Configuração por agente
Adicionar um toggle na aba Avançado: **"Encaminhar imagens e vídeos para suporte"** (`media_handoff_enabled`, default `false`). Quando ativado, imagens e vídeos disparam o handoff automático. Áudios continuam sendo transcritos normalmente.

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| **Migration SQL** | Adicionar coluna `media_handoff_enabled` (boolean, default false) na tabela `ai_agents` |
| **`supabase/functions/ai-agent-chat/index.ts`** | Após carregar o agente e a memória (antes da chamada à IA), checar se `media_type` é `image` ou `video` e `agent.media_handoff_enabled === true`. Se sim: salvar mensagem do user na memória, responder com a mensagem padrão, pausar sessão (`is_paused: true`), cancelar follow-ups pendentes, inserir na `human_support_queue` com reason "Mídia recebida (imagem/vídeo)", registrar `agent_executions` com status `media_handoff`, retornar resposta sem chamar a IA |
| **`src/components/agents/tabs/AdvancedTab.tsx`** | Adicionar Switch "Encaminhar imagens e vídeos para suporte humano" com descrição explicativa |
| **`src/hooks/useAIAgents.ts`** | Incluir `media_handoff_enabled` no `CreateAgentData` e no insert do `createAgent` |

### Fluxo no ai-agent-chat

```text
1. Recebe mensagem com media_type = "image" ou "video"
2. Carrega agent, verifica agent.media_handoff_enabled
3. Se false → fluxo normal (processa imagem/vídeo com IA)
4. Se true →
   a. Salva mensagem "[Imagem/Vídeo]" na memória
   b. Gera resposta fixa (sem chamar IA = 0 tokens)
   c. Pausa sessão (is_paused = true)
   d. Cancela follow-ups pendentes
   e. Insere na human_support_queue
   f. Registra agent_executions (status: media_handoff)
   g. Retorna resposta para o webhook enviar ao lead
```

### O que NÃO muda
- Processamento de áudio (continua transcrevendo normalmente)
- Agentes existentes (default `false`, comportamento atual preservado)
- Lógica de human-handoff existente
- Interface de fila de suporte

