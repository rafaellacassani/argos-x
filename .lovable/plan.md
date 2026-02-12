

## Problema Identificado

A criacao de membros na equipe falha por **dois problemas criticos** nas politicas de seguranca (RLS):

### 1. Todas as politicas sao RESTRICTIVE (sem PERMISSIVE)
O PostgreSQL exige pelo menos uma politica PERMISSIVE para conceder acesso. As tabelas `user_profiles`, `user_roles` e `notification_settings` possuem apenas politicas RESTRICTIVE, o que bloqueia qualquer operacao.

### 2. Verificacao de admin usa tabela errada
As politicas de `user_profiles` e `user_roles` usam `has_role(auth.uid(), 'admin')`, que consulta a tabela `user_roles`. Porem, o papel de admin esta registrado na tabela `workspace_members` (sistema de workspace). Como a tabela `user_roles` esta vazia, a funcao sempre retorna `false` -- ninguem tem permissao.

## Solucao

### Passo 1 - Migracao SQL
Recriar as politicas RLS como **PERMISSIVE** e substituir `has_role()` por `is_workspace_admin()` nas tabelas afetadas:

**Tabela `user_profiles`:**
- SELECT: qualquer usuario autenticado pode visualizar (necessario para listar equipe)
- INSERT/UPDATE/DELETE: apenas admins do workspace (`is_workspace_admin`)
- UPDATE adicional: usuario pode editar seu proprio perfil

**Tabela `user_roles`:**
- SELECT: qualquer usuario autenticado pode visualizar
- INSERT/UPDATE/DELETE: apenas admins do workspace

**Tabela `notification_settings`:**
- Politica existente ja usa `get_user_workspace_id`, mas e RESTRICTIVE -- recriar como PERMISSIVE

### Passo 2 - Criar funcao auxiliar para verificar admin pelo workspace

Como `is_workspace_admin` exige `workspace_id` como parametro, criaremos uma funcao `is_any_workspace_admin(_user_id uuid)` que verifica se o usuario e admin em qualquer workspace -- necessario para politicas de tabelas que nao possuem coluna `workspace_id` (como `user_profiles` e `user_roles`).

```text
Fluxo corrigido:
Admin clica "Adicionar Membro"
  -> INSERT user_profiles  (politica PERMISSIVE com is_any_workspace_admin)
  -> INSERT user_roles      (politica PERMISSIVE com is_any_workspace_admin)
  -> INSERT notification_settings (politica PERMISSIVE com get_user_workspace_id)
  -> Sucesso!
```

### Passo 3 - Nenhuma alteracao no codigo frontend
O hook `useTeam.ts` e o componente `TeamManager.tsx` ja estao corretos. O problema e exclusivamente nas politicas do banco de dados.

### Resumo das alteracoes

| Arquivo / Recurso | Acao |
|---|---|
| Nova funcao SQL `is_any_workspace_admin` | Criar |
| Politicas RLS de `user_profiles` | Recriar como PERMISSIVE com nova funcao |
| Politicas RLS de `user_roles` | Recriar como PERMISSIVE com nova funcao |
| Politicas RLS de `notification_settings` | Recriar como PERMISSIVE |

