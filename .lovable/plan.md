

# Integração de Email Real (Gmail / Outlook)

## Visao Geral

Transformar a tela de Email (atualmente mockup) em um cliente de email funcional onde cada workspace pode conectar sua conta Gmail ou Outlook e ler, responder e enviar emails diretamente pelo Argos X.

---

## Fase 1 — Infraestrutura (Backend)

### 1.1 Tabela `email_accounts`
Armazena as credenciais OAuth de cada conta de email conectada por workspace.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| workspace_id | uuid | FK |
| user_id | uuid | Quem conectou |
| provider | text | "gmail" ou "outlook" |
| email_address | text | Email da conta |
| access_token | text | Token OAuth |
| refresh_token | text | Refresh token |
| token_expiry | timestamptz | Quando expira |
| sync_cursor | text | Cursor/pageToken de sincronizacao |
| last_synced_at | timestamptz | Ultima sincronizacao |
| is_active | boolean | Conta ativa |
| created_at / updated_at | timestamptz | Timestamps |

RLS: Apenas membros do workspace podem ver; apenas admin pode inserir/deletar.

### 1.2 Tabela `emails`
Cache local dos emails sincronizados.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| email_account_id | uuid | FK para email_accounts |
| workspace_id | uuid | FK |
| provider_id | text | ID do email no Gmail/Outlook |
| thread_id | text | ID da thread (agrupamento) |
| from_name / from_email | text | Remetente |
| to_emails | jsonb | Destinatarios |
| cc_emails | jsonb | CC |
| subject | text | Assunto |
| body_text / body_html | text | Corpo |
| snippet | text | Preview |
| folder | text | inbox, sent, drafts, trash, archive |
| is_read | boolean | Lido |
| is_starred | boolean | Com estrela |
| has_attachments | boolean | Tem anexo |
| attachments | jsonb | Metadados dos anexos |
| received_at | timestamptz | Data do email |
| created_at | timestamptz | Quando foi cacheado |

RLS: Membros do workspace podem ler/atualizar.

### 1.3 Secrets necessarios
- `GOOGLE_CLIENT_ID` — ja existe
- `GOOGLE_CLIENT_SECRET` — ja existe
- `MICROSOFT_CLIENT_ID` — novo (para Outlook no futuro)
- `MICROSOFT_CLIENT_SECRET` — novo (para Outlook no futuro)

O Google ja esta configurado, entao comecamos pelo Gmail.

---

## Fase 2 — Edge Functions

### 2.1 `gmail-oauth`
- Gera URL de autorizacao com escopos de Gmail (`gmail.readonly`, `gmail.send`, `gmail.modify`)
- Recebe callback com code, troca por tokens
- Salva na tabela `email_accounts`

### 2.2 `sync-emails`
- Busca emails via Gmail API (usando `messages.list` + `messages.get`)
- Usa `pageToken` / `historyId` para sincronizacao incremental
- Salva/atualiza na tabela `emails`
- Pode ser chamado manualmente ou via cron

### 2.3 `send-email`
- Recebe destinatario, assunto, corpo, attachments
- Envia via Gmail API (`messages.send`)
- Suporta Reply (com `In-Reply-To` e `References` headers)
- Salva copia na tabela `emails` com folder = "sent"

### 2.4 `email-actions`
- Marcar como lido/nao lido
- Arquivar, mover para lixeira
- Marcar com estrela
- Todas as acoes refletidas via Gmail API + tabela local

---

## Fase 3 — Frontend

### 3.1 Tela de Configuracao (conexao)
- Botao "Conectar Gmail" na pagina de Email (quando nenhuma conta conectada)
- Fluxo OAuth: redireciona para Google, retorna com tokens
- Estado visual de conta conectada com email exibido

### 3.2 Hook `useEmails`
- `fetchEmails(folder, page)` — busca do banco local
- `syncEmails()` — dispara sincronizacao via edge function
- `sendEmail(to, subject, body)` — envia via edge function
- `replyEmail(emailId, body)` — responde
- `updateEmail(id, { is_read, is_starred, folder })` — acoes
- Realtime subscription na tabela `emails` para atualizacoes live

### 3.3 Refatoracao da pagina `Email.tsx`
- Substituir dados hardcoded por dados reais do hook
- Manter o layout atual (ja esta bom)
- Adicionar composer (modal para novo email / resposta)
- Adicionar estado vazio quando sem conta conectada
- Busca funcional com filtro por subject/from/snippet

---

## Fase 4 — Preparacao para Salesbot

### 4.1 Acao "Enviar Email" no Salesbot
- Novo tipo de no no builder: `send_email`
- Usa a mesma edge function `send-email`
- Permite template com variaveis (nome do lead, empresa, etc.)
- Requer que o workspace tenha conta de email conectada

---

## Ordem de Implementacao

1. Criar tabelas `email_accounts` e `emails` com RLS
2. Criar edge function `gmail-oauth` (conexao)
3. Criar edge function `sync-emails` (leitura)
4. Criar edge function `send-email` (envio)
5. Criar hook `useEmails` e refatorar `Email.tsx`
6. Adicionar tela de conexao e composer
7. (Futuro) Adicionar no de email ao salesbot
8. (Futuro) Integrar Outlook via Microsoft Graph API

---

## Detalhes Tecnicos

### Escopos OAuth do Gmail necessarios
```text
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.modify
```

### Redirect URL do OAuth
```text
https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/gmail-oauth?action=callback
```
(Precisa ser registrado no Google Cloud Console junto com os escopos de Gmail)

### Sincronizacao incremental
- Primeira sync: busca ultimos 50 emails
- Syncs seguintes: usa `historyId` do Gmail para buscar apenas novos/alterados
- Cursor salvo em `email_accounts.sync_cursor`

### Seguranca
- Tokens armazenados apenas no banco com RLS restritivo
- Edge functions validam JWT antes de qualquer operacao
- Refresh automatico de tokens expirados

