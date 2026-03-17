

## Sistema de Chaves de API para Argos X

### Visao Geral

Criar um sistema completo de API Keys que permite a clientes gerar chaves para integrar plataformas externas com o Argos X. Cada chave terá permissoes granulares por recurso (negado/leitura/gravacao).

### 1. Banco de dados

**Tabela `api_keys`:**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| workspace_id | uuid NOT NULL | Isolamento multi-tenant |
| name | text NOT NULL | Nome descritivo (ex: "Zapier Integration") |
| key_hash | text NOT NULL | SHA-256 da chave (nunca armazenar em texto) |
| key_prefix | text NOT NULL | Primeiros 8 chars para identificacao visual (ex: "argx_a1b2...") |
| permissions | jsonb NOT NULL | Mapa de recurso -> nivel de acesso |
| is_active | boolean DEFAULT true | Ativar/desativar sem deletar |
| last_used_at | timestamptz | Ultimo uso |
| expires_at | timestamptz | Expiracao opcional |
| created_by | uuid | Quem criou |
| created_at | timestamptz DEFAULT now() | |

**Formato do `permissions` (jsonb):**
```json
{
  "leads": "write",
  "contacts": "read",
  "messages": "denied",
  "agents": "read",
  "campaigns": "denied",
  "calendar": "write",
  "tags": "read",
  "funnels": "read",
  "webhooks": "write"
}
```

**Tabela `api_key_usage_log`** (auditoria):

| Coluna | Tipo |
|--------|------|
| id | uuid PK |
| api_key_id | uuid |
| workspace_id | uuid |
| endpoint | text |
| method | text |
| status_code | int |
| created_at | timestamptz |

RLS: ambas filtradas por `workspace_id` com acesso apenas para admins.

### 2. Edge Function: `api-keys`

Gerencia CRUD das chaves (criar, listar, revogar, atualizar permissoes). Ao criar:
- Gera chave aleatoria com prefixo `argx_`
- Armazena apenas o hash SHA-256
- Retorna a chave em texto **uma unica vez** na resposta de criacao

### 3. Edge Function: `api-gateway`

Ponto de entrada para chamadas externas autenticadas via API Key:
- Recebe header `X-API-Key: argx_...`
- Valida hash contra `api_keys`, verifica `is_active` e `expires_at`
- Checa permissao do recurso solicitado vs nivel exigido
- Executa a operacao ou retorna 403
- Registra uso em `api_key_usage_log`

### 4. Frontend: Nova aba "API" em Configuracoes

Adicionar quinta aba na pagina `/configuracoes` com:

- **Lista de chaves** — Tabela com nome, prefixo (`argx_a1b2...****`), status, ultimo uso, data de criacao
- **Criar chave** — Dialog com:
  - Nome da chave
  - Expiracao opcional
  - Grid de permissoes: cada recurso (Leads, Contatos, Mensagens, Agentes, Campanhas, Calendario, Tags, Funis, Webhooks) com select de 3 opcoes: Negado / Leitura / Gravacao
- **Modal de chave gerada** — Exibe a chave completa uma unica vez com botao de copiar e aviso de que nao sera exibida novamente
- **Acoes por chave** — Ativar/desativar, editar permissoes, revogar (deletar)
- **Documentacao inline** — Card com endpoints disponiveis e exemplos de uso

### 5. Restricao de acesso

Apenas admins do workspace podem gerenciar API Keys (`canManageWorkspaceSettings`).

### Arquivos a criar/modificar

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas `api_keys` + `api_key_usage_log` |
| `supabase/functions/api-keys/index.ts` | CRUD de chaves |
| `supabase/functions/api-gateway/index.ts` | Gateway de validacao |
| `src/components/settings/ApiKeysManager.tsx` | UI principal (lista + acoes) |
| `src/components/settings/CreateApiKeyDialog.tsx` | Dialog de criacao com grid de permissoes |
| `src/components/settings/ApiKeyRevealDialog.tsx` | Modal one-time reveal da chave |
| `src/hooks/useApiKeys.ts` | Hook para CRUD das chaves |
| `src/pages/Configuracoes.tsx` | Adicionar aba "API" |

### Recursos expostos via API (v1)

| Recurso | Leitura | Gravacao |
|---------|---------|---------|
| Leads | Listar/detalhar leads | Criar/atualizar leads |
| Contatos | Listar contatos | - |
| Mensagens | Listar mensagens WA | Enviar mensagem |
| Agentes IA | Listar agentes | Executar agente |
| Campanhas | Listar campanhas | - |
| Calendario | Listar eventos | Criar eventos |
| Tags | Listar tags | Criar/atribuir tags |
| Funis | Listar funis/etapas | Mover lead de etapa |
| Webhooks | Listar webhooks | Registrar webhook |

