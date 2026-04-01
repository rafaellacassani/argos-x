

## Integração Asaas para Novos Clientes (Checkout via Link de Pagamento)

### Contexto
- Clientes atuais continuam no Stripe, sem alteração
- Novos clientes a partir de amanhã usam Asaas com trial de 7 dias + cartão
- Asaas gera um link de pagamento (checkout hosted) — sem coletar cartão no formulário
- Campo de CPF/CNPJ será adicionado ao formulário de cadastro
- Ambiente: produção (`https://api.asaas.com`)

### Como funciona o trial no Asaas
O Asaas não tem "trial" nativo como o Stripe. A abordagem é:
1. Criar o **customer** no Asaas com CPF/CNPJ
2. Criar uma **assinatura** (`POST /v3/subscriptions`) com `nextDueDate` = hoje + 7 dias e `billingType: CREDIT_CARD`
3. O Asaas gera automaticamente um **link de pagamento** (`invoiceUrl`) para a primeira cobrança — o cliente insere o cartão ali
4. O cartão fica salvo e a cobrança só acontece em 7 dias
5. Webhooks do Asaas notificam sobre `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, etc.

### Alterações necessárias

#### 1. Secret: API Key do Asaas
- Adicionar secret `ASAAS_API_KEY` (chave de produção do painel Asaas)

#### 2. Formulário de cadastro — `src/pages/Cadastro.tsx`
- Adicionar campo **CPF/CNPJ** (obrigatório) com máscara automática (CPF: 000.000.000-00 / CNPJ: 00.000.000/0000-00)
- Enviar `cpfCnpj` junto com os demais dados para a Edge Function

#### 3. Nova Edge Function — `supabase/functions/asaas-checkout/index.ts`
Substitui o `signup-checkout` para novos clientes. Fluxo:

1. Recebe `{ name, phone, email, companyName, password, plan, cpfCnpj, eventId }`
2. Valida campos (mesma validação atual)
3. Cria/encontra usuário no Supabase Auth
4. Upsert `user_profiles`
5. Cria **customer** no Asaas: `POST /v3/customers` com `{ name, cpfCnpj, email, mobilePhone }`
6. Resolve valor do plano:
   - essencial: R$ 47,90
   - negocio: R$ 97,90
   - escala: R$ 197,90
7. Cria **assinatura** no Asaas: `POST /v3/subscriptions` com:
   - `customer`, `billingType: "CREDIT_CARD"`, `value`, `cycle: "MONTHLY"`
   - `nextDueDate`: data de hoje + 7 dias (formato `YYYY-MM-DD`)
   - `description: "Argos X - Plano {nome}"`
   - `externalReference: JSON com { user_id, workspace_id: "pending", plan, company_name }`
8. Salva `client_invite` (mesmo modelo atual)
9. Cria lead interno no CRM
10. Retorna `{ url: assinatura.invoiceUrl }` — o frontend redireciona para lá (checkout do Asaas)

#### 4. Nova Edge Function — `supabase/functions/asaas-webhook/index.ts`
Recebe notificações do Asaas. Eventos principais:

- **`PAYMENT_CONFIRMED`** (cartão validado, primeira cobrança futura confirmada):
  - Busca `externalReference` da cobrança para obter `user_id`, `plan`
  - Cria workspace + funil padrão + membro admin (mesma lógica do `stripe-webhook/createWorkspaceForCustomer`)
  - Salva `asaas_customer_id` e `asaas_subscription_id` no workspace
  - Envia email de boas-vindas + WhatsApp
  - Move lead interno para estágio Trial

- **`PAYMENT_RECEIVED`** (cobrança efetivamente paga):
  - Atualiza workspace: `subscription_status = "active"`, `plan_type = "active"`, `blocked_at = null`
  - Move lead interno para "Cliente ativo"

- **`PAYMENT_OVERDUE`** (cobrança vencida):
  - Atualiza workspace: `subscription_status = "past_due"`

- **`PAYMENT_DELETED`** / **`PAYMENT_REFUNDED`**:
  - Atualiza workspace: `blocked_at = now()`, `plan_type = "canceled"`

- **`PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`**:
  - Marca `subscription_status = "past_due"`

#### 5. Migration — adicionar colunas ao `workspaces`
```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS asaas_subscription_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'stripe';
```

#### 6. Atualizar `src/pages/Cadastro.tsx` — redirecionar para Asaas
- O `handleSubmit` passa a chamar `asaas-checkout` em vez de `signup-checkout`
- Redireciona para a `invoiceUrl` retornada

#### 7. Configurar webhook no painel Asaas
- URL: `https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/asaas-webhook`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`

#### 8. Ajustes menores
- `supabase/config.toml`: adicionar `[functions.asaas-checkout]` e `[functions.asaas-webhook]` com `verify_jwt = false`
- Páginas de planos (`Planos.tsx`, `WorkspaceBlockedScreen.tsx`): ao reativar/trocar plano, verificar `payment_provider` do workspace para chamar Stripe ou Asaas conforme o caso
- `cancel-account`: verificar `payment_provider` e cancelar no Asaas se necessário

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/Cadastro.tsx` | Adicionar campo CPF/CNPJ + chamar `asaas-checkout` |
| `supabase/functions/asaas-checkout/index.ts` | Novo — cria customer + assinatura no Asaas |
| `supabase/functions/asaas-webhook/index.ts` | Novo — processa webhooks do Asaas |
| `supabase/config.toml` | Adicionar config das 2 novas functions |
| Migration SQL | Adicionar `asaas_customer_id`, `asaas_subscription_id`, `payment_provider` ao `workspaces` |

### O que você precisa fazer manualmente
1. Adicionar a API Key do Asaas quando solicitada
2. No painel do Asaas, configurar o webhook apontando para a URL da Edge Function

