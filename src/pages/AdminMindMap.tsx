import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, ChevronDown, Plus, X, GripVertical, 
  StickyNote, Trash2, Save, Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

// ─── Post-it types ───
interface PostIt {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  createdAt: string;
}

const POST_IT_COLORS = [
  "bg-yellow-200 border-yellow-400 text-yellow-900",
  "bg-pink-200 border-pink-400 text-pink-900",
  "bg-blue-200 border-blue-400 text-blue-900",
  "bg-green-200 border-green-400 text-green-900",
  "bg-purple-200 border-purple-400 text-purple-900",
  "bg-orange-200 border-orange-400 text-orange-900",
];

// ─── Mind Map Data ───
interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  children?: MindMapNode[];
}

const PROJECT_MAP: MindMapNode = {
  id: "root",
  label: "🧠 Inboxia CRM",
  description: "Plataforma completa de CRM multi-canal",
  children: [
    {
      id: "auth",
      label: "🔐 Autenticação",
      description: "Fluxo completo de auth",
      children: [
        { id: "auth-login", label: "Login", description: "Email + senha via Supabase Auth" },
        { id: "auth-signup", label: "Cadastro", description: "Criação de conta com full_name, email, senha" },
        { id: "auth-forgot", label: "Esqueci a Senha", description: "Envio de email de reset via resetPasswordForEmail" },
        { id: "auth-reset", label: "Redefinir Senha", description: "Página /auth/reset-password com updateUser" },
        { id: "auth-provider", label: "AuthProvider", description: "Context global com user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword" },
        { id: "auth-protected", label: "ProtectedRoute", description: "Guarda rotas: verifica user + workspace, redireciona para /auth ou /create-workspace" },
      ],
    },
    {
      id: "workspace",
      label: "🏢 Workspace (Multi-tenant)",
      description: "Isolamento de dados por workspace",
      children: [
        { id: "ws-create", label: "Criar Workspace", description: "Edge function create-workspace: cria workspace + member admin" },
        { id: "ws-provider", label: "WorkspaceProvider", description: "Context com workspace, workspaceId, membership, hasWorkspace" },
        { id: "ws-invite", label: "Convite de Membros", description: "Edge function invite-member: cria membro + envia email" },
        { id: "ws-accept", label: "Aceitar Convite", description: "Edge function accept-invite: bypass RLS, atualiza accepted_at" },
        { id: "ws-resend", label: "Reenviar Convite", description: "Botão no TeamManager, chama invite-member com resend=true" },
        { id: "ws-members", label: "Gestão de Membros", description: "fetchMembers, removeMember, updateMemberRole" },
        { id: "ws-roles", label: "Roles (RBAC)", description: "admin, manager, seller via workspace_members.role" },
        { id: "ws-rls", label: "RLS Policies", description: "Todas as tabelas filtram por workspace_id via get_user_workspace_id()" },
      ],
    },
    {
      id: "index",
      label: "🏠 Início (/)",
      description: "Página de boas-vindas",
      children: [
        { id: "idx-welcome", label: "Header de Boas-vindas", description: "Título animado + CTAs para Dashboard" },
        { id: "idx-quick", label: "Ações Rápidas", description: "4 cards: Tutorial, Docs, Demo, Suporte" },
        { id: "idx-features", label: "Funcionalidades", description: "4 cards: WhatsApp, IA, Analytics, Segurança" },
        { id: "idx-steps", label: "Primeiros Passos", description: "Checklist com status done/pending" },
      ],
    },
    {
      id: "dashboard",
      label: "📊 Dashboard (/dashboard)",
      description: "Painel de métricas e KPIs",
      children: [
        { id: "dash-stats", label: "StatCards", description: "Total conversas, leads ativos, tempo médio, alertas" },
        { id: "dash-filters", label: "Filtros", description: "Período (7d, 30d, 90d) + instância WhatsApp" },
        { id: "dash-line", label: "Gráfico de Linha", description: "Evolução de conversas por dia (recharts LineChart)" },
        { id: "dash-pie", label: "Gráfico de Pizza", description: "Distribuição de leads por estágio (recharts PieChart)" },
        { id: "dash-hook", label: "useDashboardData", description: "Hook que agrega dados de leads, conversas, instâncias" },
      ],
    },
    {
      id: "leads",
      label: "🎯 Funil de Vendas (/leads)",
      description: "Gestão completa de leads em Kanban",
      children: [
        { id: "leads-kanban", label: "LeadKanban", description: "Board drag-and-drop com @hello-pangea/dnd" },
        { id: "leads-columns", label: "LeadColumn", description: "Coluna do kanban com header colorido e contagem" },
        { id: "leads-card", label: "LeadCard", description: "Card do lead com avatar, nome, telefone, valor, tags" },
        { id: "leads-detail", label: "LeadDetailSheet", description: "Sheet lateral com dados completos do lead" },
        { id: "leads-create", label: "CreateLeadDialog", description: "Dialog para criar novo lead com nome, telefone, email, empresa, valor" },
        { id: "leads-stats", label: "LeadStats", description: "Cards com total, valor total, ganhos, taxa conversão" },
        { id: "leads-stages", label: "StageSettingsDialog", description: "Editar nome, cor, bot vinculado, estágio de ganho/perda" },
        { id: "leads-funnels", label: "Funis Múltiplos", description: "Select para trocar entre funis, criar novo funil" },
        { id: "leads-move", label: "Mover Lead", description: "Drag-and-drop ou botão no sheet, registra lead_history" },
        { id: "leads-tags", label: "Tags de Lead", description: "Adicionar/remover tags coloridas ao lead" },
        { id: "leads-sales", label: "Vendas do Lead", description: "Registrar produtos vendidos com valor (lead_sales)" },
        { id: "leads-history", label: "Histórico", description: "Timeline de movimentações entre estágios" },
        { id: "leads-bot", label: "Bot Trigger", description: "Ao mover lead, executa salesbot vinculado ao estágio" },
        { id: "leads-hook", label: "useLeads", description: "Hook central: fetchFunnels, fetchStages, fetchLeads, CRUD, moveLead, tags, sales, stats" },
        { id: "leads-realtime", label: "Realtime", description: "Subscrição postgres_changes na tabela leads" },
      ],
    },
    {
      id: "chats",
      label: "💬 Chats (/chats)",
      description: "Inbox unificado WhatsApp + Meta",
      children: [
        { id: "chat-list", label: "Lista de Conversas", description: "Sidebar com avatar, nome, última mensagem, timestamp, unread badge" },
        { id: "chat-window", label: "Janela de Chat", description: "Área de mensagens com scroll infinito" },
        { id: "chat-input", label: "ChatInput", description: "Textarea com envio de texto, mídia, áudio, emojis" },
        { id: "chat-bubble", label: "MessageBubble", description: "Balão de mensagem com suporte a texto, imagem, vídeo, áudio, documento" },
        { id: "chat-filters", label: "ChatFilters", description: "Filtros por status de resposta, último remetente, busca" },
        { id: "chat-emoji", label: "EmojiPicker", description: "Seletor de emojis integrado ao input" },
        { id: "chat-schedule", label: "ScheduleMessagePopover", description: "Agendar envio de mensagem para data/hora futura" },
        { id: "chat-tags", label: "ChatTagManager", description: "Gerenciar tags do lead diretamente no chat" },
        {
          id: "chat-whatsapp",
          label: "WhatsApp (Evolution API)",
          description: "Integração completa com Evolution API",
          children: [
            { id: "wa-instances", label: "Instâncias", description: "Múltiplas instâncias WhatsApp conectadas" },
            { id: "wa-fetch-chats", label: "Fetch Chats", description: "GET /chat/findChats com filtros" },
            { id: "wa-fetch-msgs", label: "Fetch Messages", description: "GET /chat/findMessages por conversa" },
            { id: "wa-send-text", label: "Enviar Texto", description: "POST /message/sendText" },
            { id: "wa-send-media", label: "Enviar Mídia", description: "POST /message/sendMedia (image, video, document)" },
            { id: "wa-send-audio", label: "Enviar Áudio", description: "POST /message/sendWhatsAppAudio com gravação" },
            { id: "wa-download", label: "Download Mídia", description: "GET /chat/getBase64FromMediaMessage" },
            { id: "wa-connection", label: "ConnectionModal", description: "Modal para conectar nova instância WhatsApp via QR Code" },
            { id: "wa-hook", label: "useEvolutionAPI", description: "Hook com todas as operações da Evolution API" },
          ],
        },
        {
          id: "chat-meta",
          label: "Meta (Facebook/Instagram)",
          description: "Integração via Graph API",
          children: [
            { id: "meta-pages", label: "Páginas Conectadas", description: "Facebook Pages + Instagram Business" },
            { id: "meta-conversations", label: "Conversas Meta", description: "Tabela meta_conversations no Supabase" },
            { id: "meta-send", label: "Enviar Mensagem", description: "Edge function meta-send-message" },
            { id: "meta-webhook", label: "Webhook", description: "Edge function facebook-webhook recebe mensagens" },
            { id: "meta-oauth", label: "OAuth Flow", description: "Edge function facebook-oauth para conectar conta" },
            { id: "meta-realtime", label: "Realtime", description: "Subscrição em meta_conversations para novas mensagens" },
            { id: "meta-hook", label: "useMetaChat", description: "Hook para pages, conversations, messages, send" },
          ],
        },
        { id: "chat-lead-create", label: "Auto-criar Lead", description: "Cria lead automaticamente ao receber mensagem de número novo" },
        { id: "chat-auto-tag", label: "Auto-tag", description: "Aplica tags automaticamente baseado em regras de palavras-chave" },
      ],
    },
    {
      id: "ai-agents",
      label: "🤖 Agentes de IA (/ai-agents)",
      description: "Gestão de agentes inteligentes",
      children: [
        { id: "ai-list", label: "Lista de Agentes", description: "Grid de cards com nome, modelo, status, execuções" },
        { id: "ai-create", label: "CreateAgentDialog", description: "Dialog para criar agente: nome, tipo, modelo, prompt, tools" },
        { id: "ai-card", label: "AgentCard", description: "Card com toggle ativo/inativo, stats, ações" },
        { id: "ai-models", label: "Modelos", description: "GPT-4o-mini, GPT-5, GPT-5 Mini, Claude (Escala)" },
        { id: "ai-prompt", label: "System Prompt", description: "Prompt personalizado do agente" },
        { id: "ai-tools", label: "Tools", description: "search_leads, move_lead, send_message, schedule_message" },
        { id: "ai-trigger", label: "Trigger Config", description: "Configuração de quando o agente é acionado" },
        { id: "ai-fallback", label: "Fallback Config", description: "Ação quando agente não consegue responder" },
        { id: "ai-pause", label: "Pause/Resume", description: "Código de pausa e keyword de retomada" },
        { id: "ai-split", label: "Message Split", description: "Dividir respostas longas em múltiplas mensagens" },
        { id: "ai-exec", label: "Execuções", description: "Logs de execução: input, output, tokens, latência, status" },
        { id: "ai-memory", label: "Memória", description: "agent_memories: histórico de conversa por sessão/lead" },
        { id: "ai-edge", label: "Edge Function", description: "ai-agent-chat: processa mensagem, gera resposta, registra execução" },
        { id: "ai-hook", label: "useAIAgents", description: "React Query hooks: CRUD, toggle, executions, stats" },
      ],
    },
    {
      id: "salesbots",
      label: "⚡ SalesBots (/salesbots)",
      description: "Automações de fluxo de vendas",
      children: [
        { id: "sb-list", label: "Lista de Bots", description: "Cards com nome, trigger, execuções, conversões, toggle" },
        { id: "sb-builder", label: "BotBuilderCanvas", description: "Canvas visual para construir fluxo de nós" },
        { id: "sb-nodes", label: "Tipos de Nós", description: "send_message, wait, condition, tag, move_stage, ai_response" },
        { id: "sb-node-card", label: "BotNodeCard", description: "Card de nó no canvas com inputs/outputs" },
        { id: "sb-node-selector", label: "NodeTypeSelector", description: "Painel lateral para adicionar novos nós" },
        { id: "sb-send-msg", label: "SendMessageNodeContent", description: "Configuração do nó de envio de mensagem" },
        { id: "sb-triggers", label: "Triggers", description: "new_lead, stage_change, keyword, scheduled" },
        { id: "sb-execution", label: "Execução de Fluxo", description: "useBotFlowExecution: executa nós em sequência" },
        { id: "sb-bot-exec", label: "useBotExecution", description: "Hook para executar bot individual" },
        { id: "sb-stage-link", label: "Vínculo com Estágio", description: "Bot vinculado a funnel_stage.bot_id, executa ao mover lead" },
        { id: "sb-logs", label: "Logs", description: "bot_execution_logs: registro por nó executado" },
        { id: "sb-hook", label: "useSalesBots", description: "CRUD, duplicate, toggle, fetch flow_data" },
      ],
    },
    {
      id: "calendar",
      label: "📅 Calendário (/calendar)",
      description: "Protótipo de interface",
      children: [
        { id: "cal-view", label: "Visualização", description: "Placeholder para calendário de eventos" },
      ],
    },
    {
      id: "contacts",
      label: "👥 Contatos (/contacts)",
      description: "Gestão de contatos",
      children: [
        { id: "ct-list", label: "Lista de Contatos", description: "Tabela com nome, telefone, email, empresa" },
        { id: "ct-import", label: "ImportContactsDialog", description: "Importar contatos via CSV/planilha" },
        { id: "ct-search", label: "Busca", description: "Filtro por nome, telefone, email" },
      ],
    },
    {
      id: "email",
      label: "📧 Email (/email)",
      description: "Protótipo de interface",
      children: [
        { id: "email-view", label: "Inbox", description: "Placeholder para integração de email" },
      ],
    },
    {
      id: "statistics",
      label: "📈 Estatísticas (/statistics)",
      description: "Protótipo de interface",
      children: [
        { id: "stats-view", label: "Relatórios", description: "Placeholder para métricas avançadas" },
      ],
    },
    {
      id: "campaigns",
      label: "📢 Campanhas (/campaigns)",
      description: "Protótipo de interface",
      children: [
        { id: "camp-view", label: "Gestão de Campanhas", description: "Placeholder para campanhas em massa" },
      ],
    },
    {
      id: "settings",
      label: "🔌 Integrações (/settings)",
      description: "Conexões e configurações de integrações",
      children: [
        { id: "set-integrations", label: "Tab Integrações", description: "Cards de integração: WhatsApp, Meta, com status" },
        { id: "set-whatsapp", label: "Tab WhatsApp", description: "Lista instâncias, status, refresh, delete, connect" },
        { id: "set-general", label: "Tab Geral", description: "Switches de configurações gerais" },
        { id: "set-autotag", label: "Tab Auto Tags", description: "AutoTagRules: regras de tag automática por palavra-chave" },
        { id: "set-team", label: "Tab Equipe", description: "TeamManager: convidar, listar, remover membros, roles, reenviar convite" },
        { id: "set-billing", label: "Tab Faturamento", description: "Placeholder para billing" },
      ],
    },
    {
      id: "configuracoes",
      label: "⚙️ Configurações (/configuracoes)",
      description: "Configurações pessoais e workspace",
      children: [
        { id: "cfg-profile", label: "Perfil", description: "Editar nome, email, avatar" },
        { id: "cfg-notif", label: "Notificações", description: "notification_settings: sem resposta, relatório semanal" },
        { id: "cfg-tags", label: "TagManager", description: "CRUD de tags globais do workspace" },
      ],
    },
    {
      id: "edge-functions",
      label: "⚡ Edge Functions (Backend)",
      description: "Funções serverless",
      children: [
        { id: "ef-accept", label: "accept-invite", description: "Aceita convite de workspace (bypass RLS)" },
        { id: "ef-create-ws", label: "create-workspace", description: "Cria workspace + member admin" },
        { id: "ef-invite", label: "invite-member", description: "Convida membro via email + auth admin" },
        { id: "ef-evolution", label: "evolution-api", description: "Proxy para Evolution API (WhatsApp)" },
        { id: "ef-fb-oauth", label: "facebook-oauth", description: "OAuth flow para conectar Meta" },
        { id: "ef-fb-webhook", label: "facebook-webhook", description: "Recebe webhooks do Meta (mensagens)" },
        { id: "ef-meta-send", label: "meta-send-message", description: "Envia mensagem via Graph API" },
        { id: "ef-ai-chat", label: "ai-agent-chat", description: "Processa mensagem com agente de IA" },
        { id: "ef-scheduled", label: "send-scheduled-messages", description: "Envia mensagens agendadas" },
        { id: "ef-no-response", label: "check-no-response", description: "Verifica leads sem resposta" },
        { id: "ef-weekly", label: "weekly-report", description: "Gera relatório semanal" },
      ],
    },
    {
      id: "database",
      label: "🗄️ Banco de Dados",
      description: "Tabelas Supabase com RLS",
      children: [
        { id: "db-workspaces", label: "workspaces", description: "id, name, slug, created_by" },
        { id: "db-members", label: "workspace_members", description: "workspace_id, user_id, role, invited_email, accepted_at" },
        { id: "db-profiles", label: "user_profiles", description: "user_id, full_name, email, phone, avatar_url" },
        { id: "db-roles", label: "user_roles", description: "user_id, role (app_role enum)" },
        { id: "db-funnels", label: "funnels", description: "name, description, is_default, workspace_id" },
        { id: "db-stages", label: "funnel_stages", description: "funnel_id, name, color, position, bot_id, is_win/loss" },
        { id: "db-leads", label: "leads", description: "name, phone, email, stage_id, value, responsible_user, status" },
        { id: "db-lead-history", label: "lead_history", description: "lead_id, action, from/to_stage_id, performed_by" },
        { id: "db-lead-tags", label: "lead_tags + lead_tag_assignments", description: "Tags coloridas com vínculo N:N" },
        { id: "db-lead-sales", label: "lead_sales", description: "lead_id, product_name, value" },
        { id: "db-ai-agents", label: "ai_agents", description: "Config completa do agente IA" },
        { id: "db-ai-exec", label: "agent_executions", description: "Logs de execução do agente" },
        { id: "db-ai-memory", label: "agent_memories", description: "Memória conversacional por sessão" },
        { id: "db-salesbots", label: "salesbots", description: "flow_data JSON, trigger_config, counters" },
        { id: "db-bot-logs", label: "bot_execution_logs", description: "bot_id, lead_id, node_id, status" },
        { id: "db-wa-instances", label: "whatsapp_instances", description: "instance_name, display_name" },
        { id: "db-meta-accounts", label: "meta_accounts", description: "user_access_token, token_expires_at" },
        { id: "db-meta-pages", label: "meta_pages", description: "page_id, page_access_token, platform, instagram_*" },
        { id: "db-meta-convos", label: "meta_conversations", description: "sender_id, content, direction, platform" },
        { id: "db-scheduled", label: "scheduled_messages", description: "message, scheduled_at, status, channel_type" },
        { id: "db-notif", label: "notification_settings", description: "notify_no_response, weekly_report settings" },
        { id: "db-tag-rules", label: "tag_rules", description: "match_phrase, tag_id, is_active" },
      ],
    },
    {
      id: "layout",
      label: "🎨 Layout & UI",
      description: "Componentes estruturais",
      children: [
        { id: "ui-sidebar", label: "AppSidebar", description: "Sidebar com menu, collapse, logo, workspace name" },
        { id: "ui-topbar", label: "TopBar", description: "Barra superior com user info" },
        { id: "ui-layout", label: "AppLayout", description: "Layout principal: sidebar + topbar + content" },
        { id: "ui-shadcn", label: "shadcn/ui", description: "40+ componentes UI reutilizáveis" },
        { id: "ui-motion", label: "framer-motion", description: "Animações em todo o app" },
        { id: "ui-theme", label: "Design System", description: "Tailwind tokens em index.css + tailwind.config.ts" },
      ],
    },
  ],
};

