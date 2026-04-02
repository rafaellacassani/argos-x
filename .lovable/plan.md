

## Cut-off inteligente para conversas sem propósito / abusivas

### Problema
Leads "trolls" ou mensagens sem sentido consomem centenas de milhares de tokens sem nenhum valor. A sessão de 44 mensagens do troll custou 532K tokens. Não existe mecanismo para a IA encerrar proativamente.

### Solução
Adicionar função `detectAbusiveSession()` no `ai-agent-chat/index.ts` que analisa o histórico **antes** de chamar a IA. Se detectar padrão abusivo, encerra a conversa sem gastar tokens.

### Detecção (3 sinais)

1. **Spam de mensagens curtas**: 8+ mensagens do usuário com menos de 6 caracteres nas últimas 25 (ex: "kk", "?", "oi", "kkkkk")
2. **Volume improdutivo**: mais de N mensagens do usuário (configurável, default 20) sem dados de qualificação coletados (nome/email/empresa não aparecem no histórico)
3. **Ofensas repetidas**: 3+ mensagens com palavrões/ofensas (lista em português)

### Ação ao detectar
- Envia mensagem educada: *"Percebi que não consegui te ajudar como deveria. 😊 Se precisar de algo, é só mandar mensagem novamente! Até mais!"*
- Pausa sessão (`is_paused: true`)
- Cancela follow-ups pendentes
- Registra `agent_executions` com status `abusive_cutoff`
- **0 tokens gastos**

### Configuração por agente
- Nova coluna `max_unproductive_messages` (integer, default 20) na tabela `ai_agents`
- Toggle/campo na aba Avançado do agente

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL | `ALTER TABLE ai_agents ADD COLUMN max_unproductive_messages integer DEFAULT 20` |
| `supabase/functions/ai-agent-chat/index.ts` | Adicionar `detectAbusiveSession()` + check logo após media handoff e antes do trainer mode (linha ~833) |
| `src/components/agents/tabs/AdvancedTab.tsx` | Adicionar campo numérico "Limite de mensagens sem progresso" |

### Posição no fluxo

```text
... opt-out check ...
... media handoff check ...
→ NEW: abusive session check ← (aqui, antes de chamar a IA)
... trainer mode ...
... AI call ...
```

### O que NÃO muda
- Loop detection existente (detecta IA-vs-IA, diferente deste que detecta humano abusivo)
- Opt-out detection existente
- Media handoff existente
- Agentes existentes (default 20 = comportamento conservador)

