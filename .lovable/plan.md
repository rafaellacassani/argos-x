

## Diagnóstico confirmado

O problema é claro: quando o gateway de IA retorna **402 (sem créditos)**, a função `buildAiFallbackReply` sempre retorna a mesma saudação genérica, ignorando completamente o histórico da conversa. Isso causa:
- Repetição infinita da mesma mensagem
- Ignorar rejeições do lead ("não mande mais")
- Ignorar que o lead já se identificou

## Sobre o modelo de IA

**Recomendação: `google/gemini-2.5-flash`** como modelo padrão para suas agentes.

- É o melhor custo-benefício: rápido, barato, e inteligente o suficiente para atendimento
- O `gemini-3-flash-preview` (atual default) é um preview que pode ter instabilidades
- O `gemini-2.5-flash` é estável e custa menos créditos, então duram mais
- Para agentes premium, use `google/gemini-2.5-pro`

Você pode trocar agora em Agentes de IA > Iara > aba Avançado > Modelo de IA.

---

## Plano de implementação

### 1. Fallback contextual inteligente (`ai-agent-chat/index.ts`)

Refatorar `buildAiFallbackReply` para receber o histórico (`memory.messages`):
- Se já existem mensagens anteriores, **não repetir saudação** — usar frases variadas como "Desculpe, tive um problema técnico. Pode repetir?"
- Se o lead já informou o nome, usar o nome
- Banco de 5-6 frases de fallback alternativas, escolhidas aleatoriamente para evitar repetição
- Verificar a última resposta do assistente: se for igual ao fallback candidato, escolher outra

### 2. Detecção de rejeição pré-modelo (`ai-agent-chat/index.ts`)

Antes de chamar o gateway de IA, verificar a mensagem do lead contra palavras-chave de rejeição:
- Keywords: "não mande mais", "pare", "parar", "não quero", "não tenho interesse", "favor não mandar", "sair", "cancelar"
- Se detectado: responder com encerramento educado, pausar sessão (`is_paused = true`), cancelar follow-ups pendentes na `agent_followup_queue`, registrar execução com status "rejected"

### 3. Anti-spam: limite de fallbacks consecutivos (`ai-agent-chat/index.ts`)

- Adicionar campo `consecutive_fallbacks` no `summary` da memória
- Incrementar quando o fallback é usado, zerar quando a IA responde normalmente
- Após **3 fallbacks consecutivos**: pausar automaticamente para aquele lead, registrar execução com status "fallback_limit", logar alerta
- Isso evita que a IA fique bombardeando o lead quando não tem créditos

### 4. Atualizar modelo default no `CreateAgentDialog`

- Trocar default de `google/gemini-3-flash-preview` para `google/gemini-2.5-flash` no wizard de criação

### Arquivos alterados
- `supabase/functions/ai-agent-chat/index.ts` — fallback, rejeição, anti-spam
- `src/components/agents/CreateAgentDialog.tsx` — default model
- `src/components/agents/tabs/AdvancedTab.tsx` — reordenar modelos com recomendação

