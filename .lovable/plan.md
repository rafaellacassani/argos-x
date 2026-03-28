

## Correção de 2 problemas no Chat

### Problema 1: Erro ao bloquear contato

**Diagnóstico**: No `Chats.tsx` (linha 3204), o número é extraído como digits puros (`phone.replace(/\D/g, "")` ou `remoteJid.replace(/@.*/, "")`). Porém a Evolution API v2 espera o número **sem** o `@s.whatsapp.net` mas pode exigir formato específico. O problema mais provável é que o `evolutionRequest` na edge function usa `PUT` mas o CORS header (linha 9) só lista `GET, POST, DELETE, OPTIONS` — embora isso não afete chamadas server-side, o erro pode vir da resposta da Evolution API.

**Investigação adicional**: O endpoint `/chat/updateBlockStatus` pode ter mudado na versão atual da Evolution API. Vou adicionar logging detalhado e também garantir que o número seja passado no formato correto (com ou sem `@s.whatsapp.net`).

**Correções**:

1. **`supabase/functions/evolution-api/index.ts`** (block-contact endpoint):
   - Adicionar `PUT` ao CORS Allow-Methods (linha 9)
   - Garantir que o `number` seja formatado corretamente (adicionar `@s.whatsapp.net` se não tiver)
   - Adicionar log detalhado para debug
   - Tratar resposta de erro da Evolution API com mensagem clara

2. **`src/pages/Chats.tsx`**: Sem mudanças necessárias, o front está correto.

---

### Problema 2: Detecção de loop IA-vs-IA

**Diagnóstico**: Quando duas IAs conversam entre si (ex: a IA do Argos X responde a um contato que também é um bot/IA), elas entram em loop infinito. O sistema não tem nenhum mecanismo para detectar isso.

**Solução — Detecção de padrões de loop no `ai-agent-chat`**:

Adicionar no `ai-agent-chat/index.ts`, **antes** de chamar o modelo de IA, uma verificação de 3 sinais de loop:

1. **Frequência excessiva**: Se houve mais de 10 trocas (user+assistant) nos últimos 5 minutos na mesma sessão, pausar automaticamente
2. **Repetição de conteúdo**: Se as últimas 4 mensagens do assistant são muito similares entre si (ou as do user), pausar
3. **Padrão de resposta instantânea**: Se as últimas 5 mensagens do user chegaram com intervalo < 3 segundos entre elas (bot behavior)

Quando detectado:
- Pausar a sessão (`is_paused: true`)
- Cancelar follow-ups pendentes
- Registrar em `agent_executions` com status `"loop_detected"`
- **Não** responder mais — silêncio quebra o loop
- Log claro para monitoramento

**Alterações**:

| Arquivo | Mudança |
|---|---|
| `supabase/functions/evolution-api/index.ts` | Adicionar PUT ao CORS + formatar número para block |
| `supabase/functions/ai-agent-chat/index.ts` | Adicionar função `detectAILoop()` antes da chamada ao modelo |

### O que NÃO será alterado
- Nenhuma tabela do banco
- Nenhum componente de UI
- Nenhuma outra edge function

