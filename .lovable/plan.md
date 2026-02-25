
# Plano: Corrigir Integracao Google Calendar

## Problemas Identificados

### 1. Pull automatico nao acontece apos conexao
Quando o usuario conecta o Google Calendar via OAuth, o callback redireciona para `/settings?google_calendar=connected` mas **nenhum pull automatico e disparado**. O usuario precisa ir manualmente ao Calendario e clicar "Sincronizar" -- e mesmo assim, o pull so busca eventos **futuros** (`timeMin = now()`), ignorando eventos passados.

### 2. Push nao funciona - chamada incorreta ao invoke
No `useCalendar.ts`, o push e chamado assim:
```
supabase.functions.invoke("sync-google-calendar/push", { method: "POST", body: {...} })
```
Porem, `supabase.functions.invoke` trata o primeiro argumento como o **nome da funcao**, nao como path. O correto seria invocar `sync-google-calendar` com o path `/push` no body ou usar fetch direto. Isso explica por que eventos criados localmente **nao vao para o Google**.

### 3. Pull ignora eventos passados
O endpoint `/pull` usa `timeMin = new Date().toISOString()`, ou seja, so importa eventos futuros. Eventos que ja existem no Google Calendar do usuario nao sao importados.

### 4. Nome "qczmdbqwpshioooncpjd.supabase.co" na tela de autorizacao
Esse e o dominio do backend que aparece como "redirect URI" na tela de consentimento do Google. Para mudar, seria necessario configurar um dominio customizado no backend -- o que nao e possivel diretamente no Lovable Cloud. Porem, podemos melhorar a **app name** no Google Cloud Console (isso e configuracao externa).

## Solucao Proposta

### Arquivo: `supabase/functions/sync-google-calendar/index.ts`
- Alterar o endpoint `/pull` para aceitar um parametro `daysBehind` (padrao: 90) para importar eventos passados tambem
- Mudar `timeMin` para `now() - daysBehind` dias

### Arquivo: `src/hooks/useCalendar.ts`
- **Corrigir as chamadas `supabase.functions.invoke`** para usar fetch direto com a URL completa da funcao, ja que o Hono espera sub-rotas (`/push`, `/pull`, `/delete`)
- Adicionar **auto-pull apos detectar conexao** - quando `googleConnected` mudar para `true`, disparar automaticamente um pull com `daysBehind: 90`
- Passar `daysBehind: 90` no pull para importar eventos passados

### Arquivo: `supabase/functions/google-calendar-oauth/index.ts`
- No callback de sucesso, apos salvar o token, **disparar automaticamente o pull** chamando o endpoint `/pull` com o `userId` e `daysAhead: 60` + eventos passados

### Sobre o nome na tela de autorizacao
O dominio `qczmdbqwpshioooncpjd.supabase.co` aparece porque o redirect URI do OAuth aponta para la. Isso nao pode ser alterado diretamente no Lovable Cloud. Para personalizar o nome do app ("Argos X") que aparece na tela de consentimento do Google, voce precisa acessar o **Google Cloud Console** e editar o nome do app na tela de consentimento OAuth. O dominio de redirect continuara sendo o do backend, mas o nome e logo exibidos serao os que voce configurar la.

## Detalhes Tecnicos

### Correcao do invoke (useCalendar.ts)
Trocar de:
```typescript
supabase.functions.invoke("sync-google-calendar/push", { method: "POST", body: {...} })
```
Para:
```typescript
fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-google-calendar/push`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
  body: JSON.stringify({ eventId: id })
})
```

O mesmo para `/pull` e `/delete`.

### Auto-pull apos conexao
Adicionar useEffect que detecta `googleConnected === true` e dispara `pullFromGoogle()` automaticamente na primeira vez.

### Pull com eventos passados
Alterar o endpoint pull para:
```typescript
const daysBehind = body.daysBehind || 0;
const timeMin = new Date(Date.now() - daysBehind * 24 * 60 * 60 * 1000).toISOString();
```

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useCalendar.ts` | Corrigir invoke para fetch direto; auto-pull apos conexao; pull com dias passados |
| `supabase/functions/sync-google-calendar/index.ts` | Suportar `daysBehind` no pull |
| `supabase/functions/google-calendar-oauth/index.ts` | Disparar pull automatico no callback |

Nenhuma migration necessaria.
