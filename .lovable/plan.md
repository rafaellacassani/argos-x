

# Relatório de Saúde do Sistema - 10/Abril/2026

---

## Resumo Executivo

| Area | Status | Detalhes |
|------|--------|---------|
| Agentes de IA | ⚠️ Atenção | 28 de 53 agentes ativos silenciosos nas últimas 24h; 865 sessões travadas há +7 dias |
| Chat / Webhooks | ✅ Operacional | Webhooks recebendo mensagens normalmente, sem erros 500 nas últimas 24h |
| Financeiro | 🔴 CRÍTICO | 3 assinaturas Asaas e ~20 Stripe NÃO canceladas em workspaces bloqueados/cancelados |
| Conexões | ✅ Operacional | Sem erros de Edge Functions nas últimas 24h |
| Edge Functions | ✅ Operacional | Zero erros 4xx/5xx nas últimas 24h |

---

## 🤖 Agentes de IA

**53 agentes ativos** no total:
- **25 respondendo** nas últimas 24h
- **28 silenciosos** — a maioria sem receber mensagens (workspaces pequenos ou novos), sem erro de API

**Erros de API nas últimas 24h**: Zero. Nenhum registro de `status: 'error'` em `agent_executions`.

**Sessões pausadas (potencialmente travadas)**:
- **865 sessões** pausadas há mais de 7 dias (sem ticket de suporte aberto)
- **522 sessões** pausadas entre 2 e 7 dias
- **158 sessões** pausadas recentemente (comportamento normal)

**Problema principal**: As 865 sessões com mais de 7 dias de pausa são leads que a IA nunca mais vai responder. O mecanismo de auto-resume (2h) existe no código, mas só funciona se não houver suporte humano ativo — e muitas dessas sessões têm `open_tickets: 0`, ou seja, estão travadas sem motivo.

**Follow-ups presos**: Zero follow-ups pendentes há mais de 24h. A fila está limpa.

---

## 💳 Financeiro — CRÍTICO

### Workspaces com vazamento de cobrança

**3 workspaces cancelados/bloqueados que AINDA TÊM `asaas_subscription_id` ativo no banco** (podem estar sendo cobrados):

| Workspace | Asaas Sub ID | Status |
|-----------|-------------|--------|
| ecxxxx | sub_7bqr5idddbyut0w5 | canceled |
| Espaço Bem Estar Fátima Ribeiro | sub_4gppfbfqi4ei1pbn | canceled |
| silmara | sub_orvqytwblvmdn7h7 | canceled |

**~20 workspaces bloqueados que AINDA TÊM `stripe_subscription_id` com status `past_due`**. O Stripe continua tentando cobrar esses clientes. A função `cancel-subscription` cancela o Stripe corretamente quando chamada, MAS o bloqueio automático via cron (`check-no-response-alerts`) NÃO cancela a assinatura — ele apenas seta `blocked_at`. Isso significa que o cliente é bloqueado mas continua recebendo tentativas de cobrança.

### Workspaces com acesso indevido (past_due sem bloqueio)

| Workspace | Provider | Status |
|-----------|----------|--------|
| Vantique | asaas | plan_type=active, subscription_status=past_due, SEM blocked_at |
| Cuidador360 | asaas | plan_type=trialing, subscription_status=past_due, SEM blocked_at |

Esses 2 workspaces estão com pagamento em atraso mas ainda com acesso livre.

### Visão geral dos workspaces

| Tipo | Qtd |
|------|-----|
| Trialing (ativos) | 196 |
| Trial manual | 31 |
| Ativos pagando | 26 |
| Bloqueados (past_due) | 21 |
| Trialing (past_due) | 11 |
| Cancelados | 5 |

### Trials expirando nas próximas 48h: 12 workspaces

---

## 💬 Chat e Webhooks

- **Webhooks Evolution**: Operacionais, recebendo mensagens em tempo real
- **WABA**: Operacional
- **Sem erros 500** nas Edge Functions nas últimas 24h
- **Filtro de status@broadcast**: Aplicado com sucesso (correção anterior)

---

## Plano de Correção

### Step 1: Cancelar assinaturas de workspaces bloqueados/cancelados (URGENTE)

Modificar a Edge Function `cancel-subscription` para, além de marcar o workspace como cancelado, **limpar os campos** `stripe_subscription_id` e `asaas_subscription_id` do banco após cancelar na plataforma. Isso garante idempotência e evita que o campo fique "sujo".

### Step 2: Auto-cancelar assinaturas no bloqueio automático

Modificar a Edge Function `check-no-response-alerts` para que, ao bloquear um workspace por trial expirado, também **cancele a assinatura no Stripe/Asaas** automaticamente. Atualmente ela só seta `blocked_at` sem cancelar a cobrança.

### Step 3: Limpeza imediata via migration

Executar cancelamento das 3 assinaturas Asaas e ~20 Stripe dos workspaces já bloqueados/cancelados, e limpar os campos no banco.

### Step 4: Auto-resume de sessões travadas

Criar uma migration ou ajustar a lógica do cron para despausar automaticamente sessões com `is_paused = true` há mais de 7 dias e sem ticket de suporte humano aberto.

### Step 5: Bloquear os 2 workspaces com past_due sem bloqueio

Setar `blocked_at = now()` para Vantique e Cuidador360.

---

### Checklist diário recomendado (para automatizar futuramente)

1. Agentes ativos silenciosos há 24h+ (sem execução)
2. Sessões pausadas há +48h sem ticket aberto
3. Follow-ups presos em "pending" há +24h
4. Workspaces past_due sem bloqueio
5. Workspaces bloqueados/cancelados com subscription_id ainda preenchido
6. Trials expirando nas próximas 48h
7. Erros 500 em Edge Functions
8. Instâncias Evolution desconectadas
9. Tokens Meta/WABA próximos de expirar
10. Pagamentos confirmados vs esperados

