

## Corrigir RLS para suportar multi-workspace

### Problema raiz

A função `get_user_workspace_id(auth.uid())` retorna apenas **1 workspace** (`LIMIT 1`), que é sempre o Argos X. Todas as tabelas que usam essa função nas políticas RLS bloqueiam silenciosamente qualquer acesso a dados do ECX Company — funnels, stages, leads, tags, tudo retorna vazio.

É por isso que as fases não aparecem: os dados existem no banco (8 fases corretas), mas o RLS impede a leitura.

### Correção

**1 migration** que altera todas as ~50 políticas RLS afetadas, trocando:

```sql
get_user_workspace_id(auth.uid())
```
por:
```sql
get_user_workspace_ids(auth.uid())
```

Ou seja, trocar `workspace_id = get_user_workspace_id(...)` por `workspace_id IN (SELECT get_user_workspace_ids(...))`.

A função `get_user_workspace_ids` (plural, já existe) retorna **todos** os workspaces do usuário, permitindo acesso ao ECX Company quando logado.

### Tabelas afetadas (~50 policies)

Todas as que aparecem na query acima: `funnels`, `funnel_stages`, `leads`, `lead_tags`, `lead_tag_assignments`, `ai_agents`, `campaigns`, `clients`, `whatsapp_messages`, `salesbots`, `stage_automations`, etc.

### O que NÃO muda
- Nenhum arquivo frontend
- A lógica de `switchWorkspace` continua a mesma
- Segurança mantida: o usuário só vê workspaces dos quais é membro

### Resultado
Ao trocar para ECX Company, todas as fases, leads, tags e demais dados aparecerão corretamente.

