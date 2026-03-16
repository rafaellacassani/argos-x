

## Plano: Suporte a OpenAI e Anthropic com chaves próprias

### Situação atual
O sistema usa exclusivamente o **Lovable AI Gateway** (`ai.gateway.lovable.dev`) para todos os modelos. Quando os créditos acabam, retorna 402 e a IA para de funcionar. Você não tem chave da Google/Gemini, mas tem da **OpenAI** e **Anthropic**.

### O que será feito

**1. Adicionar secrets para as APIs**
- `OPENAI_API_KEY` — sua chave da OpenAI
- `ANTHROPIC_API_KEY` — sua chave da Anthropic

**2. Modificar `ai-agent-chat/index.ts` — roteamento por provedor**

O sistema detectará o provedor pelo prefixo do modelo e chamará a API correta:

```text
openai/*     → api.openai.com/v1/chat/completions (OPENAI_API_KEY)
anthropic/*  → api.anthropic.com/v1/messages (ANTHROPIC_API_KEY)
google/*     → ai.gateway.lovable.dev (LOVABLE_API_KEY, fallback)
```

- Se a chave do provedor escolhido não existir, tenta o Lovable gateway como fallback
- Anthropic usa formato de API diferente (role "system" vai em campo separado), será adaptado

**3. Atualizar lista de modelos no frontend**

Adicionar modelos Anthropic e reorganizar:

| Modelo | Label |
|--------|-------|
| `openai/gpt-4o-mini` | ⭐ GPT-4o Mini (Recomendado - Econômico) |
| `openai/gpt-4o` | GPT-4o (Equilibrado) |
| `openai/gpt-4-turbo` | GPT-4 Turbo (Avançado) |
| `anthropic/claude-3.5-sonnet` | Claude 3.5 Sonnet (Inteligente) |
| `anthropic/claude-3.5-haiku` | Claude 3.5 Haiku (Rápido) |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash |

**4. Default para clientes**
- O default no `CreateAgentDialog` será `openai/gpt-4o-mini` (mais barato da OpenAI)
- No seu workspace, você escolhe o que preferir

### Arquivos alterados
- `supabase/functions/ai-agent-chat/index.ts` — roteamento multi-provedor
- `src/components/agents/tabs/AdvancedTab.tsx` — lista de modelos atualizada
- `src/components/agents/CreateAgentDialog.tsx` — default model
- `src/hooks/useAIAgents.ts` — default model

