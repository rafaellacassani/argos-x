

## Análise da necessidade

Hoje o sistema já tem:
- **Múltiplos agentes de IA** por workspace (`ai_agents`)
- **Transferência entre agentes** funcional (`transfer-to-agent` edge function + `TransferToAgentButton` no chat) — mas **manual**, feita por humano
- **Memórias por sessão** (`agent_memories`) com pause/resume
- **Tool `pausar_ia`** para handoff humano
- **Roteamento por instância**: o `whatsapp-webhook` escolhe o agente comparando `instance_name`

O que **falta** para virar "departamentos":
1. Agrupar agentes em **departamentos** lógicos (Receptiva, Suporte, Financeiro, Comercial...)
2. Definir **um agente "porta de entrada"** (receptionist) por instância de WhatsApp
3. Permitir que a IA **transfira sozinha** para outro departamento via tool call (`transferir_departamento`)
4. **Lock de sessão** garantindo que **apenas 1 IA responde por vez** ao mesmo lead (anti-race condition)
5. **Histórico contextual** passado entre departamentos (já existe parcialmente no `transfer-to-agent`)

## Como tornar "inquebrável" (anti-bug)

O risco real são **3 bugs clássicos** em multi-agente:

| Bug | Solução |
|-----|---------|
| 2 IAs respondendo ao mesmo lead | **Lock exclusivo** via `agent_memories.is_processing` + coluna nova `active_agent_id` em `leads` (única IA "dona" do lead por vez) |
| Loop de transferência (A→B→A→B) | Contador `transfer_count` na sessão, máximo 3 transferências em 10min, depois força handoff humano |
| IA errada respondendo após transferência | Webhook lê `leads.active_agent_id` ANTES de matchear por `instance_name`. Se setado, usa direto esse agente. |

## Plano de implementação

### 1. Banco de dados (migration)

```sql
-- Departamentos
CREATE TABLE ai_departments (
  id uuid PK,
  workspace_id uuid,
  name text,                  -- "Suporte", "Financeiro", "Comercial"
  description text,            -- contexto que a IA usa para decidir transferir
  icon text,
  color text,
  is_reception boolean,        -- TRUE = recebe primeiro contato
  position int,
  created_at, updated_at
);

-- Vínculo agente <-> departamento
ALTER TABLE ai_agents ADD COLUMN department_id uuid;

-- "Dono" atual da conversa
ALTER TABLE leads ADD COLUMN active_agent_id uuid;
ALTER TABLE leads ADD COLUMN active_department_id uuid;

-- Anti-loop
ALTER TABLE agent_memories ADD COLUMN transfer_count int DEFAULT 0;
ALTER TABLE agent_memories ADD COLUMN last_transfer_at timestamptz;

-- Log de transferências (auditoria)
CREATE TABLE department_transfers (
  id uuid PK,
  workspace_id, lead_id,
  from_agent_id, to_agent_id,
  from_department_id, to_department_id,
  reason text,                 -- razão dada pela IA
  triggered_by text,           -- 'ai_auto' | 'human' | 'rule'
  created_at
);
```

### 2. Nova página: **Departamentos** (`/departamentos`)

UI simples e visual:
- Lista de cards com departamentos + agentes vinculados
- Botão "Criar Departamento" (nome, descrição, cor, ícone, marcar como recepção)
- Drag-and-drop para mover agentes entre departamentos
- Indicador visual de qual é o **departamento de recepção** (estrela)
- Validação: só **1 recepção por instância de WhatsApp**

### 3. Tool nova no `ai-agent-chat`: `transferir_departamento`

```json
{
  "name": "transferir_departamento",
  "description": "Quando a conversa fugir do seu escopo (ex: cliente pergunta sobre cobrança e você é de suporte), transfira para o departamento correto.",
  "parameters": {
    "department_name": "Suporte | Financeiro | Comercial...",
    "reason": "Motivo curto"
  }
}
```

A IA ganha no system prompt uma seção automática:
> "Você faz parte do departamento **{X}**. Outros departamentos disponíveis: **Financeiro** (cobrança/pagamento), **Suporte** (problemas técnicos)... Se o cliente pedir algo fora do seu escopo, use `transferir_departamento`."

### 4. Roteamento inquebrável no `whatsapp-webhook`

Ordem de matching (NOVA):
1. Se `leads.active_agent_id` existe → usa esse agente direto (lock ativo)
2. Senão, busca agente cuja `instance_name` bate E `is_reception=true`
3. Senão, fallback antigo (primeiro agente ativo da instância)

Após a IA responder ou transferir, atualiza `leads.active_agent_id`.

### 5. Função `transfer-to-agent` evoluída

- Aceita transferência via **tool call** (não só botão)
- Incrementa `transfer_count`
- Se `transfer_count >= 3` em 10min → cria ticket humano automático (`human_support_queue`) em vez de transferir
- Atualiza `leads.active_agent_id` e `active_department_id` atomicamente
- Loga em `department_transfers`

### 6. UI no chat

- Badge mostrando **qual departamento/agente está atendendo agora** (próximo ao nome do lead)
- Histórico de transferências visível na timeline do lead
- Botão de transferência manual já existente passa a listar **agrupado por departamento**

## Detalhes técnicos críticos (anti-bug)

1. **Lock atômico**: usar `UPDATE leads SET active_agent_id = $1 WHERE id = $2 AND (active_agent_id IS NULL OR active_agent_id = $3) RETURNING id` — se não retornar linha, outra IA pegou primeiro, aborta.
2. **Race no webhook**: o lock `agent_memories.is_processing` (já existe) continua valendo POR AGENTE, mas adicionamos lock POR LEAD via `active_agent_id`.
3. **Limpeza**: cron de 30min limpa `active_agent_id` se a última mensagem da conversa for > 24h (libera para nova recepção).
4. **Migração suave**: agentes existentes ficam sem `department_id` (NULL) e funcionam como hoje. Só ativam departamentos quem criar pelo menos 1 departamento.

## Resumo do que será entregue

- Migration com 1 tabela nova (`ai_departments`), 1 de log (`department_transfers`), 4 colunas novas
- Página `/departamentos` (CRUD + drag-and-drop)
- Tool `transferir_departamento` no `ai-agent-chat`
- Lógica de lock + roteamento no `whatsapp-webhook`
- Evolução de `transfer-to-agent` (anti-loop + auto-handoff humano)
- Badge no chat mostrando departamento ativo
- Item "Departamentos" no sidebar

Tudo retrocompatível: workspaces sem departamentos continuam funcionando exatamente como hoje.

<lov-actions>
<lov-suggestion message="Perfeito, implemente tudo conforme o plano: migration, página de Departamentos, tool de transferência automática e lock anti-bug.">Implementar tudo do plano</lov-suggestion>
<lov-suggestion message="Implemente apenas a base primeiro: tabela ai_departments + página de gerenciamento + vinculação de agentes. A lógica de transferência automática fazemos depois.">Fazer só a base agora</lov-suggestion>
<lov-suggestion message="Antes de implementar, me mostre um mockup visual de como ficaria a página de Departamentos.">Quero ver mockup primeiro</lov-suggestion>
</lov-actions>
