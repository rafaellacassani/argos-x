

## Corrigir Policies RESTRICTIVE em `workspaces` e `workspace_members`

### Problema

O erro real e: **"new row violates row-level security policy for table workspaces"**.

Todas as policies do projeto estao como **RESTRICTIVE** (nao PERMISSIVE). No PostgreSQL, policies RESTRICTIVE so funcionam para restringir acesso ja concedido por policies PERMISSIVE. Se nao existe nenhuma policy PERMISSIVE, o acesso e **sempre negado** — mesmo que a policy RESTRICTIVE retorne true.

### Solucao

Recriar as policies das tabelas `workspaces` e `workspace_members` como **PERMISSIVE** (que e o padrao do PostgreSQL).

### Migracao SQL

```sql
-- ===== WORKSPACES =====
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can view their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace admins can update" ON workspaces;

-- Recriar como PERMISSIVE (padrao)
CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own workspaces"
  ON workspaces FOR SELECT
  USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Workspace admins can update"
  ON workspaces FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), id));

-- ===== WORKSPACE_MEMBERS =====
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Admins can delete members" ON workspace_members;

CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Users can insert themselves"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update members"
  ON workspace_members FOR UPDATE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins can delete members"
  ON workspace_members FOR DELETE
  USING (public.is_workspace_admin(auth.uid(), workspace_id));
```

### Por que isso resolve

- Policies criadas com `CREATE POLICY` sem especificar `AS RESTRICTIVE` sao **PERMISSIVE** por padrao
- As policies atuais foram todas criadas como RESTRICTIVE, o que bloqueia qualquer operacao quando nao ha policy PERMISSIVE existente
- A migracao simplesmente recria as mesmas regras, mas como PERMISSIVE

### Nenhuma mudanca no frontend

O codigo do frontend esta correto. O problema e 100% nas policies do banco de dados.

### Detalhes Tecnicos

- No PostgreSQL, o acesso e concedido se **pelo menos uma policy PERMISSIVE** retorna true
- Policies RESTRICTIVE so servem para **reduzir** o acesso ja concedido por policies permissivas
- Se so existem policies RESTRICTIVE e zero PERMISSIVE, o resultado e sempre **negado**
- As funcoes `get_user_workspace_ids` e `is_workspace_admin` ja sao SECURITY DEFINER e evitam recursao

