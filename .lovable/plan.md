

## Adicionar "Cancelar minha conta" na página Perfil & Segurança

### Situação atual
Não existe nenhum botão de cancelamento de conta acessível ao cliente. A exclusão de workspace só existe no painel admin (`admin-clients` → action `delete-workspace`). O cliente não tem como cancelar por conta própria.

### O que será feito

**1. Nova Edge Function `supabase/functions/cancel-account/index.ts`**
- Autenticação obrigatória (Bearer token → `getUser()`)
- Busca o workspace do usuário via `workspace_members`
- Cancela assinatura Stripe (subscription + customer subscriptions, mesma lógica do `admin-clients` delete-workspace)
- Deleta todas as tabelas dependentes (mesma cascata do admin-clients: leads, mensagens, agentes, campanhas, etc.)
- Deleta workspace, membership, profile
- Deleta o usuário do auth via `supabaseAdmin.auth.admin.deleteUser()`
- Retorna sucesso

**2. `src/pages/ProfileSettings.tsx` — Seção "Zona de perigo" no final**
- Card vermelho com ícone `Trash2` e título "Excluir minha conta"
- Descrição: "Esta ação é **irreversível**. Todos os seus dados serão apagados permanentemente: leads, conversas, conexões WhatsApp, agentes de IA, campanhas e configurações. Sua assinatura será cancelada automaticamente."
- Botão "Excluir minha conta" (vermelho)
- Ao clicar: AlertDialog de confirmação com campo de texto pedindo digitar "EXCLUIR" para confirmar
- Após confirmar: chama a Edge Function, faz signOut, redireciona para `/auth`

### Fluxo do usuário
1. Vai em **Perfil & Segurança** (menu dropdown do avatar → "Perfil")
2. Rola até o final → seção "Zona de perigo"
3. Clica "Excluir minha conta"
4. Dialog: "Tem certeza? Esta ação é irreversível. Digite EXCLUIR para confirmar."
5. Digita "EXCLUIR" → clica confirmar
6. Edge Function cancela Stripe + deleta tudo
7. Usuário é deslogado e redirecionado para `/auth`

### O que NÃO será alterado
- Nenhuma outra página
- Nenhuma lógica de agentes, calendário, SalesBots
- O painel admin continua com sua própria funcionalidade de deletar workspaces

