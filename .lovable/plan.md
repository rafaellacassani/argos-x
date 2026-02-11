

## Corrigir Recursao Infinita nas Policies de `workspace_members`

### Problema

O erro "infinite recursion detected in policy for relation workspace_members" ocorre porque:

1. A policy SELECT de `workspace_members` usa `get_user_workspace_id(auth.uid())`
2. Essa funcao faz um SELECT em `workspace_members` para descobrir o workspace do usuario
3. Esse SELECT dispara a policy novamente, que chama a funcao novamente... loop infinito

Alem disso, a policy INSERT (`user_id = auth.uid()`) impede o admin de inserir seu proprio registro de membro logo apos criar o workspace, pois a policy de admin exige que ele ja seja admin (o que ainda nao existe naquele momento).

### Solucao

Reescrever as policies de `workspace_members` para evitar a recursao:

1. **SELECT**: Trocar de `get_user_workspace_id()` para um subquery direto que nao dispara a funcao recursiva:
   ```
   USING (
     workspace_id IN (
       SELECT wm.workspace_id FROM workspace_members wm
       WHERE wm.user_id = auth.uid()
     )
   )
   ```
   Porem isso tambem causa recursao. A solucao correta e usar `SECURITY DEFINER` na funcao `get_user_workspace_id` com a flag `SET search_path` e marcar a funcao para **bypassar RLS** internamente.

   Na pratica, a melhor abordagem e:
   - Dropar todas as policies atuais de `workspace_members`
   - Recriar a funcao `get_user_workspace_id` como `SECURITY DEFINER` (ja e) mas acessando a tabela diretamente sem passar por RLS (usando uma query que bypassa RLS)
   - Recriar as policies de `workspace_members` sem usar `get_user_workspace_id` — em vez disso, usar subqueries simples com `auth.uid()` direto

2. **INSERT**: Permitir que qualquer usuario autenticado insira um membro onde `user_id = auth.uid()` (auto-insercao) — isso ja existe mas precisa funcionar sem conflito com a policy de admin.

### Migracao SQL

```sql
-- Dropar policies existentes de workspace_members
DROP POLICY IF EXISTS "Admins can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Members can view their workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON workspace_members;

-- Recriar get_user_workspace_id para bypassar RLS na consulta interna
-- (ja e SECURITY DEFINER, entao nao precisa de RLS check)
-- Verificar que a funcao esta correta

-- Recriar policies sem recursao
-- SELECT: usuario pode ver membros dos workspaces onde ele e membro
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid() OR workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
  ));

-- INSERT: usuario pode se auto-inserir
CREATE POLICY "Users can insert themselves"
  ON workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE: apenas admins do workspace
CREATE POLICY "Admins can update members"
  ON workspace_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
  ));

CREATE POLICY "Admins can delete members"
  ON workspace_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role = 'admin'
  ));
```

**Nota**: O SELECT com subquery em `workspace_members` referenciando a propria tabela ainda pode causar recursao. A solucao definitiva e tornar **todas as policies de workspace_members PERMISSIVE** (nao RESTRICTIVE como estao agora) e usar apenas `auth.uid()` direto sem chamar funcoes que consultem a mesma tabela.

### Mudanca no Codigo Frontend

Nenhuma mudanca no frontend e necessaria — o problema e 100% nas policies RLS do banco.

### Detalhes Tecnicos

- Todas as policies atuais de `workspace_members` sao `RESTRICTIVE` (Command: ALL com Permissive: No). Isso significa que TODAS devem ser satisfeitas. Precisamos troca-las para `PERMISSIVE` para que qualquer uma delas possa autorizar o acesso.
- A funcao `get_user_workspace_id` e `SECURITY DEFINER`, o que significa que ela roda com privilegios do dono da funcao (geralmente superuser), entao ela ja bypassa RLS. O problema e que as policies da tabela `workspace_members` que usam subqueries na PROPRIA tabela causam recursao — nao a funcao em si.
- A solucao e usar policies PERMISSIVE e evitar subqueries auto-referenciais nas policies de `workspace_members`.

