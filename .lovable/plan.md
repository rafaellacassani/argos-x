

## Diagnóstico Completo: Ciclo de Vida de Cobrança

### Como funciona HOJE

```text
┌─────────────────────────────────────────────────────────────┐
│  CADASTRO (/cadastro)                                       │
│  → public-signup cria user + workspace (trial 7 dias)       │
│  → NÃO cria produto/customer no Stripe                     │
│  → Redireciona para /cadastro/sucesso (definir senha)       │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ╔════════▼═══════╗
                    ║  TRIAL 7 DIAS  ║
                    ╚════════╤═══════╝
                             │
     ┌───────────────────────┼───────────────────────┐
     │ Últimos 3 dias        │ Dia 8+                │
     │ TrialBanner amarelo   │ WorkspaceBlockedScreen │
     │ "Ative seu plano"     │ (modal impeditivo)     │
     │ → /planos             │ mostra 3 planos        │
     └───────────────────────┘ → create-checkout-session
                                 → Stripe Checkout
                                 → stripe-webhook atualiza
                                   workspace (active)
```

### O que FALTA / está quebrado

| Item | Status | Problema |
|------|--------|----------|
| **Produto no Stripe automaticamente** | ❌ | Não cria. Depende de Price IDs pré-cadastrados manualmente no Stripe |
| **Pagar por dentro do workspace** | ✅ Parcial | WorkspaceBlockedScreen e /planos funcionam, mas... |
| **Redirect pós-pagamento** | ⚠️ | Redireciona para /dashboard?checkout=success mas não mostra toast/feedback |
| **Régua de e-mail de cobrança** | ❌ | Não existe nenhum e-mail automático antes do trial expirar |
| **Régua de WhatsApp pré-expiração** | ❌ | Não existe. O `process-reactivation` só roda PÓS expiração (dia 6+) |
| **Cron do process-reactivation** | ❌ | Não há pg_cron configurado para essa função — ela nunca roda automaticamente |
| **E-mail de boas-vindas no signup público** | ❌ | public-signup NÃO envia e-mail de boas-vindas (apenas CadastroSucesso pede reset de senha) |
| **WhatsApp de boas-vindas no signup** | ❌ | Não envia nada pelo WhatsApp ao novo cadastro |

---

### Plano de Implementação

#### 1. Régua de E-mail Automática (pré e pós expiração)
Nova Edge Function `send-trial-reminders` que roda via pg_cron diariamente:

- **Dia 5** (2 dias antes): E-mail "Seu trial acaba em 2 dias"
- **Dia 6** (1 dia antes): E-mail "Último dia! Ative seu plano"
- **Dia 7** (expirou): E-mail "Seu acesso foi bloqueado — ative agora"
- **Dia 10**: E-mail "Seus leads ainda estão aqui — não perca"
- **Dia 14**: E-mail final "Última chance"

Cada envio registrado em `reactivation_log` para não duplicar.

#### 2. Régua de WhatsApp Automática
Integrar na mesma `send-trial-reminders` (ou reaproveitar `process-reactivation`):

- Enviar WhatsApp nos mesmos dias da régua
- Usar o WhatsApp do cadastro (campo `phone` do `user_profiles`)
- Via Evolution API (instância configurada no `reactivation_cadence_config`)
- **Com Cloud API**: usar template WABA aprovado para mensagens fora da janela 24h

#### 3. Configurar pg_cron para `process-reactivation`
Criar migration SQL com `cron.schedule` para rodar `process-reactivation` diariamente às 10h (ou unificar com a nova `send-trial-reminders`).

#### 4. E-mail + WhatsApp de boas-vindas no cadastro
Alterar `public-signup` para:
- Enviar e-mail de boas-vindas com link de definir senha (usando Resend)
- Enviar WhatsApp de boas-vindas ("Bem-vindo ao Argos X! Defina sua senha...")

#### 5. Feedback pós-checkout no Dashboard
No `Dashboard.tsx`, detectar `?checkout=success` na URL e mostrar toast de confirmação + limpar o parâmetro.

#### 6. Expandir cadence_config para cobrir pré-expiração
Atualizar `reactivation_cadence_config` para incluir dias negativos (pré-expiração) na cadência: ex `[-2, -1, 0, 3, 7]` (onde 0 = dia da expiração, negativos = antes).

---

### Arquivos alterados/criados

- **Migration SQL**: pg_cron schedule + ajuste em `reactivation_cadence_config`
- **`supabase/functions/process-reactivation/index.ts`**: expandir para cobrir pré-expiração + templates bonitos de e-mail
- **`supabase/functions/public-signup/index.ts`**: adicionar envio de e-mail e WhatsApp de boas-vindas
- **`src/pages/Dashboard.tsx`**: toast de checkout success
- **`src/components/layout/TrialBanner.tsx`**: mostrar a partir de 5 dias (não apenas 3)
- **`supabase/config.toml`**: registrar nova function se necessário

