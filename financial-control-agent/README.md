# 🤖 Financial Control Agent

Agente de controle financeiro pessoal e empresarial com Claude AI + WhatsApp.

## O que faz

- **Verificação diária automática** de vencimentos (Stripe, Conta Azul, Google Sheets)
- **Alertas via WhatsApp** com resumos e avisos de vencimento
- **Chat interativo**: converse com o agente pelo WhatsApp para consultas e ações
- **Confirmação de ações sensíveis**: cobranças, notas fiscais e links de pagamento só são enviados após sua aprovação
- **Resumo semanal** toda segunda-feira de manhã

## Integrações

| Serviço | O que faz |
|---|---|
| **Stripe** | Faturas, cobranças e links de pagamento de clientes |
| **Google Sheets** | Planilhas financeiras pessoais e de clientes |
| **Evolution API** | Envio e recebimento de mensagens WhatsApp |
| **Conta Azul** | Vendas, clientes e emissão de notas fiscais |

## Instalação

### 1. Clone e instale as dependências

```bash
git clone https://github.com/seu-usuario/financial-control-agent
cd financial-control-agent
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais (veja detalhes abaixo).

### 3. Configure o Google Sheets

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto ou selecione um existente
3. Ative a **Google Sheets API** e a **Google Drive API**
4. Crie uma **Service Account** e baixe a chave JSON
5. Compartilhe suas planilhas com o e-mail da Service Account
6. Preencha `GOOGLE_SERVICE_ACCOUNT_EMAIL` e `GOOGLE_PRIVATE_KEY` no `.env`

**Formato esperado da aba de pagamentos pessoais:**

| Descrição | Valor | Vencimento | Status |
|---|---|---|---|
| Internet | 150,00 | 15/01/2025 | Pendente |
| Aluguel | 2000,00 | 05/01/2025 | Pago |

### 4. Configure o Stripe

1. Acesse o [Dashboard Stripe](https://dashboard.stripe.com/apikeys)
2. Copie a **Secret key** (`sk_live_...`)
3. Preencha `STRIPE_SECRET_KEY` no `.env`

### 5. Configure a Evolution API (WhatsApp)

1. Certifique-se que sua instância Evolution API está rodando
2. Configure o webhook no Evolution API para: `POST https://seu-dominio.com/whatsapp/webhook`
3. Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE` no `.env`

### 6. Configure o Conta Azul

1. Acesse as [configurações de API](https://app.contaazul.com/) do Conta Azul
2. Crie um aplicativo OAuth2 e obtenha `client_id` e `client_secret`
3. Preencha no `.env`

### 7. Inicie o servidor

```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm run build && npm start
```

## Como usar (WhatsApp)

Após configurar, envie mensagens para o número da sua instância Evolution API:

```
"Quais faturas vencem essa semana?"
"Quanto recebi nos últimos 30 dias?"
"Mostra minhas contas pessoais a vencer"
"Lista os clientes no Conta Azul"
"Emite nota fiscal para a venda 12345"   → pede confirmação
"Manda cobrança pro cliente inv_xxx"     → pede confirmação
```

**Confirmações:** quando o agente pede autorização, você recebe:
```
⚡ Confirmação necessária [ABCD1234]

Enviar cobrança por e-mail para João Silva (R$ 500,00)

Responda:
• SIM ABCD1234 — confirmar
• NÃO ABCD1234 — cancelar
```

## Estrutura do projeto

```
src/
├── agent/
│   ├── agent.ts          # Loop principal do agente Claude
│   └── tools/            # Ferramentas disponíveis para o agente
│       ├── stripe-tools.ts
│       ├── sheets-tools.ts
│       ├── whatsapp-tools.ts
│       ├── contaazul-tools.ts
│       └── confirmation-tools.ts
├── integrations/         # Clientes de API
│   ├── stripe.ts
│   ├── google-sheets.ts
│   ├── whatsapp.ts
│   └── conta-azul.ts
├── scheduler/
│   └── jobs.ts           # Cron jobs (verificação diária, resumo semanal)
├── handlers/
│   └── webhook.ts        # Webhook do WhatsApp
├── db/
│   └── storage.ts        # Storage local (confirmações, histórico, logs)
└── index.ts              # Entry point
```

## Variáveis de ambiente

Veja `.env.example` para a lista completa e documentada.

## Agendamentos padrão

| Cron | Horário | O que faz |
|---|---|---|
| `0 8 * * *` | Todo dia às 8h | Verifica vencimentos dos próximos 3 dias |
| `0 9 * * 1` | Toda segunda às 9h | Envia resumo financeiro semanal |

Configure via `CRON_DAILY_CHECK` e `CRON_WEEKLY_SUMMARY` no `.env`.
