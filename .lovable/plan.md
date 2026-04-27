
## Objetivo

Impedir que workspaces clientes ultrapassem o limite mensal de interações com Agentes de IA (campo `ai_interactions_limit` que já existe em `workspaces`). Se estourar, o agente para de responder e o cliente recebe uma mensagem amigável sugerindo upgrade. Argos X e ECX Company nunca são bloqueados. Contador zera no dia 1 de cada mês.

## Estado atual (já existe)

- Tabela `workspaces` já tem `ai_interactions_limit` e `ai_interactions_used`.
- Limites por plano já definidos: Gratuito 100, Essencial 500, Negócio 2.000, Escala 10.000+.
- A função `ai-agent-chat` já tem a lista `MASTER_WORKSPACE_IDS` (Argos X + ECX) usada para a chave OpenAI direta — vamos reaproveitar.
- `ai_interactions_used` está em 0 em todas as 374 workspaces (nunca foi incrementado). Vamos começar a contar do zero a partir de agora.
- Cron `check-overdue-workspaces-hourly` já roda de hora em hora — vamos pendurar o reset mensal nele para não criar nova infra.

## O que vai ser feito

### 1. Edge function `ai-agent-chat` — checagem ANTES de processar

No início do handler, depois de buscar o `agent` e validar workspace bloqueada (já existe), adicionar:

```text
Se workspace_id NÃO está em MASTER_WORKSPACE_IDS:
  buscar workspaces.ai_interactions_used e ai_interactions_limit
  se used >= limit (e limit > 0):
    - Logar em agent_executions com status="quota_exceeded"
    - Enviar UMA mensagem amigável via Evolution/WABA para o lead:
      "Olá! 👋 No momento não consigo continuar o atendimento automático
      porque o limite mensal de interações do plano foi atingido.
      Em breve um atendente humano falará com você. Obrigado pela paciência!"
      (Só envia 1 vez por sessão usando agent_memories.is_paused para não spammar.)
    - Pausar a sessão (agent_memories.is_paused = true) para o agente não tentar de novo no resto do mês
    - Retornar 200 { skipped: true, reason: "quota_exceeded" }
```

A mensagem para o lead usa o mesmo helper de envio (`sendViaEvolution` / WABA) já presente na função. Se preferir não notificar o lead (apenas silenciar), deixo isso como flag — confirme abaixo.

### 2. Edge function `ai-agent-chat` — incremento APÓS sucesso

No ponto onde a função registra `agent_executions` com `status: "success"` (após receber resposta da OpenAI/Lovable Gateway), adicionar:

```text
Se workspace_id NÃO está em MASTER_WORKSPACE_IDS:
  UPDATE workspaces SET ai_interactions_used = ai_interactions_used + 1
  WHERE id = agent.workspace_id
```

Usado um `rpc` atômico (`increment_ai_interactions(workspace_id)`) para evitar race condition entre execuções paralelas do mesmo workspace.

### 3. Função SQL `increment_ai_interactions`

Migração nova:

```sql
CREATE OR REPLACE FUNCTION public.increment_ai_interactions(_workspace_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE workspaces
  SET ai_interactions_used = COALESCE(ai_interactions_used, 0) + 1
  WHERE id = _workspace_id
  RETURNING ai_interactions_used;
$$;
```

### 4. Reset mensal automático

Criar função SQL + cron job dedicado (não misturar com `check-overdue-workspaces`):

```sql
CREATE OR REPLACE FUNCTION public.reset_ai_interactions_monthly()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE workspaces SET ai_interactions_used = 0;
$$;

-- Cron: dia 1 de cada mês às 00:05
SELECT cron.schedule(
  'reset-ai-interactions-monthly',
  '5 0 1 * *',
  $$ SELECT public.reset_ai_interactions_monthly(); $$
);
```

Argos X e ECX são incluídos no reset (não faz mal, eles nunca são checados nem incrementados de qualquer forma).

### 5. Banner visual no frontend (opcional, recomendado)

O hook `usePlanLimits.ts` já expõe `aiInteractionsUsed` e `aiInteractionsLimit`, e o `ActivePlanCard` já mostra a barra. Como agora os números vão começar a se mexer de verdade, adicionar:

- Um aviso laranja quando o uso passar de 80%.
- Um aviso vermelho com CTA "Fazer upgrade" quando passar de 100%.

Aproveitando o componente `PlanExcessBanner.tsx` já existente para incluir mais essa categoria de excesso.

## Master workspaces (nunca bloqueados, nunca contados)

```text
Argos X     → 41efdc6d-d4ba-4589-9761-7438a5911d57
ECX Company → 6a8540c9-6eb5-42ce-8d20-960002d85bac
```

Já estão na constante `MASTER_WORKSPACE_IDS` dentro de `ai-agent-chat`. Reaproveitamos.

## Arquivos afetados

- `supabase/functions/ai-agent-chat/index.ts` — adicionar checagem + incremento (~30 linhas)
- Migração SQL — função `increment_ai_interactions` + função `reset_ai_interactions_monthly`
- Cron via SQL insert (não migração, conforme regra) — `reset-ai-interactions-monthly`
- `src/components/layout/PlanExcessBanner.tsx` — incluir alerta de IA
- `src/hooks/usePlanExcess.ts` — incluir IA na detecção (opcional)

## Validação pós-deploy

1. Rodar uma chamada de teste em workspace cliente → verificar que `ai_interactions_used` incrementa de 1.
2. Rodar uma chamada de teste em Argos X → verificar que `ai_interactions_used` NÃO incrementa.
3. Forçar `ai_interactions_used = ai_interactions_limit` numa workspace de teste → próxima mensagem deve retornar `quota_exceeded` e o cliente recebe o aviso amigável.
4. Verificar `cron.job` para confirmar que `reset-ai-interactions-monthly` está agendado.

## Pontos para confirmar antes de implementar

1. **Quando o limite é atingido, o lead recebe a mensagem amigável via WhatsApp** ou prefere **silenciar (apenas o agente para de responder, sem texto para o lead)**? O texto sugerido é:
   > "Olá! 👋 No momento não consigo continuar o atendimento automático porque o limite mensal de interações do plano foi atingido. Em breve um atendente humano falará com você."

2. **Limite do plano Gratuito (100/mês) é muito baixo** — uma única conversa de 5 minutos pode estourar. Confirma que está ok manter 100, ou prefere subir? (Recomendo subir Gratuito para 300 e Essencial para 1.000.)

Se confirmar essas duas perguntas, sigo direto para implementação.
