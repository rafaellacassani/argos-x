---
name: AI Departments System
description: Departamentos agrupam agentes de IA. Roteamento prioriza lock por lead, depois recepção. Tool transferir_departamento permite IA transferir sozinha. Anti-loop com 3 transferências em 10min escala para humano.
type: feature
---
- Tabela `ai_departments` (workspace_id, name, description, color, is_reception, position)
- `ai_agents.department_id`, `leads.active_agent_id/active_department_id/active_agent_set_at`
- `agent_memories.transfer_count/last_transfer_at` (anti-loop)
- Tabela `department_transfers` (auditoria)
- RPC `claim_lead_agent(lead, agent, dept)` faz lock atômico (libera após 24h)
- Página `/departamentos` (CRUD + vincular agentes)
- Tool `transferir_departamento` no `ai-agent-chat` (sempre habilitada quando agente tem departamento)
- `transfer-to-agent` aceita `target_department_name`, valida loop (3/10min → human_support_queue), aceita service-role token para chamadas internas
- `whatsapp-webhook`: prioriza locked agent → recepção → primeiro da instância
