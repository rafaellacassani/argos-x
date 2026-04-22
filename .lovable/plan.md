

# Ajustes para Testar a Integração Meta (Instagram + Facebook DMs)

Como você já validou no portal Meta (App Live, `instagram_manage_messages` aprovado, objeto `instagram` inscrito no webhook), o lado servidor já está pronto para receber DMs. Faltam 3 ajustes no Argos X para liberar testes em produção com qualquer cliente Escala.

## O que vou ajustar

### 1. PlanGate no botão de conexão Meta (Settings)
- Envolver os botões "Conectar Facebook" e "Conectar Instagram" em `<PlanGate blockedPlans={["essencial","negocio"]}>` em `src/pages/Settings.tsx`.
- Clientes fora do Escala veem o card desabilitado com CTA "Fazer upgrade".
- Workspaces master (Argos X / ECX) ignoram o gate normalmente (já é regra global).

### 2. Botão "Desconectar página Meta" (Settings)
- Adicionar botão de remover ao lado de cada página listada no card Meta.
- Ação: `update meta_pages set is_active=false where id=...` + chamada `DELETE /{page-id}/subscribed_apps` no Graph para parar de receber webhooks daquela página.
- Confirmação antes de desconectar.

### 3. Atualizar Graph API v18 → v21 + tratar token expirado
- Trocar todas as URLs `graph.facebook.com/v18.0` → `v21.0` em `supabase/functions/facebook-oauth/index.ts` (alinha com o webhook que já usa v21).
- Em `supabase/functions/meta-send-message/index.ts`: detectar erro `code: 190` (OAuthException / token expirado) e retornar mensagem clara "Reconecte sua página Meta — token expirou".
- Frontend mostra toast vermelho com botão "Reconectar" quando recebe esse erro.

## Quem pode testar

**Você (Argos X) já pode testar agora**, antes mesmo dos ajustes — porque master ignora plano e a página `Fellipe Magnago` (a única com IG real conectado) está no seu workspace.

**Cliente Escala pode testar** assim que os 3 itens acima forem aplicados (estimo ~30 min de implementação). Antes disso o cliente até consegue conectar (não tem gate ainda), mas se algo der errado não tem botão de desconectar/reconectar — então melhor esperar.

## Roteiro de teste (após deploy)

1. Em Configurações → Integrações, clicar "Conectar Instagram" → fluxo OAuth Meta → autorizar página + IG.
2. Confirmar que a página aparece listada com `@username` do Instagram.
3. Pedir para alguém mandar DM no Instagram da página conectada.
4. Abrir Chats → conferir se a conversa aparece (filtro pela instância Meta).
5. Responder pelo Argos X → confirmar entrega no Instagram.
6. Repetir o passo 3-5 com Facebook Messenger (mandar DM na página FB).
7. Testar botão "Desconectar" → confirmar que webhooks param de chegar.

## O que fica de fora deste ajuste (feature separada)

- **Comentários de posts (FB + IG):** continua não funcionando. Requer migration nova (`meta_comments`), handler novo no webhook, aprovação `instagram_manage_comments` na Meta (5–15 dias de review) e UI nova de aba Comentários no Chats. Trato em plano à parte quando você quiser priorizar — comunicar como "em breve" no Escala por enquanto.
- **Refresh automático de tokens (60 dias):** sem cron de renovação. Por ora o usuário reconecta manualmente quando expirar (vai ter o aviso claro graças ao item 3).

## Detalhes técnicos

- Arquivos editados: `src/pages/Settings.tsx`, `supabase/functions/facebook-oauth/index.ts`, `supabase/functions/meta-send-message/index.ts`.
- Sem migration de banco nesta etapa.
- Edge functions com deploy automático.
- `PlanGate` já existe em `src/components/layout/PlanGate.tsx`, só consumir.

