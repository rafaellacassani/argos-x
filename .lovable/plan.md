

## Plano: Sistema de Suporte Completo (Chat IA + Tickets + Notificações WhatsApp)

### Visão Geral

Criar um sistema de suporte integrado com 3 camadas: (1) chat flutuante com IA especializada no Argos X, (2) sistema de tickets para escalonamento humano, e (3) notificações WhatsApp para a equipe de suporte.

---

### 1. Banco de Dados — 2 novas tabelas

**`support_tickets`** — armazena os chamados
- `id`, `workspace_id`, `user_id`, `status` (open/in_progress/resolved/closed), `subject`, `priority`, `created_at`, `updated_at`, `assigned_to` (uuid nullable), `resolved_at`

**`support_messages`** — mensagens do chat de suporte (IA + humano)
- `id`, `ticket_id` (FK), `workspace_id`, `sender_type` (user/ai/agent), `sender_id` (uuid nullable), `content`, `created_at`

**Alteração em `workspaces`**: adicionar `support_whatsapp_instance` (text nullable) e `support_whatsapp_number` (text nullable) para configurar a instância de alerta de suporte.

RLS: membros do workspace podem gerenciar seus tickets; super admins (`has_role('admin')`) podem ver/gerenciar TODOS os tickets de qualquer workspace.

Habilitar realtime em `support_messages` para chat ao vivo.

### 2. Edge Function — `support-chat`

Usa Lovable AI (Gemini Flash) com system prompt detalhado contendo:
- Guia completo de como usar cada funcionalidade do Argos X (WhatsApp, campanhas, funil, agentes IA, calendário, etc.)
- Instruções para sempre tentar resolver antes de escalar
- Tool calling para `escalate_to_human` quando necessário — cria o ticket e envia notificação WhatsApp

Quando escala para humano:
1. Cria registro em `support_tickets` com status `open`
2. Envia mensagem via Evolution API para o WhatsApp configurado em `support_whatsapp_instance`

### 3. Componente Flutuante — `SupportChatWidget`

- Botão fixo no canto inferior direito (ícone de headset/suporte)
- Ao clicar, abre drawer/modal com chat
- Histórico de mensagens do ticket atual
- Se já tem ticket aberto, mostra o chat continuado
- Se não, inicia conversa com IA
- Renderiza markdown nas respostas da IA

Adicionado no `AppLayout.tsx` para estar presente em todas as páginas.

### 4. Página Admin — `/suporte` (área interna de chamados)

- Lista de todos os tickets (filtros por status, workspace)
- Ao clicar num ticket, abre o chat em tempo real
- Super admin pode responder (mensagens com `sender_type: 'agent'`)
- Indicadores: tickets abertos, tempo médio de resposta

### 5. Configuração WhatsApp de Suporte

Na página de Configurações, adicionar campo para selecionar a instância WhatsApp e número que receberá alertas de novos tickets.

---

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| DB migration | Criar `support_tickets`, `support_messages`, colunas em `workspaces` |
| `supabase/functions/support-chat/index.ts` | Edge function com Lovable AI + escalation |
| `supabase/config.toml` | Adicionar `[functions.support-chat]` |
| `src/components/support/SupportChatWidget.tsx` | Widget flutuante com chat IA |
| `src/components/support/SupportChatWindow.tsx` | Janela do chat (mensagens + input) |
| `src/pages/SupportAdmin.tsx` | Página admin de gerenciamento de tickets |
| `src/components/layout/AppLayout.tsx` | Adicionar `SupportChatWidget` |
| `src/App.tsx` | Rota `/suporte` para admin |
| `src/components/settings/NotificationSettings.tsx` | Campo WhatsApp de suporte |

### System Prompt da IA (resumo)

A IA será instruída com conhecimento detalhado sobre:
- Como conectar WhatsApp (QR Code, Cloud API)
- Como usar o funil de vendas e mover leads
- Como criar e configurar agentes de IA
- Como disparar campanhas em massa
- Como agendar mensagens
- Como usar tags e automações
- Como configurar calendário e Google Calendar
- Como gerenciar equipe e permissões
- Como ver estatísticas e relatórios

Sempre tenta resolver. Só escala quando o usuário pede explicitamente ou quando não consegue ajudar.

