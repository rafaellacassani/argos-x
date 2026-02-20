

# Implementacao: Calendario com Google Calendar - Prompt 1

## Resumo
Criar toda a infraestrutura backend para o calendario interno + sincronizacao bidirecional com Google Calendar: banco de dados, OAuth, Edge Functions e hook frontend. A CalendarPage.tsx NAO sera alterada neste prompt.

---

## 1. Migration SQL

Criar duas tabelas:

**calendar_events** - Eventos do calendario interno
- Campos: id, workspace_id, user_id, title, description, start_at, end_at, all_day, type, color, lead_id, location, google_event_id, synced_to_google, last_synced_at, created_at, updated_at
- Indices em workspace_id, user_id+start_at, google_event_id
- RLS: membros do workspace podem gerenciar seus eventos
- Realtime habilitado

**google_calendar_tokens** - Tokens OAuth por usuario
- Campos: id, user_id (UNIQUE), workspace_id, access_token, refresh_token, token_expiry, google_email, google_calendar_id, sync_enabled, created_at, updated_at
- RLS: apenas o proprio usuario acessa seus tokens

Trigger `update_updated_at_column` em ambas as tabelas.

---

## 2. Edge Function: google-calendar-oauth

Arquivo: `supabase/functions/google-calendar-oauth/index.ts`

Usa framework Hono (mesmo padrao do facebook-oauth). 4 rotas:

- **POST /url** - Gera URL de autorizacao Google. Recebe `{ workspaceId }` + JWT do usuario. Codifica userId + workspaceId no state. Retorna `{ url }`.

- **GET /callback** - Recebe code + state do Google. Troca code por tokens (access_token + refresh_token). Busca email do usuario Google. UPSERT em google_calendar_tokens. Redireciona para `APP_URL/settings?tab=integrations&google_calendar=connected`.

- **POST /refresh** - Renova access_token expirado. Recebe `{ userId }`. Busca refresh_token, chama Google token endpoint com grant_type=refresh_token. Atualiza no banco. Retorna `{ access_token }`.

- **DELETE /disconnect** - Extrai userId do JWT. Deleta registro de google_calendar_tokens. Retorna `{ success: true }`.

Config: `verify_jwt = false` no config.toml (validacao manual dentro da funcao).

---

## 3. Edge Function: sync-google-calendar

Arquivo: `supabase/functions/sync-google-calendar/index.ts`

Helper `refreshIfNeeded(userId)`: busca token, se expira em menos de 5 min, chama google-calendar-oauth/refresh.

- **POST /push** - Recebe `{ eventId }`. Busca evento + token do usuario. Se nao sincronizado: POST para Google Calendar API, salva google_event_id. Se ja sincronizado: PUT para atualizar.

- **DELETE /delete** - Recebe `{ eventId }`. Se tem google_event_id: DELETE no Google Calendar. Limpa campos de sync.

- **POST /pull** - Recebe `{ userId, daysAhead }`. GET eventos do Google Calendar. Para cada evento que nao existe localmente (por google_event_id): INSERT em calendar_events.

Config: `verify_jwt = false` no config.toml.

---

## 4. Hook: useCalendar.ts

Arquivo: `src/hooks/useCalendar.ts`

Funcionalidades:
- `events` - estado com eventos do mes
- `fetchEvents(year, month)` - busca do banco por periodo
- `createEvent(data)` - INSERT + auto-push se Google conectado
- `updateEvent(id, data)` - UPDATE + auto-push
- `deleteEvent(id)` - DELETE + sync delete
- `googleConnected` / `googleEmail` - status da conexao Google
- `connectGoogle()` - invoca google-calendar-oauth/url e redireciona
- `disconnectGoogle()` - invoca google-calendar-oauth/disconnect
- `pullFromGoogle()` - invoca sync-google-calendar/pull
- Subscription Realtime em calendar_events para atualizacoes em tempo real

---

## 5. Settings.tsx - Integracao Google Calendar

No card "Google Calendar" (linha ~329):
- Mudar `available: false` para `available: true`
- Mudar `connected: false` para usar `googleConnected` do hook
- Se conectado: badge "Conectado" + email Google + botoes "Sincronizar agora" e "Desconectar"
- Se nao conectado: botao "Conectar" chama `connectGoogle()`
- Detectar `?google_calendar=connected` na URL e mostrar toast de sucesso

---

## Arquivos criados/modificados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas calendar_events + google_calendar_tokens |
| `supabase/functions/google-calendar-oauth/index.ts` | Criar |
| `supabase/functions/sync-google-calendar/index.ts` | Criar |
| `supabase/config.toml` | Adicionar verify_jwt=false para as 2 novas functions |
| `src/hooks/useCalendar.ts` | Criar |
| `src/pages/Settings.tsx` | Modificar card Google Calendar |

