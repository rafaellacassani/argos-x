

## Plano: Botões rápidos de Bloquear + Excluir Lead no Chat

### Contexto
Hoje o menu de "Acao rapida" no header do chat tem apenas "Mover para etapa" e "Ver detalhes do lead". O menu de tres pontos tem "Bloquear contato" e "Ignorar contato", mas nenhum deles exclui o lead do banco de dados.

### O que sera feito

**Arquivo: `src/pages/Chats.tsx`**

1. **Adicionar "Excluir lead" no menu "Acao rapida"** (linhas ~3188-3214)
   - Novo item no DropdownMenu existente com icone `Trash2` e texto "Excluir lead"
   - Ao clicar: confirmacao via `window.confirm` com aviso claro
   - Acao: chama `deleteLead(chatLead.id)` (ja disponivel via `useLeads`)
   - Pausa IA (`agent_memories.is_paused = true`) por session_id e lead_id
   - Cancela followups pendentes
   - Remove o chat da lista e volta para a lista (`setSelectedChat(null)`)
   - Toast de sucesso

2. **Adicionar "Bloquear e Excluir" no menu tres pontos** (linhas ~3246-3458)
   - Novo item apos "Bloquear contato" com icone `UserX` e texto "Bloquear e excluir lead"
   - Ao clicar: confirmacao dupla
   - Acao: bloqueia no WhatsApp (`blockContact`), pausa IA, cancela followups, e deleta o lead do banco
   - Toast e fecha o chat

### Detalhes tecnicos
- Reutiliza `deleteLead` do hook `useLeads` ja importado
- A exclusao em cascata ja funciona (RLS permite delete para membros do workspace)
- Se nao houver lead vinculado ao chat, os botoes ficam desabilitados/ocultos
- Icones necessarios: `Trash2`, `UserX` (de lucide-react)

### Resultado
O usuario tera 3 opcoes rapidas quando alguem diz "esse numero nao e meu":
- **Ignorar contato** (ja existe) — oculta da lista mas mantem no banco
- **Excluir lead** (novo) — remove completamente do CRM
- **Bloquear e excluir** (novo) — bloqueia no WhatsApp E remove do CRM

