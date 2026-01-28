
# Plano: Corrigir Erro "Invalid Scopes: instagram_basic"

## Problema Identificado

O erro "Invalid Scopes: instagram_basic" ocorre porque o scope `instagram_basic` **é uma permissão obsoleta** do antigo fluxo de autenticação do Instagram.

A Meta fez mudanças significativas nas APIs do Instagram em julho de 2024, e existem agora **dois caminhos distintos** para trabalhar com Instagram:

1. **Instagram API with Facebook Login** (Tradicional) - Requer conta Facebook Page linkada
2. **Instagram API with Instagram Login** (Novo - desde julho 2024) - Não requer Facebook Page

### Descoberta da Análise

Analisando a documentação oficial da Meta e o código da edge function `facebook-oauth/index.ts`, identifiquei que:

- A linha 188 solicita o scope `instagram_basic` que **NÃO existe mais** no fluxo tradicional com Facebook Login
- Para integração com **Facebook Login** (que é o que você está usando), as permissões corretas são diferentes
- A documentação atual da Meta não usa mais `instagram_basic` no contexto de Facebook Login para mensagens

---

## Permissões Corretas por Caso de Uso

### Para Messenger Platform + Instagram Messaging (via Facebook Login)

Segundo a [documentação oficial do Messenger Platform para Instagram](https://developers.facebook.com/docs/messenger-platform/instagram/), as permissões necessárias são:

```
- instagram_basic  ❌ NÃO EXISTE MAIS
- instagram_manage_messages  ✅ CORRETO
- pages_manage_metadata  ✅ CORRETO
- pages_show_list  ✅ CORRETO (ou pages_showlist)
- business_management  ✅ CORRETO
```

### Para Instagram Graph API (via Facebook Login)

Segundo a [documentação Getting Started](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started/), as permissões básicas são:

```
- instagram_basic  ✅ EXISTE nesse contexto
- pages_show_list  ✅ CORRETO
```

**PORÉM**: O `instagram_basic` **só funciona no contexto de Graph API tradicional**, não para mensagens.

---

## Solução Proposta

### Opção 1: Usar Messenger Platform (Recomendado para seu caso)

**Por quê?** Você quer gerenciar mensagens do Instagram DM e comentários, que são funcionalidades do **Messenger Platform**, não do Instagram Graph API básico.

**Permissões a solicitar:**
```typescript
const scopes = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_manage_messages",      // ✅ Mensagens Instagram
  "instagram_manage_comments",      // ✅ Comentários Instagram
  "business_management",
];
```

**O que remover:**
```typescript
"instagram_basic",  // ❌ REMOVER - não existe para Messenger Platform
```

### Opção 2: Configurar App do Facebook corretamente

No Facebook Developers Dashboard, você precisa:

1. **Adicionar o produto "Messenger"**
   - Dashboard > Seu App > Add Product > Messenger

2. **Adicionar o produto "Instagram"**
   - Dashboard > Seu App > Add Product > Instagram

3. **Configurar permissões no App Review**
   - Ir em App Review > Permissions and Features
   - Solicitar aprovação para:
     - `instagram_manage_messages`
     - `instagram_manage_comments`
     - `pages_messaging`
     - `pages_manage_metadata`

4. **Modo de Desenvolvimento**
   - Durante desenvolvimento, essas permissões funcionam para contas de teste/admin
   - Para produção, você precisará passar pelo App Review da Meta

---

## Mudanças no Código

### Arquivo: `supabase/functions/facebook-oauth/index.ts`

**Linha 183-192 (POST /url endpoint):**

```typescript
// ❌ ANTES (com erro)
const scopes = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_basic",  // ← PROBLEMA AQUI
  "instagram_manage_messages",
  "instagram_manage_comments",
  "business_management",
];

// ✅ DEPOIS (corrigido)
const scopes = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "business_management",
];
```

**Não há outras mudanças necessárias no código.** O restante da lógica da edge function está correto.

---

## Passo a Passo para Implementação

### 1. Atualizar a Edge Function
- Editar `supabase/functions/facebook-oauth/index.ts`
- Remover `"instagram_basic"` do array de scopes (linha 188)
- Salvar e fazer deploy

### 2. Configurar o App do Facebook
Ir no [Facebook Developers Dashboard](https://developers.facebook.com):

**a) Adicionar Produtos:**
- Messenger Platform
- Instagram (se ainda não tiver)

**b) Configurar Permissões:**
- App Review > Permissions and Features
- Marcar as permissões necessárias:
  - `instagram_manage_messages`
  - `instagram_manage_comments`  
  - `pages_messaging`
  - `pages_manage_metadata`

**c) Adicionar Contas de Teste (Desenvolvimento):**
- Roles > Test Users ou Roles > Administrators
- Adicionar sua conta Instagram profissional como teste

### 3. Testar Novamente
- Voltar para `/settings` na aplicação
- Clicar em "Conectar" no card do Instagram/Facebook
- O fluxo OAuth agora deve funcionar sem o erro "Invalid Scopes"

---

## Fluxo Corrigido

```text
Usuário clica "Conectar"
        │
        ▼
Edge Function gera URL OAuth
(SEM instagram_basic)
        │
        ▼
Usuário autoriza no Facebook
(Com permissões corretas)
        │
        ▼
Callback recebe authorization code
        │
        ▼
Troca code por access token
        │
        ▼
Busca páginas do usuário
        │
        ▼
Para cada página:
 - Verifica instagram_business_account
 - Busca username do Instagram
 - Salva em meta_pages
        │
        ▼
Redireciona para /settings?meta_connected=true
        │
        ▼
Toast de sucesso + Lista de contas
```

---

## Observações Importantes

### ⚠️ Limitações do Modo Desenvolvimento

Durante desenvolvimento, apenas **administradores, desenvolvedores e testadores** do App podem autorizar as permissões. Para usuários reais, você precisará:

1. Passar pelo **App Review** da Meta
2. Fornecer evidências de como usará cada permissão
3. Gravar vídeos demonstrando o uso case

### ⚠️ Diferença: Messenger vs Graph API

- **Messenger Platform** → Mensagens, comentários em tempo real (webhooks)
- **Instagram Graph API** → Dados de mídia, insights, publicação

Para seu caso de uso (CRM de mensagens), você precisa do **Messenger Platform**, que usa `instagram_manage_messages`, NÃO `instagram_basic`.

### ⚠️ Instagram Business Account Obrigatório

O Instagram messaging só funciona com:
- Instagram Business Account ou Creator Account
- Conta linkada a uma Facebook Page

---

## Arquivos que Serão Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/facebook-oauth/index.ts` | Remover `"instagram_basic"` do array de scopes na linha 188 |

---

## Resultado Esperado

Após essas mudanças:

1. ✅ Não haverá mais erro "Invalid Scopes: instagram_basic"
2. ✅ O fluxo OAuth completará com sucesso
3. ✅ Páginas do Facebook e contas do Instagram serão salvas no banco
4. ✅ Tokens de acesso serão armazenados corretamente
5. ✅ Você poderá receber mensagens via webhook (próxima etapa)

---

## Próximos Passos Após Correção

1. **Configurar Webhook** - Já existe a edge function `facebook-webhook`
2. **Subscrever aos Eventos** - No Facebook Dashboard:
   - Webhook > Instagram > messages, messaging_postbacks, messaging_handovers
   - Webhook > Page > messages, messaging_postbacks
3. **Testar Recebimento de Mensagens** - Enviar DM para a conta conectada
4. **Processar Mensagens** - Salvar no banco e exibir na UI de Chats
