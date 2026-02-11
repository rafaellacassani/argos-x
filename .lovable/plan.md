

## Sistema Multi-Tenant (Workspaces) para SaaS

### Visao Geral

Transformar o CRM de single-tenant em multi-tenant, onde cada empresa (ex: ECX) tem seu proprio workspace com dados completamente isolados. Cada empresa se cadastra, cria seu workspace e convida seus membros (SDRs, gestores).

### O Que Muda

Hoje todos os usuarios autenticados veem todos os dados. Apos a implementacao, cada registro no banco tera um `workspace_id` e as politicas de seguranca (RLS) garantirao que um usuario so veja dados do seu proprio workspace.

---

### Etapa 1: Criar tabelas de Workspace e Membership

Novas tabelas no banco de dados:

```text
workspaces
+------------------+----------+
| id (uuid, PK)    |          |
| name (text)      | "ECX"    |
| slug (text)      | "ecx"    |
| created_by (uuid)|          |
| created_at       |          |
+------------------+----------+

workspace_members
+------------------+----------+
| id (uuid, PK)    |          |
| workspace_id     | FK       |
| user_id (uuid)   |          |
| role (app_role)   | admin/   |
|                  | manager/ |
|                  | seller   |
| invited_at       |          |
| accepted_at      |          |
+------------------+----------+
```

### Etapa 2: Adicionar `workspace_id` em todas as tabelas de dados

Adicionar coluna `workspace_id` (uuid, NOT NULL, FK para workspaces) nas seguintes tabelas:
- `leads`
- `funnels`
- `funnel_stages`
- `lead_tags`
- `lead_tag_assignments`
- `lead_history`
- `lead_sales`
- `ai_agents`
- `agent_memories`
- `agent_executions`
- `salesbots`
- `bot_execution_logs`
- `whatsapp_instances`
- `meta_accounts`
- `meta_pages`
- `meta_conversations`
- `scheduled_messages`
- `tag_rules`

Para os dados existentes, serao atribuidos a um workspace "default" criado automaticamente.

### Etapa 3: Funcao auxiliar de seguranca

Criar funcao `get_user_workspace_id()` (SECURITY DEFINER) que retorna o `workspace_id` ativo do usuario autenticado. Essa funcao sera usada em todas as politicas RLS.

```text
get_user_workspace_id(user_id) -> uuid
  Busca em workspace_members o workspace do usuario
```

### Etapa 4: Atualizar todas as politicas RLS

Substituir as politicas atuais (que usam apenas `true` para autenticados) por politicas que filtram pelo workspace:

```text
Antes:  USING (true)
Depois: USING (workspace_id = get_user_workspace_id(auth.uid()))
```

Isso garante que um usuario da ECX nunca veja dados de outra empresa.

### Etapa 5: Fluxo de cadastro e onboarding

1. Usuario se cadastra (signup existente)
2. Apos login, se nao tem workspace: tela de "Criar Workspace" (nome da empresa)
3. Ao criar, vira admin do workspace automaticamente
4. Pode convidar membros por email com role (admin/manager/seller)
5. Membro convidado faz signup e ja entra no workspace correto

Novos componentes:
- `src/pages/CreateWorkspace.tsx` — tela de criacao
- `src/pages/AcceptInvite.tsx` — tela para aceitar convite
- `src/components/settings/WorkspaceSettings.tsx` — gerenciar workspace
- `src/hooks/useWorkspace.ts` — hook com workspace ativo e contexto

### Etapa 6: Contexto de Workspace no frontend

- Criar `WorkspaceProvider` que carrega o workspace ativo apos login
- Todas as queries ao banco passam a incluir `workspace_id` automaticamente
- Sidebar mostra nome do workspace atual
- TeamManager passa a usar `workspace_members` em vez de profiles globais

### Etapa 7: Atualizar hooks existentes

Todos os hooks que fazem queries ao banco precisam incluir o filtro de workspace:
- `useLeads` — adicionar `.eq('workspace_id', workspaceId)`
- `useTeam` — buscar de `workspace_members` em vez de `user_profiles` globais
- `useAIAgents` — filtrar por workspace
- `useSalesBots` — filtrar por workspace
- `useTagRules` — filtrar por workspace
- `useMetaChat` — filtrar por workspace

---

### Detalhes Tecnicos

**Migracao SQL**: Uma unica migracao grande que:
1. Cria tabelas `workspaces` e `workspace_members`
2. Cria workspace default para dados existentes
3. Adiciona `workspace_id` em todas as tabelas
4. Popula `workspace_id` com o workspace default
5. Cria funcoes auxiliares (`get_user_workspace_id`)
6. Recria todas as politicas RLS com filtro de workspace

**Arquivos novos**:
- `src/hooks/useWorkspace.ts`
- `src/pages/CreateWorkspace.tsx`
- `src/pages/AcceptInvite.tsx`
- `src/components/settings/WorkspaceSettings.tsx`

**Arquivos modificados**:
- `src/hooks/useAuth.tsx` — integrar workspace no fluxo pos-login
- `src/hooks/useLeads.ts` — adicionar filtro workspace
- `src/hooks/useTeam.ts` — buscar de workspace_members
- `src/hooks/useAIAgents.ts` — filtro workspace
- `src/hooks/useSalesBots.ts` — filtro workspace
- `src/hooks/useTagRules.ts` — filtro workspace
- `src/hooks/useMetaChat.ts` — filtro workspace
- `src/components/layout/AppSidebar.tsx` — mostrar nome do workspace
- `src/components/layout/TopBar.tsx` — menu com troca de workspace
- `src/components/settings/TeamManager.tsx` — usar workspace_members
- `src/App.tsx` — adicionar rotas de onboarding e WorkspaceProvider
- `src/components/layout/ProtectedRoute.tsx` — redirecionar para criar workspace se necessario

**Impacto**: Esta e a maior mudanca arquitetural do projeto. Recomendo implementar em fases, comecando pelo banco de dados e RLS, depois o onboarding, e por fim a adaptacao de cada modulo.

