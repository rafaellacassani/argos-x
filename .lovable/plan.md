

# Correção: Exclusão de membro da equipe falhando

## Problema

A função `deleteTeamMember` no `useTeam.ts` tenta deletar apenas 3 tabelas:
1. `user_roles`
2. `notification_settings`
3. `user_profiles`

Mas **não remove** o registro de `workspace_members`, e também não limpa registros em outras tabelas que podem referenciar o `user_id`, como:
- `notification_preferences`
- `calendar_events`
- `google_calendar_tokens`
- `email_accounts`
- `scheduled_messages`
- `agent_followup_queue`
- `alert_log`
- `agent_executions`

Se alguma dessas tabelas tiver registros vinculados ao user_id da Geisi, a exclusão do `user_profiles` falha por constraint de foreign key, e o erro é engolido silenciosamente (apenas mostra toast de erro genérico).

## Solução

Atualizar a função `deleteTeamMember` em `src/hooks/useTeam.ts` para:

1. **Deletar registros relacionados** em todas as tabelas que referenciam `user_id`, na ordem correta:
   - `notification_preferences` (usa `user_profile_id`, precisa buscar o profile id primeiro)
   - `notification_settings`
   - `user_roles`
   - `calendar_events`
   - `google_calendar_tokens`
   - `email_accounts`
   - `scheduled_messages` (coluna `created_by`)
   - `agent_followup_queue`
   - `agent_executions`
   - `alert_log` (coluna `user_profile_id`)

2. **Remover de `workspace_members`** — esta é a etapa mais crítica que está faltando

3. **Por último**, deletar o `user_profiles`

4. **Melhorar o log de erros** para cada etapa, facilitando debug futuro

## Escopo técnico

- **Arquivo editado:** `src/hooks/useTeam.ts` — função `deleteTeamMember`
- Nenhuma migração de banco necessária (as tabelas já existem e aceitam DELETE via RLS para admins do workspace)

