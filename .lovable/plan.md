

# Enriquecer o Assistente de Workspace com Performance de IAs, Reuniões e Follow-ups

## Objetivo
Adicionar dados de **execuções de agentes IA**, **reuniões agendadas**, **follow-ups enviados** e **alertas críticos** ao Assistente de Workspace — tanto no widget web quanto no WhatsApp.

## O que muda

### 1. `supabase/functions/workspace-assistant/index.ts` (widget web)

Adicionar 4 novas consultas ao `Promise.all` existente (linha ~53):

- `agent_executions` — últimas 24h, agrupadas por agente (total, sucesso, erro, tokens)
- `calendar_events` — eventos de hoje e próximos 7 dias
- `followup_campaigns` — campanhas de follow-up inteligente recentes com contadores
- `agent_followup_queue` — follow-ups automáticos de agentes (pendentes/enviados últimas 24h)

Enriquecer o `contextData` com:
```
ai_performance: { agent_name, total, success, errors, avg_latency_ms }
calendar_today: [{ title, start_at, end_at, type, lead_name }]
calendar_upcoming: [{ title, start_at }]
followup_campaigns_recent: [{ name, status, sent, total, failed }]
agent_followups_24h: { pending, sent }
```

Atualizar o system prompt para incluir instruções sobre como interpretar esses dados (ex: "Se perguntarem como foi o dia, inclua performance dos agentes, reuniões e follow-ups").

### 2. `supabase/functions/whatsapp-webhook/index.ts` (assistente WhatsApp)

Mesmo enriquecimento no bloco do assistente (linhas ~999-1026):

- Adicionar as mesmas 4 consultas ao `Promise.all`
- Incluir os dados no objeto `ctx`
- Atualizar o `sysPrompt` para mencionar as novas capacidades

### 3. System prompt aprimorado

Adicionar ao prompt de ambos os endpoints:

- "Se perguntarem 'como foi o dia', forneça um resumo completo: leads novos, execuções de IA (taxa de sucesso), reuniões agendadas/realizadas, follow-ups enviados, e alertas críticos"
- "ai_performance mostra as execuções dos agentes de IA nas últimas 24h — use para responder sobre desempenho das IAs"
- "calendar_today e calendar_upcoming mostram reuniões — use para responder sobre agenda"
- "Se houver erros de IA acima de 10%, destaque como alerta"

## Arquivos modificados
1. `supabase/functions/workspace-assistant/index.ts`
2. `supabase/functions/whatsapp-webhook/index.ts`

## Resultado
O usuário poderá perguntar (via web ou WhatsApp):
- "Como foi o dia hoje?" → resumo completo com leads, IAs, reuniões, follow-ups
- "A Iara está funcionando bem?" → taxa de sucesso, erros, latência
- "Quantas reuniões agendadas?" → dados do calendário
- "Quantos follow-ups foram enviados?" → volume de campanhas e automáticos

