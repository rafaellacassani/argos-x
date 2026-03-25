

## Diagnóstico: Como funciona hoje

Analisei todo o sistema e aqui está o cenário atual:

1. **A IA já sabe pedir ajuda humana** — O agente tem uma tool chamada `pausar_ia` que, quando acionada, marca `is_paused = true` na sessão (`agent_memories`). Também pausa automaticamente após 3 fallbacks consecutivos.

2. **O que falta é a organização do lado humano** — Quando a IA pausa, o lead fica "solto" no chat geral misturado com todas as outras conversas. Não existe fila, prioridade, nem controle de "quem está atendendo quem".

3. **Já existe um sistema de tickets** (`support_tickets` + `support_messages`), mas é usado apenas para suporte interno da plataforma (Aria). Não está conectado ao fluxo de WhatsApp.

---

## Proposta: Sistema de Fila de Atendimento Humano

Em vez de criar um módulo separado de tickets (que duplicaria o chat), a abordagem mais eficiente é **adicionar um sistema de fila dentro do próprio Chat**, aproveitando que as conversas já existem lá.

### Como funcionaria

```text
IA não consegue resolver
  → IA usa tool "pausar_ia" (já existe)
  → Sistema cria registro na fila de atendimento (NOVO)
  → Badge aparece no Chat: "3 aguardando atendimento"
  → Vendedor/Atendente clica → vê fila filtrada
  → Abre conversa, resolve, clica "Finalizar atendimento"
  → Remove da fila, retoma IA se desejado
```

### Implementação

**1. Nova tabela `human_support_queue`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| workspace_id | uuid | Tenant |
| lead_id | uuid | Lead em atendimento |
| agent_id | uuid | Agente de IA que pausou |
| session_id | text | Sessão do agent_memories |
| reason | text | Motivo (fallback_limit, pausar_ia, manual) |
| status | text | waiting, in_progress, resolved |
| assigned_to | uuid | Usuário humano atendendo |
| instance_name | text | Instância WhatsApp |
| created_at | timestamptz | Quando entrou na fila |
| resolved_at | timestamptz | Quando finalizou |

**2. Backend — Criar entrada na fila automaticamente** (`ai-agent-chat/index.ts`)
- Quando `pausar_ia` é acionado ou fallback limit é atingido, inserir registro em `human_support_queue` com status `waiting`
- Incluir o motivo da pausa

**3. Frontend — Indicador de fila no Chat** (`src/pages/Chats.tsx`)
- Badge no topo do chat mostrando quantidade de conversas aguardando atendimento humano
- Filtro rápido "Aguardando atendimento" que mostra só os chats da fila
- Ao abrir um chat da fila, botão "Assumir atendimento" que marca `assigned_to` e status `in_progress`
- Botão "Finalizar atendimento" que marca `resolved` e opcionalmente retoma a IA (`is_paused = false`)

**4. Notificação** — Reaproveitar a lógica existente de notificação WhatsApp para avisar responsáveis quando um lead entra na fila

### Arquivos a modificar
- **Nova migração**: criar tabela `human_support_queue` com RLS
- **`supabase/functions/ai-agent-chat/index.ts`**: inserir na fila nos pontos de pausa
- **`src/pages/Chats.tsx`**: badge de fila, filtros, botões de assumir/finalizar
- **`src/components/chat/ChatFilters.tsx`**: novo filtro "Aguardando atendimento"

### Vantagens desta abordagem
- **Sem duplicação** — usa o chat que já existe, não cria tela nova
- **Visibilidade** — badge mostra claramente quantos leads precisam de atenção
- **Controle** — sabe quem está atendendo quem, quando começou, quando finalizou
- **Métricas futuras** — tempo médio de espera, tempo de resolução, volume por período
- **Retomada da IA** — ao finalizar, pode reativar o agente automaticamente

