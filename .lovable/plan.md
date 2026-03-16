

## Padronizar modelo dos Agentes de IA para GPT-5 Mini

### Problema
O modelo padrão dos agentes está definido como `openai/gpt-4o-mini` (modelo antigo) em vários locais. A lista de modelos disponíveis na aba Avançado também mostra modelos desatualizados (GPT-4o, GPT-4 Turbo, Claude 3.5).

### Locais a corrigir

| Arquivo | Linha | Atual | Novo |
|---------|-------|-------|------|
| `src/hooks/useAIAgents.ts` | 104 | `openai/gpt-4o-mini` | `openai/gpt-5-mini` |
| `src/components/agents/CreateAgentDialog.tsx` | 312 | `openai/gpt-4o-mini` | `openai/gpt-5-mini` |
| `src/components/agents/AgentDetailDialog.tsx` | 81 | `google/gemini-3-flash-preview` | `openai/gpt-5-mini` |
| `src/components/agents/tabs/AdvancedTab.tsx` | 16-20 | Lista com modelos antigos | Lista atualizada com modelos disponíveis |
| `supabase/functions/ai-agent-chat/index.ts` | 683 | `openai/gpt-4o-mini` | `openai/gpt-5-mini` |

### Mudanças

1. **Defaults** — Trocar o fallback de `openai/gpt-4o-mini` para `openai/gpt-5-mini` nos 5 locais acima.

2. **Lista de modelos** (`AdvancedTab.tsx`) — Atualizar para os modelos suportados pelo Lovable AI Gateway:
   - `openai/gpt-5-mini` (Recomendado)
   - `openai/gpt-5-nano` (Econômico)
   - `openai/gpt-5` (Avançado)
   - `google/gemini-2.5-flash` (Alternativa rápida)
   - `google/gemini-2.5-pro` (Alternativa premium)

3. **Edge Function** — O fallback na `ai-agent-chat` também será atualizado. A lógica de roteamento (OpenAI direto vs Lovable Gateway) continuará funcionando normalmente, pois `gpt-5-mini` segue o mesmo padrão `openai/...`.

### Arquivos alterados
- `src/hooks/useAIAgents.ts`
- `src/components/agents/CreateAgentDialog.tsx`
- `src/components/agents/AgentDetailDialog.tsx`
- `src/components/agents/tabs/AdvancedTab.tsx`
- `supabase/functions/ai-agent-chat/index.ts`

