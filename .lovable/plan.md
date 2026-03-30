

## Correção: Instagram não detectado no OAuth do Facebook

### Problema
A edge function `facebook-oauth` busca contas Instagram apenas via `page.instagram_business_account` no endpoint `me/accounts`. Mas quando o Instagram é selecionado no diálogo OAuth sem estar vinculado como "Instagram Business Account" da Page, esse campo vem vazio. Resultado: o Instagram nunca é salvo em `meta_pages`.

### Solução
Após buscar as Pages, adicionar uma segunda consulta ao endpoint `me/instagram_accounts` (que retorna os Instagrams que o usuário autorizou, independente de estarem vinculados a uma Page). Para cada Instagram encontrado que ainda não foi detectado via Page, criar uma entrada separada em `meta_pages` com `platform = 'instagram'`.

### Alterações

**`supabase/functions/facebook-oauth/index.ts`**
1. Após o loop de pages (Step 5), adicionar Step 6:
   - Buscar `GET https://graph.facebook.com/v18.0/me/instagram_accounts?fields=id,username,profile_picture_url&access_token={token}`
   - Para cada Instagram retornado, verificar se já foi salvo (comparando `instagram_account_id` nos registros já criados)
   - Se não foi salvo, criar nova entrada em `meta_pages` com:
     - `platform = 'instagram'`
     - `instagram_account_id = ig.id`
     - `instagram_username = ig.username`
     - `page_id = ig.id` (usar o próprio IG ID como identificador)
     - `page_name = @{username}`
   - Inscrever no webhook de mensagens via a Page associada (se disponível)

2. Adicionar logs para rastrear quantos Instagrams foram encontrados por cada método

### O que NAO sera alterado
- Nenhuma tabela/migration
- Nenhum componente frontend
- A logica existente de deteccao via Page continua funcionando

