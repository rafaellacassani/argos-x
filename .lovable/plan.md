

## Plano: Notas Internas em Tickets + Chat Interno entre Membros

Conforme solicitado, implementação sequencial — Funcionalidade 1 primeiro, aviso para teste, depois Funcionalidade 2.

---

### FUNCIONALIDADE 1 — Notas Internas em Tickets de Suporte

**Migration SQL:**
1. Criar tabela `support_notes`:
   - `id uuid PK default gen_random_uuid()`
   - `workspace_id uuid NOT NULL`
   - `queue_item_id uuid NOT NULL` (referência ao ticket na `human_support_queue`)
   - `user_id uuid NOT NULL`
   - `content text NOT NULL`
   - `created_at timestamptz default now()`
2. RLS: `workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))`
3. Habilitar realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.support_notes;`

**Frontend (`src/pages/SupportAdmin.tsx`):**
- Adicionar toggle "Nota Interna" / "WhatsApp" acima do `ChatInput`
- Quando "Nota Interna" ativo:
  - Exibir textarea simples com botão de enviar (sem emoji/mídia/áudio)
  - Insert direto na tabela `support_notes` (sem edge function)
- Carregar notas junto com as mensagens, intercalando por `created_at`
- Renderizar notas com visual diferenciado: fundo amarelo/dourado, ícone 🔒, nome do autor
- Subscribir via Supabase Realtime para notas novas no ticket selecionado

---

### FUNCIONALIDADE 2 — Chat Interno entre Membros (após aprovação da F1)

**Migration SQL:**
1. Criar tabela `internal_messages`:
   - `id uuid PK default gen_random_uuid()`
   - `workspace_id uuid NOT NULL`
   - `sender_id uuid NOT NULL`
   - `receiver_id uuid NOT NULL`
   - `content text NOT NULL`
   - `read boolean default false`
   - `created_at timestamptz default now()`
2. RLS: usuário só vê onde é `sender_id` ou `receiver_id` AND `workspace_id` pertence ao user
3. Habilitar realtime

**Frontend:**
- Nova página `src/pages/TeamChat.tsx` com rota `/equipe`
- Adicionar item "Equipe" no menu lateral (`AppSidebar.tsx`) com ícone `MessageSquare`
- Layout: lista de membros (esquerda) + conversa (direita)
- Mensagens em tempo real via Supabase Realtime
- Badge de não lidas no menu lateral (query `count` onde `receiver_id = auth.uid() AND read = false`)
- Lazy load + rota em `App.tsx`

---

### Arquivos alterados

**Funcionalidade 1:**
- 1 migration (tabela `support_notes` + RLS + realtime)
- `src/pages/SupportAdmin.tsx` (toggle nota/WA, render notas, realtime)

**Funcionalidade 2:**
- 1 migration (tabela `internal_messages` + RLS + realtime)
- `src/pages/TeamChat.tsx` (nova página)
- `src/components/layout/AppSidebar.tsx` (menu item + badge)
- `src/App.tsx` (rota `/equipe`)

### Não será alterado
- Nenhuma edge function existente
- Nenhuma tabela de suporte existente (human_support_queue, etc.)

