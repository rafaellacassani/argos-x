

## Diagnóstico

Conferi as suas agentes. Aqui está o status atual:

| Agente | Modelo | Ativo |
|--------|--------|-------|
| **Iara** | `anthropic/claude-3-5-sonnet-20241022` | ✅ |
| **Iara da Argos X** | `anthropic/claude-3-5-sonnet-20241022` | ✅ |

As duas Iaras estão corretamente configuradas com **Claude 3.5 Sonnet** e ativas. O roteamento direto para a API da Anthropic usando sua `ANTHROPIC_API_KEY` está implementado no backend. Tudo certo.

**Porém há um problema**: existem **6 outros agentes** (Rebeca, Aslan, Maya, Sofia, Ana Cristina, e um com nome estranho) ainda usando `google/gemini-3-flash-preview`, que é o gateway Lovable (e pode dar erro 402). Esses parecem ser de teste ou de outros workspaces.

---

## O que precisa ser feito

O default `openai/gpt-4o-mini` já está configurado no wizard de criação (`CreateAgentDialog`), mas os agentes **já existentes** em outros workspaces continuam com o modelo antigo. Precisamos:

### 1. Migrar agentes existentes que usam modelos do gateway Lovable
Uma migration SQL para trocar todos os agentes que ainda usam `google/gemini-3-flash-preview` (ou outros modelos google) para `openai/gpt-4o-mini` — **exceto** os seus (que já estão com Claude).

```sql
UPDATE ai_agents 
SET model = 'openai/gpt-4o-mini' 
WHERE model LIKE 'google/%';
```

### 2. Garantir no backend que o fallback default seja `openai/gpt-4o-mini`
Na linha 683 do `ai-agent-chat/index.ts`, o fallback já é `openai/gpt-4o-mini`. Correto.

### 3. Nenhuma mudança no frontend necessária
O `CreateAgentDialog` já usa `openai/gpt-4o-mini` como default. A lista de modelos no `AdvancedTab` está correta.

---

## Resumo

- Suas duas Iaras com Claude Sonnet: **OK, confirmado**
- Roteamento OpenAI/Anthropic direto com suas API keys: **OK, implementado**
- Default para novos agentes em qualquer workspace: **GPT-4o Mini** (já configurado)
- Ação necessária: **1 migration SQL** para migrar agentes existentes de `google/*` para `openai/gpt-4o-mini`

### Arquivos alterados
- Migration SQL (nova) — atualizar modelo dos agentes existentes