// ─── TreeNode Component ───
function TreeNode({ node, depth = 0, expandedNodes, toggleNode }: {
  node: MindMapNode;
  depth?: number;
  expandedNodes: Set<string>;
  toggleNode: (id: string) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  const depthColors = [
    "border-l-cyan-500",
    "border-l-emerald-500",
    "border-l-violet-500",
    "border-l-amber-500",
    "border-l-rose-500",
  ];

  return (
    <div className="select-none">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15, delay: depth * 0.02 }}
        className={cn(
          "flex items-start gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors group",
          "hover:bg-white/5",
          depth > 0 && `ml-${Math.min(depth * 4, 16)} border-l-2 ${depthColors[depth % depthColors.length]}`
        )}
        style={{ marginLeft: depth > 0 ? depth * 16 : 0 }}
        onClick={() => hasChildren && toggleNode(node.id)}
      >
        {hasChildren ? (
          <span className="mt-0.5 text-muted-foreground">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        ) : (
          <span className="w-4 h-4 mt-0.5 flex items-center justify-center text-muted-foreground">•</span>
        )}
        <div className="flex-1 min-w-0">
          <span className={cn(
            "font-medium text-sm",
            depth === 0 && "text-lg font-bold text-foreground",
            depth === 1 && "text-base font-semibold text-foreground",
            depth >= 2 && "text-sm text-foreground/90"
          )}>
            {node.label}
          </span>
          {node.description && (
            <span className="ml-2 text-xs text-muted-foreground">
              — {node.description}
            </span>
          )}
          {hasChildren && (
            <span className="ml-1.5 text-[10px] text-muted-foreground/60">
              ({node.children!.length})
            </span>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children!.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedNodes={expandedNodes}
                toggleNode={toggleNode}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PostIt Component ───
function PostItNote({ postit, onUpdate, onDelete, onDragEnd }: {
  postit: PostIt;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  return (
    <motion.div
      drag
      dragMomentum={false}
      onDragEnd={(_, info) => {
        onDragEnd(postit.id, postit.x + info.offset.x, postit.y + info.offset.y);
      }}
      className={cn(
        "absolute w-52 rounded-lg border-2 shadow-lg p-3 cursor-grab active:cursor-grabbing",
        postit.color
      )}
      style={{ left: postit.x, top: postit.y }}
      initial={{ scale: 0, rotate: -5 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.03 }}
    >
      <div className="flex items-center justify-between mb-2">
        <GripVertical className="w-3 h-3 opacity-40" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(postit.id); }}
          className="opacity-40 hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <textarea
        value={postit.text}
        onChange={(e) => onUpdate(postit.id, e.target.value)}
        placeholder="Escreva sua anotação..."
        className="w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed min-h-[60px]"
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="text-[9px] opacity-40 mt-1">
        {new Date(postit.createdAt).toLocaleDateString("pt-BR")}
      </div>
    </motion.div>
  );
}

// ─── Main Page ───
const ADMIN_EMAIL = "rafaellacassani@gmail.com";
const STORAGE_KEY = "inboxia_admin_postits";
const EXPANDED_KEY = "inboxia_admin_mindmap_expanded";

export default function AdminMindMap() {
  const { user, loading } = useAuth();
  const [postits, setPostits] = useState<PostIt[]>([]);
  const [showPostits, setShowPostits] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(EXPANDED_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set(["root"]);
    } catch {
      return new Set(["root"]);
    }
  });

  // Load post-its from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPostits(JSON.parse(saved));
    } catch {}
  }, []);

  // Save post-its
  const savePostits = useCallback((items: PostIt[]) => {
    setPostits(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, []);

  // Save expanded state
  useEffect(() => {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedNodes]));
  }, [expandedNodes]);

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds: string[] = [];
    const collect = (node: MindMapNode) => {
      allIds.push(node.id);
      node.children?.forEach(collect);
    };
    collect(PROJECT_MAP);
    setExpandedNodes(new Set(allIds));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(["root"]));
  }, []);

  const addPostit = useCallback(() => {
    const newPostit: PostIt = {
      id: crypto.randomUUID(),
      text: "",
      color: POST_IT_COLORS[Math.floor(Math.random() * POST_IT_COLORS.length)],
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      createdAt: new Date().toISOString(),
    };
    savePostits([...postits, newPostit]);
  }, [postits, savePostits]);

  const updatePostit = useCallback((id: string, text: string) => {
    savePostits(postits.map((p) => (p.id === id ? { ...p, text } : p)));
  }, [postits, savePostits]);

  const deletePostit = useCallback((id: string) => {
    savePostits(postits.filter((p) => p.id !== id));
  }, [postits, savePostits]);

  const movePostit = useCallback((id: string, x: number, y: number) => {
    savePostits(postits.map((p) => (p.id === id ? { ...p, x: Math.max(0, x), y: Math.max(0, y) } : p)));
  }, [postits, savePostits]);

  // Auth gate
  if (loading) return null;
  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border px-6 py-3">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <Map className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">Mapa Mental do Projeto</h1>
              <p className="text-xs text-muted-foreground">Visão completa de todas as funcionalidades — Admin Only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expandir Tudo
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Recolher
            </Button>
            <Button
              variant={showPostits ? "default" : "outline"}
              size="sm"
              onClick={() => setShowPostits(!showPostits)}
            >
              <StickyNote className="w-4 h-4 mr-1" />
              Post-its ({postits.length})
            </Button>
            <Button size="sm" onClick={addPostit}>
              <Plus className="w-4 h-4 mr-1" />
              Novo Post-it
            </Button>
          </div>
        </div>
      </div>

      <div className="flex max-w-[1800px] mx-auto">
        {/* Mind Map Tree */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <TreeNode
              node={PROJECT_MAP}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
          </div>
        </div>

        {/* Post-its Panel */}
        <AnimatePresence>
          {showPostits && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border bg-muted/30 overflow-hidden flex-shrink-0"
            >
              <div className="p-4 h-full overflow-y-auto">
                <h3 className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                  <StickyNote className="w-4 h-4" />
                  Minhas Anotações
                </h3>
                {postits.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Clique em "Novo Post-it" para adicionar anotações.
                  </p>
                )}
                <div className="space-y-3">
                  {postits.map((postit) => (
                    <div
                      key={postit.id}
                      className={cn(
                        "rounded-lg border-2 p-3 shadow-sm",
                        postit.color
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] opacity-50">
                          {new Date(postit.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        <button
                          onClick={() => deletePostit(postit.id)}
                          className="opacity-40 hover:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <textarea
                        value={postit.text}
                        onChange={(e) => updatePostit(postit.id, e.target.value)}
                        placeholder="Escreva aqui..."
                        className="w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed min-h-[50px]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
