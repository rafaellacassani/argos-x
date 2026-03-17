

## Diagnóstico

O gateway (`api-gateway`) usa o array `scopes` da tabela `api_keys` para autorizar cada endpoint. Porém:

1. **A UI de criação** (`CreateApiKeyDialog`) só configura `permissions` (objeto `{leads: "read", ...}`) e **nunca converte** isso em `scopes` — logo toda key criada pela UI nasce com `scopes = []`.
2. **A UI de edição** permite alterar `permissions` mas também não toca em `scopes`.
3. **A key `275869e1...`** está com `scopes: []`, por isso `/v1/leads` e `/v1/agents` retornam 403.

## Plano

### 1. Atualizar scopes da key existente (dados)

Usar o insert tool para executar um UPDATE na key `275869e1-d314-435e-bc2d-9a5a68be2eb8` setando:
```sql
UPDATE api_keys SET scopes = '["leads:read","agents:read","messages:read","agents:execute"]' WHERE id = '275869e1-...';
```

### 2. Sincronizar permissions → scopes automaticamente (`api-keys` edge function)

Na edge function `api-keys/index.ts`, nas ações **CREATE** e **UPDATE**:
- Adicionar uma função `permissionsToScopes(permissions)` que converte o objeto `{leads: "read", agents: "write", ...}` em array de scopes (`["leads:read", "agents:read", "agents:write", ...]`).
- Se o caller não enviar `scopes` explicitamente, derivar do `permissions`.
- Se enviar ambos, `scopes` explícito tem prioridade.

### 3. Adicionar edição de scopes na UI

No diálogo de edição de permissões (`ApiKeysManager.tsx`, linhas 657-685):
- Ao salvar permissões, computar os scopes derivados e enviá-los junto no `updateKey()`.
- No `handleCreate`, fazer o mesmo: derivar scopes do `permissions` e passar para `createKey()`.

### 4. Exibir scopes na tabela de keys

Na coluna "Permissões", além dos badges `R`/`W`, mostrar os scopes reais como badges menores ou tooltip para transparência.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Tabela `api_keys` (data) | UPDATE scopes da key existente |
| `supabase/functions/api-keys/index.ts` | Função `permissionsToScopes`, auto-sync em create/update |
| `src/hooks/useApiKeys.ts` | Passar scopes derivados em `createKey` e `updateKey` |
| `src/components/settings/ApiKeysManager.tsx` | Derivar scopes ao salvar edit, exibir scopes |
| `src/components/settings/CreateApiKeyDialog.tsx` | Derivar scopes do permissions no submit |

