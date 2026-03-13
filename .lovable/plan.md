

# Plano: Google Meet automático + link nos lembretes da IA

## O que será feito

1. **Gerar link do Google Meet automaticamente** ao criar eventos no Google Calendar
2. **Salvar o link do Meet** na tabela `calendar_events`
3. **Incluir o link do Meet nos lembretes** que a agente de IA envia ao cliente
4. **Adicionar configuração na aba Ferramentas** do agente para ativar/desativar geração de Meet
5. **Respeitar as permissões do `calendar_config`** (usar os reminders configurados pelo usuário, não hardcoded)

## Detalhes técnicos

### 1. Migração: adicionar coluna `meet_link` na tabela `calendar_events`
- Nova coluna `meet_link text nullable`

### 2. Edge Function `sync-google-calendar` (push)
- Ao criar evento, incluir `conferenceData` + `conferenceDataVersion: 1` no payload para o Google Calendar API gerar automaticamente um link do Google Meet
- Salvar o `hangoutLink` retornado pelo Google na coluna `meet_link`

### 3. Edge Function `ai-agent-chat` (gerenciar_calendario)
- Ao criar evento via IA, adicionar `conferenceData` request na criação do Google Calendar
- Ler `calendar_config` do agente para usar os reminders configurados (ao invés de hardcoded 3h/30min)
- Incluir o link do Meet na mensagem de lembrete: "Link da reunião: {meet_link}"
- Após criar o evento local, tentar push para Google Calendar e capturar o meet_link
- Adicionar toggle `include_meet_link` no `calendar_config`

### 4. Frontend `ToolsTab.tsx`
- Adicionar switch "Gerar link do Google Meet" dentro das opções de calendário
- Salvar como `calendar_config.generate_meet_link: boolean`

### 5. Pull de eventos (`/pull`)
- Ao importar eventos do Google, salvar o `hangoutLink` no campo `meet_link`

