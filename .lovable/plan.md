

## Problema Identificado

Quando a usuaria convidada clica no link do email e faz login, o sistema:
1. Busca memberships com `accepted_at IS NOT NULL` -- nao encontra nada
2. Busca convite pendente pelo email -- encontra
3. Tenta fazer `UPDATE workspace_members SET accepted_at = now()` -- **FALHA SILENCIOSAMENTE** porque a politica RLS so permite que admins facam update
4. Como nao tem workspace, redireciona para "Criar Workspace"

Confirmacao nos dados: Natalia e Geisi ja tem `user_id` real nos registros, mas `accepted_at` continua `null`.

## Solucao

### 1. Criar Edge Function `accept-invite`

Uma funcao backend que usa permissoes elevadas (service role) para aceitar o convite, contornando a restricao de RLS.

- Recebe o JWT do usuario logado
- Busca convite pendente pelo email ou user_id
- Atualiza `accepted_at` com service role (bypass RLS)
- Retorna os dados do workspace

### 2. Atualizar `useWorkspace.tsx`

Substituir o `supabase.update()` direto (que falha por RLS) por uma chamada a Edge Function `accept-invite`.

### 3. Corrigir convites existentes

As duas usuarias ja estao com user_id correto mas accepted_at = null. A correcao do fluxo vai aceitar automaticamente na proxima vez que elas fizerem login.

### 4. Adicionar botao "Reenviar Convite" no TeamManager

Na tabela de membros, para usuarios que ainda nao aceitaram o convite (accepted_at = null), exibir um botao "Reenviar Convite" que chama novamente `inviteUserByEmail` pelo edge function.

## Arquivos Alterados

| Arquivo | Acao |
|---|---|
| `supabase/functions/accept-invite/index.ts` | Criar (nova Edge Function) |
| `src/hooks/useWorkspace.tsx` | Editar (chamar accept-invite em vez de update direto) |
| `src/hooks/useTeam.ts` | Editar (adicionar funcao resendInvite) |
| `src/components/settings/TeamManager.tsx` | Editar (botao Reenviar Convite + indicador de status pendente) |
| `supabase/config.toml` | Editar (registrar nova funcao) |

## Detalhes Tecnicos

### Edge Function `accept-invite`
```text
POST /accept-invite
Headers: Authorization: Bearer <user_jwt>
Body: (vazio)

Logica:
1. Extrai user_id e email do JWT
2. Busca workspace_member onde user_id = X e accepted_at IS NULL
   OU invited_email = email e accepted_at IS NULL
3. Usa service role para UPDATE accepted_at = now()
4. Retorna { success: true, workspace_id: "..." }
```

### Botao "Reenviar Convite"
- Aparece apenas para membros com convite pendente (accepted_at = null)
- Chama a funcao `invite-member` novamente com os mesmos dados
- Feedback: "Convite reenviado para email@exemplo.com"

### Indicador visual de status
- Membros com convite pendente terao um badge "Pendente" na tabela
- Ao lado do badge, o botao de reenvio

