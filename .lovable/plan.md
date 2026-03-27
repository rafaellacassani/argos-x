

## Plano: Corrigir tracking de tokens Anthropic + Redesign Admin Saúde

### Problema 1: Tokens Anthropic não registrados
O `ai-agent-chat` extrai tokens do response da API, mas para Anthropic o campo está diferente (`usage.input_tokens` + `usage.output_tokens`) e provavelmente não está sendo lido corretamente — todos os registros mostram `tokens_used: 0`.

### Problema 2: Consumo 10x maior
O pico de execuções (64/dia → 800/dia) precisa investigação. Possíveis causas:
- Follow-ups automáticos gerando loops
- Reprocessamento de mensagens duplicadas
- Aumento real de volume de leads

### Problema 3: Admin Saúde lento e pouco prático
Hoje abre tudo via Accordion na mesma página. Proposta: lista compacta com métricas-resumo + clique para abrir detalhes do workspace em um dialog/sheet.

### Alterações

**1. `supabase/functions/ai-agent-chat/index.ts` — Fix token tracking Anthropic**
- Localizar onde extrai `usage` da resposta da API
- Garantir que para Anthropic lê `usage.input_tokens + usage.output_tokens`
- Para OpenAI/Lovable Gateway lê `usage.total_tokens`
- Salvar corretamente em `agent_executions.tokens_used`

**2. `supabase/functions/admin-clients/index.ts` — Adicionar tokens por workspace no health-monitoring**
- Na action `health-monitoring`, já calcula `tokens_total` por agente
- Garantir que soma tokens de `agent_executions` dos últimos 30 dias por workspace
- Adicionar campo `executions_30d` e `tokens_30d` ao retorno

**3. `src/components/admin/WorkspaceHealthTab.tsx` — Redesign para lista compacta + dialog de detalhes**
- Substituir o Accordion por uma **tabela/lista compacta** com colunas:
  - Nome | Plano | Leads (usado/limite) | Execuções IA 30d | Tokens 30d | Instâncias | Status | Ações
- Ao clicar na linha ou botão "Ver detalhes": abre um **Sheet/Dialog** com todas as informações expandidas (agentes, instâncias, alertas, consumo detalhado)
- Manter filtros e busca no topo
- Adicionar coluna de tokens/custo estimado visível na lista principal

### Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `ai-agent-chat/index.ts` | Fix extração de tokens para Anthropic (usage.input_tokens + output_tokens) |
| `admin-clients/index.ts` | Agregar tokens_30d e executions_30d por workspace no health-monitoring |
| `WorkspaceHealthTab.tsx` | Tabela compacta + Sheet de detalhes ao clicar |

### O que NÃO será alterado
- Nenhum modelo de agente de cliente será alterado
- Nenhuma lógica de SalesBot, calendário, FAQ
- Nenhuma tabela do banco (apenas leitura de dados existentes)

