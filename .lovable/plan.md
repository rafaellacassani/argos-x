
# Nova Tool: Agendar Follow-up Contextual para Agente de IA

## Problema
Quando um lead diz "me chama depois das 9h amanha", a agente de IA nao tem como agendar esse recontato automaticamente. Hoje isso se perde e depende de acao manual.

## Solucao
Adicionar uma nova ferramenta (tool) `agendar_followup` ao sistema de IA, permitindo que ela interprete pedidos de agendamento do lead e crie automaticamente uma mensagem programada na tabela `scheduled_messages`.

## Como vai funcionar (fluxo)
1. Lead diz: "Me chama depois das 9h amanha"
2. A IA interpreta e chama a tool `agendar_followup` com data/hora e mensagem
3. O sistema insere na tabela `scheduled_messages`
4. O cron `send-scheduled-messages` (ja existe, roda a cada minuto) envia automaticamente no horario correto
5. O lead recebe a mensagem no WhatsApp no horario combinado

## Mudancas Tecnicas

### 1. Edge Function `ai-agent-chat/index.ts`
- Adicionar nova tool `agendar_followup` no `getToolDefinitions()`:
  - Parametros: `lead_id`, `scheduled_at` (ISO datetime), `message` (texto a enviar)
- Adicionar handler de execucao da tool que insere na tabela `scheduled_messages` com os dados corretos (instance_name, remote_jid, channel_type, workspace_id)
- Adicionar instrucao no system prompt para a IA saber interpretar pedidos de horario relativo ("amanha as 9h", "daqui 2 horas", "segunda-feira")

### 2. Tab de Ferramentas (`src/components/agents/tabs/ToolsTab.tsx`)
- Adicionar `agendar_followup` na lista `availableTools` com label "Agendar Follow-up" e descricao "Agendar uma mensagem para ser enviada em um horario especifico"

### 3. Instrucoes no Prompt (automatico via `ai-agent-chat`)
- Ao detectar a tool `agendar_followup` habilitada, injetar instrucao no system prompt:
  - "Quando o lead pedir para ser contactado em um horario especifico, use a tool agendar_followup. Interprete expressoes como 'amanha as 9h', 'daqui 1 hora', 'na segunda'. Sempre confirme o agendamento na resposta."
  - Incluir o timezone do workspace (ou default BRT -3) para calculos corretos

### 4. Nenhuma migracao de banco necessaria
- A tabela `scheduled_messages` ja existe e suporta todos os campos necessarios
- O cron `send-scheduled-messages` ja processa e envia automaticamente

## Resultado Esperado
A IA vai conseguir:
- Interpretar "me chama amanha depois das 9h" -> agendar para o dia seguinte as 09:00
- Interpretar "daqui 2 horas" -> agendar para now() + 2h
- Confirmar ao lead: "Combinado! Te chamo amanha as 9h"
- A mensagem aparece na aba Follow-ups do lead
- No horario, o sistema envia automaticamente pelo WhatsApp
