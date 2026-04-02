

## Receber Leads de Formulários Meta Ads no CRM

### Situação atual

O sistema Meta OAuth conecta páginas e Instagram para **mensagens** (DMs do Messenger/Instagram). Porém, **não suporta Lead Ads (formulários de campanha)**. Faltam 3 peças:

1. **Escopo OAuth** — `leads_retrieval` não está na lista de permissões solicitadas
2. **Webhook subscription** — o campo `leadgen` não está nos `subscribed_fields` da página
3. **Handler no webhook** — o `facebook-webhook` não processa eventos `leadgen`

### O que será construído

**1. Adicionar escopo `leads_retrieval` no OAuth** (`facebook-oauth/index.ts`)
- Adicionar `"leads_retrieval"` ao array `scopes` (linha 381-389)

**2. Adicionar `leadgen` na subscription do webhook** (`facebook-oauth/index.ts`)
- No `subscribed_fields` da chamada `subscribed_apps` (linha ~271), adicionar `"leadgen"`

**3. Criar handler de leadgen no webhook** (`facebook-webhook/index.ts`)
- Nova função `processLeadgenEvent(pageId, event)`:
  a. Recebe o `leadgen_id` do evento
  b. Faz GET na Graph API: `/{leadgen_id}?fields=field_data,ad_id,ad_name,campaign_id,campaign_name,form_id,form_name` usando o `page_access_token`
  c. Extrai `name`, `phone`, `email` dos `field_data`
  d. Busca o `meta_page` pelo `page_id` para obter `workspace_id`
  e. Cria lead no funil (primeira etapa do funil default) com `source: "meta-leadgen"`
  f. Cria tag automática (ex: `Meta Lead Ad` com cor roxa) se não existir, e aplica ao lead
  g. Salva a campanha/formulário de origem como metadado

- No handler POST (linha ~726), adicionar:
  ```
  // Handle leadgen events
  const changes = entry.changes || [];
  for (const change of changes) {
    if (change.field === "leadgen") {
      await processLeadgenEvent(entry.id, change.value);
    }
  }
  ```

### Fluxo completo

```text
Meta Ads → Formulário preenchido → Meta envia webhook "leadgen"
→ facebook-webhook recebe → processLeadgenEvent()
→ GET Graph API /{leadgen_id} (busca dados do formulário)
→ Extrai nome/telefone/email
→ Cria lead na 1ª etapa do funil default
→ Cria/aplica tag "Meta Lead Ad"
→ Lead aparece como card no Kanban
```

### Sobre a conexão do cliente

Depois de implementado, o fluxo para configurar o workspace do cliente é:

1. Logar no workspace dele (via admin)
2. Ir em Configurações → Integrações → Conectar Meta
3. O OAuth agora pedirá a permissão `leads_retrieval` além das atuais
4. Selecionar a página vinculada às campanhas
5. Pronto — leads dos formulários Meta chegarão automaticamente

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/facebook-oauth/index.ts` | Adicionar escopo `leads_retrieval` + campo `leadgen` no webhook subscription |
| `supabase/functions/facebook-webhook/index.ts` | Nova função `processLeadgenEvent` + handler no POST |

### O que NÃO muda
- Fluxo de mensagens (DMs Facebook/Instagram) — continua igual
- Tabela `leads` — usa os campos existentes
- Frontend — sem alterações necessárias

