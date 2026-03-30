

## Diagnóstico: Instagram não é detectado no OAuth

### Evidência dos logs

Os logs mostram claramente o problema:

```text
Found 1 pages → "Argos X" (Facebook only)
instagram_business_account → NOT present on page
me/instagram_accounts → Found 0 accounts
Result: ig=0, only Facebook page saved
```

### Causa raiz

Dois problemas:

1. **Escopo `instagram_basic` ausente** — O endpoint `me/instagram_accounts` requer o escopo `instagram_basic` para retornar contas. Nosso OAuth só solicita `instagram_manage_messages` e `instagram_manage_comments`, que dão permissão de interagir mas NÃO de listar as contas.

2. **Falta buscar via endpoint da Page** — Mesmo com o escopo correto, existe um endpoint mais confiável: `GET /{page_id}?fields=connected_instagram_accounts{id,username}` que retorna os Instagrams conectados à Page independente de serem "business account".

### Correção

**Arquivo: `supabase/functions/facebook-oauth/index.ts`**

1. Adicionar `instagram_basic` à lista de scopes no POST `/url` (linha 338-346)

2. Após salvar cada Page (Step 5), adicionar uma busca extra:
   - `GET /{page_id}?fields=connected_instagram_accounts{id,username}&access_token={page_token}`
   - Se retornar Instagram(s) que não foram detectados via `instagram_business_account`, salvá-los como `platform: "instagram"` em `meta_pages`

3. Manter o Step 6 (`me/instagram_accounts`) como fallback adicional

### O que NÃO será alterado
- Nenhuma tabela/migration
- Nenhum componente frontend
- A lógica existente de detecção continua funcionando

### Nota
Após o deploy, será necessário **reconectar o Meta OAuth** para que os novos escopos sejam solicitados ao usuário.

