
Objetivo da correção
- Resolver de forma definitiva o nó “Aguardar” para permitir múltiplas condicionais no mesmo nó (quantas o usuário adicionar), cada uma com sua própria saída conectável no fluxo.
- Corrigir o comportamento atual em que só uma opção pode ser usada por vez e não existe ramificação real “respondeu x não respondeu”.

Diagnóstico do problema atual (confirmado no código)
1) O editor hoje trata “Aguardar” como escolha única
- Em `src/components/salesbots/WaitNodeContent.tsx`, existe apenas `wait_mode` com select único (`timer`, `message`, `business_hours`).
- Não existe estrutura de múltiplas regras/condições no mesmo nó.

2) O canvas só suporta duas saídas especiais (S/N) para `condition` e `validate`
- Em `src/components/salesbots/BotNodeCard.tsx`, `hasDualOutputs` é fixo para esses tipos.
- Em `src/components/salesbots/BotBuilderCanvas.tsx`, cálculo visual de conexões considera apenas `sourceHandle` `yes/no`.

3) Execução backend de `wait` é simplificada e não representa “aguardar resposta”
- Em `supabase/functions/whatsapp-webhook/index.ts`, `case "wait"` apenas faz `setTimeout` (máx 30s) e segue fluxo linear.
- Não há fila persistente para “aguardar resposta” e “se não responder em X tempo”.

4) Inconsistência de labels de ramificação
- Builder grava labels “Sim/Não” para yes/no.
- Parte da execução usa “true/false” em pontos específicos.
- Isso já é fonte de comportamento imprevisível em nós condicionais e precisa ser padronizado na mesma entrega.

Solução proposta (arquitetura)
Vamos transformar “Aguardar” em um nó de roteamento por condições múltiplas, com saídas dinâmicas.

Modelo de dados do nó `wait` (flow_data JSON)
- Adicionar em `node.data`:
  - `conditions: WaitCondition[]`
  - `default_condition_id` (opcional, para fallback)
- Estrutura de cada condição:
  - `id: string` (estável, usado no `sourceHandle`)
  - `type: "message_received" | "timer" | "business_hours"`
  - `label: string` (exibição no editor e edge)
  - `config: { ... }` (por tipo)
  - `order: number` (prioridade de avaliação)

Exemplo:
- Condição 1: “Se responder” (`message_received`)
- Condição 2: “Se não responder em 30 min” (`timer`, com estratégia de “sem resposta desde o início da espera”)
- Condição 3: “Se cair fora do expediente” (`business_hours`)
Cada condição terá sua própria bolinha de saída no card para conectar ao próximo nó.

Execução assíncrona necessária (backend)
Como “não respondeu em X tempo” não pode ser resolvido no request síncrono do webhook:
- Criar fila persistente para esperas de SalesBot.
- Ao chegar no nó wait:
  - sistema registra itens pendentes da fila (um por condição aplicável),
  - interrompe a execução naquele ponto,
  - retoma depois via evento de mensagem ou job de processamento.

Banco de dados (migração)
Criar tabela `public.salesbot_wait_queue` com:
- `id uuid pk`
- `workspace_id uuid not null`
- `bot_id uuid not null`
- `lead_id uuid not null`
- `wait_node_id text not null`
- `target_node_id text not null`
- `condition_id text not null`
- `condition_type text not null`
- `session_id text` (jid)
- `execute_at timestamptz` (para timer/business_hours)
- `started_at timestamptz not null default now()`
- `status text not null default 'pending'` (`pending|executed|canceled|error`)
- `canceled_reason text`
- `executed_at timestamptz`
- `created_at timestamptz default now()`

Índices:
- `(status, execute_at)`
- `(lead_id, wait_node_id, status)`
- `(session_id, status)`

RLS:
- habilitar RLS
- policy por workspace (mesmo padrão existente):
  - `USING (workspace_id = get_user_workspace_id(auth.uid()))`
  - `WITH CHECK (workspace_id = get_user_workspace_id(auth.uid()))`

Alterações no frontend (editor)
1) `src/components/salesbots/WaitNodeContent.tsx`
- Substituir select único por gerenciador de condições:
  - botão “Adicionar condição”
  - cards de condição com:
    - tipo (respondeu / cronômetro / expediente)
    - configuração por tipo
    - label editável
    - remover/reordenar
- Backward compatibility:
  - se nó antigo tiver `wait_mode`, converter em memória para `conditions` (sem quebrar bots existentes).

2) `src/components/salesbots/BotNodeCard.tsx`
- Trocar lógica binária fixa por saídas dinâmicas para `wait`:
  - renderizar 1 saída por condição usando `condition.id` como `sourceHandle`.
  - manter `condition/validate` como está (ou normalizar para mesma infraestrutura dinâmica, sem alterar UX atual).

3) `src/components/salesbots/BotBuilderCanvas.tsx`
- Conexões:
  - ao criar edge, usar `sourceHandle = condition.id` e `label = condition.label`.
