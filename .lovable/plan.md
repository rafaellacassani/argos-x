

## Diagnóstico: Problema de Desbloqueio do Contato 553591442125

### O que encontrei

**Lead:** `4d5f3ad1` — nome "IA", phone `553591442125`, workspace do Clayton (`77f518f4`)

**Estado atual no banco:**
- `leads.is_opted_out = false` (já foi desbloqueado no lead)
- `agent_memories` sessão `553591442125@s.whatsapp.net` → **`is_paused = true`** (112 mensagens)
- `agent_memories` sessão `553591442125` → `is_paused = false` (2 mensagens, sessão antiga)
- `human_support_queue` → nenhum ticket ativo para esse lead

**O problema:** A IA continua parada porque `is_paused = true` na memória principal (sessão com `@s.whatsapp.net`). O contato foi "desbloqueado" visualmente, mas a IA nunca retomou.

### Bug encontrado — afeta TODOS os clientes

No arquivo `src/pages/Chats.tsx`, o botão **"Desbloquear contato"** (linhas 3207-3229) faz:
1. Chama `blockContact(instName, number, false)` na Evolution API
2. Atualiza `leads.is_opted_out = false`
3. **NÃO atualiza `agent_memories.is_paused = false`**

Ou seja, quando alguém bloqueia um contato (que seta `is_paused = true` + `is_opted_out = true`) e depois desbloqueia, a IA fica pausada para sempre.

### Correção

**Arquivo:** `src/pages/Chats.tsx` — bloco do "Desbloquear contato" (linhas 3216-3224)

Após setar `is_opted_out: false` no lead, adicionar:
```typescript
await supabase
  .from("agent_memories")
  .update({ is_paused: false })
  .eq("lead_id", chatLead.id)
  .eq("workspace_id", workspaceId);
setSelectedChatAiPaused(false);
```

### Correção imediata para o Clayton

Além do fix no código, a memória do lead `4d5f3ad1` precisa ser despausada. Isso acontecerá automaticamente quando ele clicar em "Retomar IA" no menu de 3 pontos (esse botão já funciona corretamente pois filtra por `lead_id`). Mas com o fix, o "Desbloquear" também fará isso corretamente.

### Resumo das alterações

| Arquivo | O que muda |
|---|---|
| `src/pages/Chats.tsx` | No handler de "Desbloquear contato", adicionar update de `agent_memories.is_paused = false` e `setSelectedChatAiPaused(false)` |

Nenhuma alteração no banco, edge functions, ou outros arquivos.

