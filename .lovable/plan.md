

# 🔐 Criar Edge Function de OAuth do Facebook/Instagram

## Resumo

Vou criar a edge function `facebook-oauth` que receberá o callback do login empresarial da Meta, trocará o código de autorização por tokens de acesso, e salvará as credenciais no banco de dados.

---

## URL para Configurar no Facebook Developers

**Configuração do Login da Empresa:**
- **URL de redirecionamento OAuth válidos:** `https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/facebook-oauth`

---

## O que será feito

### 1. Criar Edge Function `facebook-oauth`

**Arquivo:** `supabase/functions/facebook-oauth/index.ts`

A função terá os seguintes endpoints:

- **GET `/`** - Recebe o callback do OAuth com o código de autorização
  - Extrai o `code` da query string
  - Troca o código por access_token usando a Graph API
  - Busca as páginas/contas do Instagram do usuário
  - Salva os tokens no banco de dados
  - Redireciona de volta para a aplicação

### 2. Criar Tabelas no Banco de Dados

**Tabela `meta_accounts`** - Armazena contas conectadas:
- `id` (uuid, primary key)
- `user_access_token` (text, encrypted)
- `token_expires_at` (timestamp)
- `created_at`, `updated_at`

**Tabela `meta_pages`** - Páginas do Facebook e contas Instagram:
- `id` (uuid, primary key)
- `meta_account_id` (uuid, foreign key)
- `page_id` (text) - ID da página no Facebook
- `page_name` (text)
- `page_access_token` (text, encrypted)
- `instagram_account_id` (text, nullable)
- `instagram_username` (text, nullable)
- `platform` (enum: 'facebook', 'instagram', 'both')
- `created_at`, `updated_at`

### 3. Fluxo do OAuth

```text
1. Usuário clica "Conectar Facebook/Instagram" na UI
   │
   ▼
2. Redireciona para:
   https://www.facebook.com/v18.0/dialog/oauth
   ?client_id={APP_ID}
   &redirect_uri={OAUTH_URL}
   &scope=pages_manage_messages,instagram_manage_messages,...
   │
   ▼
3. Usuário autoriza no Facebook
   │
   ▼
4. Facebook redireciona para:
   https://...supabase.co/functions/v1/facebook-oauth?code=ABC123
   │
   ▼
5. Edge function troca code por access_token
   │
   ▼
6. Busca páginas e contas Instagram do usuário
   │
   ▼
7. Salva tokens no banco de dados
   │
   ▼
8. Redireciona usuário de volta para a aplicação
```

---

## Detalhes Técnicos

### Requisitos de Secrets

Antes de implementar, preciso que você adicione:
- `FACEBOOK_APP_ID` - ID do seu App no Facebook Developers
- `FACEBOOK_APP_SECRET` - Secret do seu App

### Endpoints da Graph API utilizados

1. **Trocar code por token:**
   ```
   GET https://graph.facebook.com/v18.0/oauth/access_token
   ?client_id={app_id}
   &redirect_uri={redirect_uri}
   &client_secret={app_secret}
   &code={code}
   ```

2. **Obter páginas do usuário:**
   ```
   GET https://graph.facebook.com/v18.0/me/accounts
   ?access_token={user_access_token}
   ```

3. **Obter conta Instagram vinculada:**
   ```
   GET https://graph.facebook.com/v18.0/{page_id}
   ?fields=instagram_business_account
   &access_token={page_access_token}
   ```

### Atualização do config.toml

```toml
[functions.facebook-oauth]
verify_jwt = false
```

---

## Resultado Esperado

Após a implementação:

1. A URL de callback estará funcionando
2. Usuários poderão conectar suas páginas do Facebook
3. Contas do Instagram Business serão detectadas automaticamente
4. Tokens serão salvos de forma segura no banco
5. O sistema estará pronto para receber mensagens via webhook

---

## Ordem de Execução

1. **Primeiro:** Você adiciona os secrets `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`
2. **Depois:** Eu crio as tabelas no banco de dados
3. **Por fim:** Eu crio a edge function `facebook-oauth`

---

## Preciso dos Secrets

Para prosseguir, preciso que você me informe:
- O **App ID** do seu Facebook App
- O **App Secret** do seu Facebook App

Esses valores você encontra em: Facebook Developers → Seu App → Configurações → Básico

