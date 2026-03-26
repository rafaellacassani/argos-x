

## Diagnóstico Completo: Calendário nos Agentes de IA

### O que funciona hoje
1. **Criar evento** — funciona, insere em `calendar_events`
2. **Sync para Google Calendar** — tenta push após criar evento
3. **Meet link** — gerado via Google Calendar e incluído nos lembretes
4. **Lembretes automáticos** — cria `scheduled_messages` com os offsets configurados
5. **Reagendar e cancelar** — atualiza/deleta no banco
6. **UI de configuração** — aba Ferramentas permite configurar permissões, lembretes e Meet link

### Problemas encontrados

**1. `calendar_config` não persiste no banco** (CRÍTICO)
- A coluna `calendar_config` **não existe** na tabela `ai_agents`
- A UI em `ToolsTab.tsx` permite configurar lembretes, permissões e Meet link, mas esses dados nunca são salvos
- No `ai-agent-chat`, a leitura faz `(agent as any).calendar_config` que sempre retorna `undefined`, caindo no fallback `["180", "30"]`
- Resultado: qualquer configuração de lembrete feita pelo cliente é **ignorada**

**2. Reagendar não sincroniza com Google**
- Ao reagendar, o código atualiza o banco local mas **não chama** `sync-google-calendar/push`
- O evento fica dessincronizado: Google mostra horário antigo, sistema mostra novo

**3. Cancelar não remove lembretes pendentes**
- Ao cancelar um evento, o código deleta o `calendar_events` mas **não cancela** os `scheduled_messages` de lembrete associados
- Resultado: lead recebe lembrete de reunião que já foi cancelada

**4. Cancelar não sincroniza delete com Google**
- Não chama `sync-google-calendar/delete` ao cancelar via IA
- Evento permanece no Google Calendar do dono do workspace

**5. Consultar disponibilidade é limitado**
- Só consulta eventos do lead específico, não verifica **horários ocupados** do calendário geral
- A IA não sabe se um horário já está ocupado por outro compromisso
- Pode agendar duas reuniões no mesmo horário

**6. Sem gate por plano**
- A ferramenta de calendário está disponível para **todos os planos**, sem restrição
- Deveria ser restrita a partir do plano Business (negócio)

**7. Reagendar não atualiza lembretes**
- Ao reagendar, os lembretes antigos permanecem com horários errados
- Não cria novos lembretes para o novo horário

### Plano de correção

**1. Migração: adicionar coluna `calendar_config`**
```sql
ALTER TABLE ai_agents ADD COLUMN calendar_config jsonb DEFAULT '{}';
```

**2. `supabase/functions/ai-agent-chat/index.ts`**
- **Gate por plano**: antes de executar `gerenciar_calendario`, verificar `workspace.plan_type` — permitir apenas `negocio`, `escala`, `active` e admin. Se não permitido, retornar mensagem educada
- **Consultar disponibilidade real**: ao consultar, buscar TODOS os eventos do workspace no período (não só do lead), para verificar conflitos
- **Reagendar com sync Google**: após atualizar o evento, chamar `sync-google-calendar/push` (igual ao criar)
- **Reagendar atualiza lembretes**: deletar `scheduled_messages` antigos do evento e criar novos com base no novo horário
- **Cancelar com sync Google**: chamar `sync-google-calendar/delete` antes de deletar localmente
- **Cancelar remove lembretes**: deletar `scheduled_messages` pendentes associados ao evento cancelado

**3. `src/components/agents/AgentDetailDialog.tsx`**
- Incluir `calendar_config` no payload de save do agente

### Arquivos alterados
| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar coluna `calendar_config` em `ai_agents` |
| `supabase/functions/ai-agent-chat/index.ts` | Gate por plano, sync Google em reagendar/cancelar, lembretes em reagendar/cancelar, consulta de disponibilidade real |
| `src/components/agents/AgentDetailDialog.tsx` | Incluir `calendar_config` no payload de save |

### Resultado esperado
- Configurações de lembrete persistem e são respeitadas
- Reagendar/cancelar sincroniza com Google Calendar
- Lembretes são atualizados/removidos corretamente
- IA verifica conflitos de horário antes de agendar
- Ferramenta restrita ao plano Business+

