
# Pesquisa de Churn via WhatsApp — Cadência Dia 8

## Ideia refinada

Quando o trial expira e o cliente não assina, no **dia 8 pós-expiração** o sistema envia uma mensagem interativa via WhatsApp perguntando o motivo. O fluxo:

1. **Dia 8**: Envio automático de mensagem com lista numerada de motivos
2. **Resposta do cliente**: O webhook identifica que é uma resposta à pesquisa e salva o motivo
3. **Agradecimento**: Resposta automática de agradecimento + oferta de ajuda

### Opções sugeridas (melhoradas)

```text
Olá, {nome}! 👋

Vimos que seu período de teste no Argos X acabou e você ainda não ativou um plano.

Queremos melhorar! Pode nos dizer o que aconteceu? Responda com o número:

1️⃣ Não cheguei a usar
2️⃣ Não consegui conectar o WhatsApp
3️⃣ Achei difícil de configurar
4️⃣ Não recebi suporte/demonstração
5️⃣ O preço não cabe no momento
6️⃣ Já uso outra ferramenta

Sua resposta nos ajuda muito! 🙏
```

## Implementação técnica

### 1. Tabela `churn_survey_responses` (nova)
- `id`, `workspace_id`, `user_id`, `response_number` (1-6), `response_text`, `raw_message`, `created_at`
- Permite analytics de motivos de churn

### 2. Cadence — Dia 8 como mensagem normal
- Você adiciona a mensagem acima como uma `cadence_message` no dia 8 via Admin Clientes > Cadência (já funciona hoje)
- Nenhuma mudança na `process-reactivation` — ela já envia qualquer mensagem configurada por dia

### 3. Webhook — Interceptar resposta (principal mudança)
- Na `whatsapp-webhook`, quando chega uma mensagem de um número que:
  - (a) pertence a um workspace com trial expirado/bloqueado
  - (b) recebeu a pesquisa no dia 8 (check `reactivation_log` com `cadence_day = 8`)
  - (c) a mensagem é "1", "2", "3", "4", "5" ou "6"
- Salvar na `churn_survey_responses`
- Responder automaticamente: "Obrigado pelo feedback, {nome}! Anotamos sua resposta. Se mudar de ideia, estamos aqui: argosx.com.br/planos 💙"

### 4. Dashboard — Card de Churn Reasons no Executive Dashboard
- Gráfico de barras/pizza mostrando distribuição dos motivos
- Total de respostas vs pesquisas enviadas (taxa de resposta)

### 5. Admin Clientes > Cadência
- Você configura a mensagem do dia 8 pela UI existente (sem mudança de código)
- A cadência precisa ter o dia 8 adicionado em `cadence_days`

## Resumo de mudanças

| Componente | Mudança |
|---|---|
| **Migration** | Criar tabela `churn_survey_responses` |
| **`whatsapp-webhook`** | Interceptar respostas 1-6 de trials expirados que receberam pesquisa, salvar + auto-reply |
| **`ExecutiveDashboardTab`** | Card com distribuição de motivos de churn |
| **Cadência (config)** | Adicionar dia 8 e mensagem via UI existente |

Nenhuma mudança na `process-reactivation` — o envio já funciona. A inteligência nova fica toda no webhook (interceptar resposta) e no dashboard (visualizar).
