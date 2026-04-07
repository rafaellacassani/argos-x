
## Duplicar Workspace + Seletor Multi-Workspace

### Fase 1: Criar workspace ECX COMPANY e duplicar dados (via DB function)

**Migration**: Criar uma função `clone_workspace` que:
1. Cria novo workspace "ECX COMPANY" com mesmas configs (plan_type, limits, etc.)
2. Copia **funnels** → novos IDs (mapa old→new)
3. Copia **funnel_stages** → remapeando funnel_id
4. Copia **leads** (58K) → remapeando stage_id para os novos stages
5. Copia **lead_tags** (74 tags)
6. Copia **lead_tag_assignments** (116K) → remapeando lead_id e tag_id
7. Copia **clients** (158)
8. Copia **notification_preferences**
9. Copia **member_permissions** do seu usuário
10. Adiciona você como `admin` no `workspace_members` do novo workspace

**NÃO copia**: instâncias WhatsApp, agentes IA, mensagens, campanhas, agent memories, bot configs

### Fase 2: Seletor de workspace (apenas super admins)

**useWorkspace.tsx**:
- Carregar TODOS os workspaces do usuário (não só o primeiro)
- Guardar workspace selecionado em `localStorage`
- Função `switchWorkspace(id)` para trocar

**AppSidebar.tsx**:
- Adicionar dropdown no topo (onde mostra o nome do workspace) para super admins que têm >1 workspace
- Ao trocar, recarrega todo o contexto

### Arquivos modificados
- 1 migration (função clone + execução)
- `src/hooks/useWorkspace.tsx` (multi-workspace support)
- `src/components/layout/AppSidebar.tsx` (workspace switcher dropdown)

### Volume de dados
- ~58K leads + ~116K tag assignments = operação pesada, por isso usa função DB (executa server-side em segundos)