- Renderização de arestas:
  - calcular posição X da origem com base no índice do handle dinâmico no nó wait (não apenas yes/no).
- Defaults:
  - novo `getDefaultNodeData('wait')` já cria condição inicial padrão (ex: “Se responder”).

4) `src/components/salesbots/BotPreviewDialog.tsx`
- Exibir ramificações do wait por condição (não apenas sim/não).
- Mostrar texto amigável de cada regra (ex: “Sem resposta em 30 min”).

5) Ajuste de consistência de labels de branch
- Padronizar resolução de branch por `sourceHandle` prioritariamente (mais seguro que texto).
- Onde hoje busca “true/false”, aceitar também “yes/no” e labels legadas para compatibilidade.

Alterações no backend (execução real)
1) `supabase/functions/whatsapp-webhook/index.ts`
- No início do processamento de mensagem:
  - verificar `salesbot_wait_queue` pendente para o lead/session.
  - se houver condição `message_received` correspondente:
    - cancelar pendências irmãs do mesmo `wait_node_id`,
    - retomar fluxo a partir do `target_node_id` da condição acionada.
- No `case "wait"`:
  - ao invés de sleep linear, enfileirar condições:
    - `message_received`: pendente sem `execute_at`
    - `timer`: `execute_at = started_at + delay`
    - `business_hours`: calcular próximo horário útil e enfileirar
  - encerrar a execução corrente com estado “paused/waiting”.
- Adicionar função de execução “resumeFlowFromNode(botId, lead, startNodeId, ...)” reaproveitando motor atual.

2) `supabase/functions/check-no-response-alerts/index.ts`
- Aproveitar o job já existente para processar também `salesbot_wait_queue`:
  - buscar itens pendentes vencidos (`execute_at <= now`)
  - validar condição antes de disparar:
    - timer com “não respondeu”: confirmar ausência de inbound após `started_at`
      (via `whatsapp_messages` por `remote_jid/session_id`; fallback para lead/session heurística)
    - business_hours: confirmar janela válida
  - executar retomada do fluxo no `target_node_id`
  - marcar item como `executed` e cancelar irmãos do mesmo wait.

Observações importantes de robustez
- Compatibilidade total com bots antigos: converter configuração antiga de wait de forma transparente.
- Idempotência: evitar retomar o mesmo wait duas vezes (lock por status + update atômico).
- Limite anti-loop continua (já existe no webhook com `maxNodes`).
- Não quebrar AI Agent flow (já usa `agent_followup_queue` separado).
- Não alterar arquivos auto-gerados (`src/integrations/supabase/client.ts`, `types.ts`, `supabase/config.toml`).

Sequência de implementação
1. Migração DB da fila `salesbot_wait_queue` + RLS + índices.
2. Refator do motor de execução no webhook para pause/resume por wait.
3. Processador de fila no `check-no-response-alerts`.
4. UI do nó Aguardar com múltiplas condições + handles dinâmicos.
5. Ajustes de canvas/preview/compatibilidade de labels.
6. Atualização de templates para novo formato de wait (mantendo leitura dos legados).
7. Testes manuais ponta a ponta e validações de regressão.

Plano de validação (E2E)
Cenário A (respondeu):
- Fluxo: enviar mensagem -> wait com duas condições (respondeu / 30min sem resposta).
- Lead responde em 2 min.
- Esperado: seguir imediatamente pelo ramo “respondeu”; ramo de timer cancelado.

Cenário B (não respondeu):
- Mesmo fluxo sem resposta.
- Após 30 min (ou tempo curto em teste): seguir pelo ramo timer.
- Esperado: não executar ramo “respondeu”.

Cenário C (múltiplas condicionais):
- wait com 3+ condições conectadas.
- Validar que cada bolinha conecta para nó distinto e cada caminho dispara corretamente.

Cenário D (retrocompatibilidade):
- abrir bot antigo com wait_mode único.
- Esperado: editor mostra condição equivalente e fluxo continua funcional.

Riscos e mitigação
- Risco: duplicidade de disparo por concorrência de webhook/job.
  - Mitigar com update condicional por status pendente e cancelamento transacional de irmãos.
- Risco: heurística de “respondeu” inconsistente.
  - Mitigar consultando `whatsapp_messages` inbound por `remote_jid/session_id` e timestamp.
- Risco: quebra visual em edges dinâmicos.
  - Mitigar com fallback para centro quando handle não encontrado.

Resultado esperado para o usuário
- No nó Aguardar, você poderá adicionar quantas condicionais quiser.
- Cada condicional terá sua saída própria para “puxar” o próximo nó.
- Funcionará exatamente como você descreveu:
  - “se respondeu” segue por um caminho,
  - “se não respondeu em cronômetro X” segue por outro,
  - e outras condições no mesmo nó, cada uma com seu próprio fluxo.
