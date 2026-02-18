

# Isolamento de Chats por Vendedor

## Problema Identificado

A tabela `whatsapp_instances` nao possui coluna `created_by` (usuario que conectou a instancia). A politica RLS filtra apenas por `workspace_id`, permitindo que todos os membros do workspace vejam todas as instancias e todos os chats.

## Solucao

### 1. Adicionar coluna `created_by` na tabela `whatsapp_instances`

Migracacao SQL:
- Adicionar coluna `created_by UUID REFERENCES auth.users(id)` na tabela `whatsapp_instances`
- Popular registros existentes (sera necessario definir quem criou cada instancia existente, ou deixar null e corrigir manualmente)

### 2. Atualizar RLS para filtrar por usuario

Nova politica de SELECT:
- **Admins/Managers**: veem todas as instancias do workspace (para supervisao)
- **Sellers**: veem apenas as instancias que eles criaram (`created_by = auth.uid()`)

Politicas de INSERT/UPDATE/DELETE permanecem por workspace.

### 3. Salvar `created_by` ao criar instancia

Modificar o fluxo de criacao de instancia (`ConnectionModal.tsx` ou `useEvolutionAPI.ts`) para incluir `created_by: user.id` no INSERT na tabela `whatsapp_instances`.

### 4. Filtrar no frontend (defesa em profundidade)

No `useEvolutionAPI.ts`, a query `listInstances()` ja sera filtrada automaticamente pela RLS. Nenhuma mudanca de codigo necessaria no frontend, pois a RLS faz o trabalho.

### 5. Chats Meta (Facebook/Instagram)

Os chats Meta sao compartilhados (paginas da empresa), entao esses continuam visiveis para todos no workspace. Apenas WhatsApp individual precisa de isolamento.

---

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Adicionar coluna created_by
ALTER TABLE public.whatsapp_instances 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Atualizar RLS: sellers so veem suas instancias, admins/managers veem todas
DROP POLICY IF EXISTS "Workspace members can manage whatsapp_instances" ON public.whatsapp_instances;

-- SELECT: admins veem tudo, sellers so as suas
CREATE POLICY "Users can view own or admin view instances"
ON public.whatsapp_instances FOR SELECT
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR is_workspace_admin(auth.uid(), workspace_id)
    OR has_role(auth.uid(), 'manager')
  )
);

-- INSERT: qualquer membro do workspace pode criar
CREATE POLICY "Workspace members can insert instances"
ON public.whatsapp_instances FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id = get_user_workspace_id(auth.uid())
);

-- UPDATE/DELETE: dono ou admin
CREATE POLICY "Owner or admin can update instances"
ON public.whatsapp_instances FOR UPDATE
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
);

CREATE POLICY "Owner or admin can delete instances"
ON public.whatsapp_instances FOR DELETE
TO authenticated
USING (
  workspace_id = get_user_workspace_id(auth.uid())
  AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
);
```

### Codigo: salvar `created_by` na criacao

No `ConnectionModal.tsx` ou `useEvolutionAPI.ts`, ao inserir na tabela `whatsapp_instances`, incluir:

```typescript
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('whatsapp_instances').insert({
  instance_name: instanceName,
  display_name: displayName,
  workspace_id: workspaceId,
  created_by: user?.id,  // NOVO
});
```

### Instancias existentes

Sera necessario atualizar manualmente os registros existentes de Geise e Natalia com seus respectivos `user_id` via SQL, ou criar um botao admin para atribuir ownership.

---

## Arquivos Modificados

1. **Migracao SQL** -- nova coluna + novas politicas RLS
2. **`src/components/whatsapp/ConnectionModal.tsx`** ou **`src/hooks/useEvolutionAPI.ts`** -- salvar `created_by` no INSERT
3. Nenhuma mudanca no `Chats.tsx` (RLS filtra automaticamente)

## Resultado

- Geise vera apenas os chats da instancia `geisi-wpp`
- Natalia vera apenas os chats da instancia `natcrm`
- Admins/Managers verao todas as instancias para supervisao

