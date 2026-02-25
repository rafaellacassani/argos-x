

# Auditoria: Fluxo de QR Code WhatsApp para o Workspace "Ana"

## Situacao Atual do Workspace "Ana"
- Workspace ID: `a316a370-526c-4942-a029-b292871340c6`
- Plano: `gratuito` (limite de 1 conexao WhatsApp)
- Instancias WhatsApp existentes: **nenhuma** (precisa criar uma nova)
- O fluxo de criar + ler QR Code sera usado pela primeira vez

---

## Bugs Encontrados

### Bug 1 (CRITICO): Headers CORS incompletos na Edge Function `evolution-api`

A Edge Function usa headers CORS incompletos:

```text
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
```

Faltam os headers que o SDK do Supabase JS v2+ envia automaticamente:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

**Impacto:** O preflight CORS pode falhar silenciosamente em alguns navegadores, fazendo com que chamadas como `createInstance`, `getQRCode` e `getConnectionState` retornem erro sem mensagem clara. Ana tentaria criar a conexao e veria "Erro ao criar conexao" sem explicacao.

### Bug 2 (MEDIO): Autenticacao usa `getUser()` em vez de `getClaims()`

O middleware `requireAuth` (linha 166) usa `supabase.auth.getUser()` que faz uma chamada de rede ao servidor de autenticacao. A abordagem recomendada para Edge Functions com signing-keys e usar `getClaims(token)` que valida o JWT localmente, sendo mais rapido e compativel.

**Impacto:** Pode causar erros 401 intermitentes dependendo da latencia ou configuracao de signing keys.

---

## Correcoes Planejadas

### Arquivo: `supabase/functions/evolution-api/index.ts`

**Correcao 1 - CORS:** Atualizar os headers CORS para incluir todos os headers enviados pelo SDK Supabase:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
```

**Correcao 2 - Auth:** Substituir `getUser()` por `getClaims()` no middleware de autenticacao:

```typescript
async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  await next();
}
```

### Nenhum outro arquivo precisa ser modificado

O `ConnectionModal.tsx`, `useEvolutionAPI.ts`, `Settings.tsx` e `usePlanLimits.ts` estao corretos para o fluxo da Ana:
- O limite de 1 conexao WhatsApp e respeitado
- O fluxo de criar instancia -> gerar QR -> polling de estado funciona
- O upsert no banco e o setup automatico de webhook estao corretos
- A deteccao de loop e auto-heal estao implementados

---

## Resumo

| Item | Status |
|---|---|
| CORS headers incompletos | Corrigir (critico) |
| Auth `getUser` vs `getClaims` | Corrigir (medio) |
| Fluxo QR Code (ConnectionModal) | OK |
| Limite de plano (whatsappLimit=1) | OK |
| Salvamento no banco (whatsapp_instances) | OK |
| Setup automatico de webhook | OK |
| Sincronizacao de historico | OK |
| Deteccao de loop + auto-heal | OK |

