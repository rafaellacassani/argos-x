

# Plano: Limpeza de Assinaturas Fantasmas no Stripe

## Diagnóstico Confirmado

**22 workspaces bloqueados/cancelados** ainda possuem `stripe_customer_id` no banco. O `stripe_subscription_id` já foi limpo (NULL), mas as assinaturas **continuam ativas no Stripe** porque ninguém cancelou no lado do provedor — apenas removeu a referência do banco.

**7 workspaces Asaas ativos** com assinaturas válidas — esses estão corretos (clientes pagantes). Os cancelados do Asaas já tiveram o `asaas_subscription_id` limpo.

## O que será feito

### 1. Edge Function de limpeza em massa (novo)

Criar `cleanup-orphan-subscriptions` — uma Edge Function administrativa que:
- Busca todos os workspaces com `plan_type IN ('blocked', 'canceled')` que ainda têm `stripe_customer_id`
- Para cada um, usa a API do Stripe para listar **todas** as subscriptions do customer (`active`, `past_due`, `trialing`)
- Cancela cada subscription encontrada
- Limpa o `stripe_customer_id` do workspace após cancelar
- Retorna um relatório detalhado de quantas foram canceladas

Protegida por verificação de role `admin`.

### 2. Execução imediata

Após deploy, chamar a função para cancelar as ~20 assinaturas fantasmas de uma vez.

### Resultado esperado

- Zero cobranças do Stripe para clientes bloqueados/cancelados
- Relatório completo com nome, email e subscriptions canceladas
- `stripe_customer_id` limpo para evitar reincidência

### Nota sobre Asaas

Os workspaces cancelados no Asaas já tiveram `asaas_subscription_id` limpo na correção anterior. Se houver cobranças ativas no Asaas para esses clientes, será necessário cancelar manualmente no painel do Asaas (a API do Asaas não permite listar subscriptions por customer como o Stripe).

