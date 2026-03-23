import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const ADMIN_EMAIL = "rafaellacassani@gmail.com";

export default function ProjectDocs() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          h2 { page-break-before: always; }
          h2:first-of-type { page-break-before: avoid; }
          table { page-break-inside: avoid; }
          .section-block { page-break-inside: avoid; }
        }
      `}</style>

      <div className="min-h-screen bg-white text-gray-900">
        {/* Fixed Export Button */}
        <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Documentação Argos X CRM</h1>
          <Button onClick={handleExportPDF} className="gap-2">
            <FileDown className="w-4 h-4" />
            Exportar para PDF
          </Button>
        </div>

        {/* Printable Content */}
        <div className="print-area max-w-4xl mx-auto px-8 py-12 leading-relaxed text-[15px]">

          {/* Cover */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Argos X CRM</h1>
            <p className="text-xl text-gray-600 mb-2">Documentação Completa do Sistema</p>
            <p className="text-sm text-gray-400">Versão 1.0 — Fevereiro 2026</p>
          </div>

          {/* TOC */}
          <div className="mb-16 p-6 bg-gray-50 rounded-lg border">
            <h2 className="text-2xl font-bold mb-4" style={{ pageBreakBefore: "avoid" }}>Índice</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Visão Geral do Argos X</li>
              <li>Autenticação e Onboarding</li>
              <li>Dashboard</li>
              <li>Funil de Vendas (Leads)</li>
              <li>Chats Unificados</li>
              <li>Agendamento de Mensagens (Follow-up Automático)</li>
              <li>Tags Automáticas por Campanha</li>
              <li>Gestão de Tags Manual</li>
              <li>Agentes de IA</li>
              <li>SalesBots (Automações Visuais)</li>
              <li>Contatos</li>
              <li>Campanhas</li>
              <li>Calendário</li>
              <li>Estatísticas</li>
              <li>Integrações</li>
              <li>Configurações</li>
              <li>Equipe (Multi-tenant)</li>
              <li>Funções de Backend</li>
            </ol>
          </div>

          {/* 1. Visão Geral */}
          <Section title="1. Visão Geral do Argos X">
            <p>O <strong>Argos X</strong> é um CRM completo de vendas com foco em comunicação omnichannel, construído como uma plataforma SaaS multi-tenant. O sistema foi projetado para equipes comerciais que precisam gerenciar leads, conversas e automações de vendas em um único lugar.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Arquitetura Multi-Tenant</h3>
            <p>O sistema opera com <strong>workspaces isolados</strong>. Cada empresa cliente possui seu próprio workspace com dados completamente separados. A arquitetura garante:</p>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
              <li><strong>Isolamento total de dados</strong> — Cada workspace possui seus próprios leads, conversas, tags, funis, agentes e configurações</li>
              <li><strong>Row Level Security (RLS)</strong> — Todas as tabelas utilizam políticas de segurança a nível de linha vinculadas ao workspace do usuário autenticado</li>
              <li><strong>Roles por workspace</strong> — Cada membro tem um papel (admin, manager, seller) específico dentro do workspace</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Stack Tecnológica</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Camada</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Tecnologia</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Frontend</td><td className="border border-gray-300 px-3 py-2">React 18, TypeScript, Vite, Tailwind CSS</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">UI Components</td><td className="border border-gray-300 px-3 py-2">shadcn/ui, Radix UI, Framer Motion</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Backend</td><td className="border border-gray-300 px-3 py-2">Lovable Cloud (Edge Functions em Deno)</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Banco de Dados</td><td className="border border-gray-300 px-3 py-2">PostgreSQL com RLS</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Autenticação</td><td className="border border-gray-300 px-3 py-2">Auth nativo com JWT</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">WhatsApp</td><td className="border border-gray-300 px-3 py-2">Evolution API (QR Code) + API Oficial</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Meta (FB/IG)</td><td className="border border-gray-300 px-3 py-2">Graph API + Webhooks</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">IA</td><td className="border border-gray-300 px-3 py-2">GPT-4o Mini, GPT-5, Claude (multi-modelo)</td></tr>
              </tbody>
            </table>
          </Section>

          {/* 2. Autenticação */}
          <Section title="2. Autenticação e Onboarding">
            <h3 className="text-lg font-semibold mt-4 mb-2">Fluxo de Cadastro</h3>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Usuário acessa <code>/auth</code> e preenche nome completo, email e senha</li>
              <li>Sistema cria conta com verificação de email</li>
              <li>Automaticamente cria registro em <code>user_profiles</code> (nome, email) e <code>user_roles</code> (role padrão: seller)</li>
              <li>Após login, verifica se o usuário possui workspace</li>
              <li>Se não possui, redireciona para <code>/create-workspace</code></li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Fluxo de Convite</h3>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Admin convida membro por email via Edge Function <code>invite-member</code></li>
              <li>Convidado recebe email com link de cadastro</li>
              <li>Ao fazer login, a Edge Function <code>accept-invite</code> detecta convites pendentes pelo email</li>
              <li>Convite é aceito automaticamente — o membro entra direto no workspace sem precisar criar um novo</li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Reset de Senha</h3>
            <p>Fluxo completo via <code>/auth/reset-password</code>. O usuário recebe email com link seguro para redefinir senha. A página detecta o token na URL e permite inserir a nova senha.</p>
          </Section>

          {/* 3. Dashboard */}
          <Section title="3. Dashboard">
            <p>Painel principal com visão consolidada de toda a operação comercial. Atualizado em tempo real com dados do workspace.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">KPIs Principais</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Métrica</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Total de Mensagens</td><td className="border border-gray-300 px-3 py-2">Quantidade de mensagens trocadas no período selecionado</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Conversas Ativas</td><td className="border border-gray-300 px-3 py-2">Chats com interação recente</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Não Respondidos</td><td className="border border-gray-300 px-3 py-2">Chats aguardando resposta da equipe</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Tempo Médio de Resposta</td><td className="border border-gray-300 px-3 py-2">Tempo médio para primeira resposta</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Visualizações</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Gráfico de Evolução (Linha)</strong> — Mensagens recebidas vs enviadas ao longo do tempo</li>
              <li><strong>Fontes de Leads (Pizza)</strong> — Distribuição percentual por origem (WhatsApp, Facebook, Instagram, Manual)</li>
              <li><strong>Leads Recentes</strong> — Lista dos últimos leads criados com status visual (ativo, ganho, perdido)</li>
              <li><strong>Performance da Equipe</strong> — Barra de progresso por membro com taxa de resolução</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Filtro por Período</h3>
            <p>Seletor no topo permite filtrar todos os dados por: <strong>Hoje</strong>, <strong>7 dias</strong>, <strong>30 dias</strong> ou <strong>90 dias</strong>. Todos os KPIs e gráficos se ajustam automaticamente.</p>
          </Section>

          {/* 4. Funil de Vendas */}
          <Section title="4. Funil de Vendas (Leads)">
            <p>Sistema de gestão de pipeline comercial com visualização Kanban completa.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Kanban Drag-and-Drop</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Visualização em colunas por etapa do funil</li>
              <li>Arrastar e soltar cards entre etapas com atualização em tempo real</li>
              <li>Posição do card dentro da coluna é persistida</li>
              <li>Ao mover entre etapas, o sistema registra automaticamente no <strong>histórico de movimentações</strong></li>
              <li>Se a etapa de destino tiver um <strong>SalesBot</strong> vinculado, o bot é executado automaticamente</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Múltiplos Funis</h3>
            <p>O sistema suporta múltiplos funis de venda. Cada funil possui suas próprias etapas customizáveis. Um funil é marcado como "padrão" e é carregado inicialmente.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Etapas Customizáveis</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Nome e cor personalizáveis por etapa</li>
              <li>Posição (ordem) configurável</li>
              <li>Marcação de etapa como <strong>vitória</strong> ou <strong>perda</strong></li>
              <li>Vinculação opcional de SalesBot à etapa</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Card do Lead — Dados Completos</h3>
            <p>Cada card no Kanban exibe resumo e, ao clicar, abre um <strong>Sheet lateral</strong> com todas as informações:</p>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Campo</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Dados de Contato</td><td className="border border-gray-300 px-3 py-2">Nome, telefone, email, empresa</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Tags</td><td className="border border-gray-300 px-3 py-2">Tags coloridas vinculadas ao lead, com opção de adicionar/remover</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Vendas/Produtos</td><td className="border border-gray-300 px-3 py-2">Lista de produtos com nome e valor, editável inline</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Histórico</td><td className="border border-gray-300 px-3 py-2">Timeline de todas as movimentações entre etapas com data/hora</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Responsável</td><td className="border border-gray-300 px-3 py-2">Membro da equipe designado ao lead</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Notas</td><td className="border border-gray-300 px-3 py-2">Campo de texto livre para anotações</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Valor Total</td><td className="border border-gray-300 px-3 py-2">Soma automática de todos os produtos/vendas</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Fonte</td><td className="border border-gray-300 px-3 py-2">Origem do lead (WhatsApp, Facebook, Instagram, Manual)</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Ações no Card</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Abrir Chat</strong> — Navega diretamente para o chat do lead</li>
              <li><strong>Mover Etapa</strong> — Dropdown para mover para qualquer etapa do funil</li>
              <li><strong>Editar Dados</strong> — Edição inline de todos os campos</li>
              <li><strong>Excluir Lead</strong> — Com confirmação</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Estatísticas por Etapa</h3>
            <p>No topo de cada coluna do Kanban, exibe: <strong>contagem de leads</strong> na etapa e <strong>valor total</strong> (soma dos valores de todos os leads na etapa).</p>
          </Section>

          {/* 5. Chats Unificados */}
          <Section title="5. Chats Unificados">
            <p>Inbox omnichannel que consolida todas as conversas de WhatsApp, Facebook Messenger e Instagram Direct em uma única interface.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Canais Suportados</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Canal</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Integração</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Badge</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">WhatsApp</td><td className="border border-gray-300 px-3 py-2">Evolution API (QR Code) + API Oficial</td><td className="border border-gray-300 px-3 py-2">🟢 WA</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Facebook Messenger</td><td className="border border-gray-300 px-3 py-2">Meta Graph API + Webhooks</td><td className="border border-gray-300 px-3 py-2">🔵 FB</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Instagram Direct</td><td className="border border-gray-300 px-3 py-2">Meta Graph API + Webhooks</td><td className="border border-gray-300 px-3 py-2">🟣 IG</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Múltiplas Instâncias WhatsApp</h3>
            <p>O sistema suporta <strong>múltiplas instâncias WhatsApp simultâneas</strong> conectadas via QR Code. O seletor de instância permite:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Visualizar chats de uma instância específica</li>
              <li><strong>"Todas as instâncias"</strong> — Consolida todos os chats de todas as instâncias + Meta em uma lista unificada</li>
              <li>Cada chat exibe badge indicando a fonte (WA/FB/IG)</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Tipos de Mensagem Suportados</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Texto</strong> — Mensagens de texto simples</li>
              <li><strong>Imagem</strong> — Envio e recebimento com preview e download</li>
              <li><strong>Vídeo</strong> — Envio e recebimento com player inline</li>
              <li><strong>Documento</strong> — PDF, planilhas, etc. com botão de download</li>
              <li><strong>Áudio</strong> — Gravação de áudio pelo navegador com conversão para formato compatível</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">⭐ Filtros Avançados de Chat (Diferencial)</h3>
            <p>O sistema possui um painel de filtros completo que permite combinações avançadas:</p>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Filtro</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Período</td><td className="border border-gray-300 px-3 py-2">Filtra conversas por intervalo de datas</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Etapa do Funil</td><td className="border border-gray-300 px-3 py-2">Filtra por qual etapa do pipeline o lead está</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Tags</td><td className="border border-gray-300 px-3 py-2">Filtra por tags vinculadas ao lead/chat</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Fonte</td><td className="border border-gray-300 px-3 py-2">WhatsApp, Facebook ou Instagram</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Responsável</td><td className="border border-gray-300 px-3 py-2">Membro da equipe designado</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Status de Resposta</td><td className="border border-gray-300 px-3 py-2">Respondido / Não respondido / Todos</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Último Remetente</td><td className="border border-gray-300 px-3 py-2">Filtra se a última mensagem foi do cliente ou da equipe</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Criação Automática de Leads</h3>
            <p>Quando uma mensagem é recebida de um número/perfil que <strong>ainda não existe no CRM</strong>, o sistema automaticamente:</p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Cria um novo lead na primeira etapa do funil padrão</li>
              <li>Preenche nome e telefone automaticamente</li>
              <li>Define a fonte de origem (WhatsApp/Facebook/Instagram)</li>
              <li>Aplica tags automáticas se houver regras configuradas (ver seção 7)</li>
            </ol>
          </Section>

          {/* 6. Agendamento de Mensagens */}
          <Section title="6. Agendamento de Mensagens — Follow-up Automático">
            <p className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><strong>⭐ Diferencial de Mercado:</strong> O Argos X permite agendar mensagens futuras para qualquer canal (WhatsApp, Facebook, Instagram) diretamente do chat, criando um sistema completo de follow-up automatizado sem necessidade de ferramentas externas.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Como Funciona</h3>
            <ol className="list-decimal list-inside ml-4 space-y-2">
              <li><strong>No chat</strong>, ao lado do botão de envio, existe um ícone de relógio (⏰) que abre o <strong>Popover de Agendamento</strong></li>
              <li>O usuário seleciona a <strong>data</strong> via calendário visual e a <strong>hora</strong> via seletores de hora/minuto</li>
              <li>Escreve a mensagem de follow-up desejada</li>
              <li>Ao confirmar, a mensagem é salva na tabela <code>scheduled_messages</code> com status <strong>"pendente"</strong></li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Processamento Automático (Backend)</h3>
            <p>A Edge Function <code>send-scheduled-messages</code> é executada <strong>automaticamente a cada minuto</strong> via <code>pg_cron</code> e:</p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Busca todas as mensagens com <code>status = 'pendente'</code> e <code>scheduled_at &lt;= agora</code></li>
              <li>Identifica o canal correto pelo campo <code>channel_type</code></li>
              <li>Para <strong>WhatsApp</strong>: Envia via Evolution API usando <code>instance_name</code> e <code>remote_jid</code></li>
              <li>Para <strong>Facebook/Instagram</strong>: Envia via Edge Function <code>meta-send-message</code> usando <code>meta_page_id</code> e <code>sender_id</code></li>
              <li>Atualiza o status para <strong>"enviado"</strong> (sucesso) ou <strong>"falhou"</strong> (com mensagem de erro)</li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Estrutura de Dados</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Campo</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">channel_type</td><td className="border border-gray-300 px-3 py-2">whatsapp, facebook ou instagram</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">scheduled_at</td><td className="border border-gray-300 px-3 py-2">Data e hora de envio programado</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">message</td><td className="border border-gray-300 px-3 py-2">Conteúdo da mensagem</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">status</td><td className="border border-gray-300 px-3 py-2">pendente → enviado / falhou</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">remote_jid / sender_id</td><td className="border border-gray-300 px-3 py-2">Identificador do destinatário no canal</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">instance_name / meta_page_id</td><td className="border border-gray-300 px-3 py-2">Instância/Página de origem para roteamento</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">contact_name</td><td className="border border-gray-300 px-3 py-2">Nome do contato para exibição</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">sent_at</td><td className="border border-gray-300 px-3 py-2">Timestamp do envio efetivo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">error_message</td><td className="border border-gray-300 px-3 py-2">Mensagem de erro caso falhe</td></tr>
              </tbody>
            </table>
          </Section>

          {/* 7. Tags Automáticas */}
          <Section title="7. Tags Automáticas por Campanha">
            <p className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"><strong>⭐ Diferencial de Mercado:</strong> O Argos X permite criar regras que aplicam tags automaticamente com base na <strong>primeira mensagem de abordagem</strong> do lead. Isso permite cruzar exatamente <strong>de qual campanha do Meta</strong> cada lead está vindo, identificando quais campanhas estão gerando conversão e quais não estão.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Lógica de Funcionamento</h3>
            <ol className="list-decimal list-inside ml-4 space-y-2">
              <li><strong>Criação de Regra:</strong> Na tela de Configurações {">"} Automações, o admin cria uma regra com dois campos:
                <ul className="list-disc list-inside ml-8 mt-1">
                  <li><strong>Frase de correspondência</strong> — Ex: "Olá, vi seu anúncio de Black Friday"</li>
                  <li><strong>Tag a aplicar</strong> — Ex: "Campanha Black Friday 2025" (cor vermelha)</li>
                </ul>
              </li>
              <li><strong>Detecção Automática:</strong> Quando um novo lead envia a primeira mensagem, o sistema verifica se o conteúdo <strong>contém a frase configurada</strong> (match parcial, case-insensitive)</li>
              <li><strong>Aplicação da Tag:</strong> Se match positivo, a tag é automaticamente vinculada ao lead recém-criado</li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Caso de Uso: Rastreamento de Campanhas Meta</h3>
            <p>O fluxo completo de rastreamento funciona assim:</p>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Admin cria campanha no Meta Ads com uma <strong>mensagem de abordagem específica</strong> (ex: "Quero saber mais sobre o plano Premium")</li>
              <li>No Argos X, cria regra: <em>se mensagem contém "plano Premium" → aplica tag "Campanha Premium Jan/26"</em></li>
              <li>Lead clica no anúncio → mensagem chega via WhatsApp/Instagram/Facebook</li>
              <li>Argos X cria o lead automaticamente E aplica a tag automaticamente</li>
              <li>No Kanban, admin pode filtrar leads por tag e ver exatamente quantos vieram dessa campanha</li>
              <li>Cruzando com leads que avançaram no funil (ganhos), identifica a <strong>taxa de conversão por campanha</strong></li>
            </ol>

            <h3 className="text-lg font-semibold mt-6 mb-2">Gestão de Regras</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Ação</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Criar Regra</td><td className="border border-gray-300 px-3 py-2">Define frase + tag alvo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Ativar/Desativar</td><td className="border border-gray-300 px-3 py-2">Toggle por regra sem excluir</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Excluir</td><td className="border border-gray-300 px-3 py-2">Remove a regra permanentemente</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-sm text-gray-600">Tabela no banco: <code>tag_rules</code> com campos: <code>match_phrase</code>, <code>tag_id</code>, <code>is_active</code>, <code>workspace_id</code></p>
          </Section>

          {/* 8. Tags Manual */}
          <Section title="8. Gestão de Tags Manual">
            <p>Sistema completo de tags coloridas para categorização de leads e chats.</p>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
              <li><strong>CRUD Completo</strong> — Criar, editar, excluir tags</li>
              <li><strong>Cores Personalizáveis</strong> — Paleta de cores para identificação visual</li>
              <li><strong>Contador de Uso</strong> — Exibe quantos leads possuem cada tag</li>
              <li><strong>Aplicar/Remover em Leads</strong> — Via card do lead no Kanban ou no Chat</li>
              <li><strong>Aplicar/Remover em Chats</strong> — Gerenciador de tags inline no chat via componente ChatTagManager</li>
            </ul>
            <p className="mt-2">Tabelas: <code>lead_tags</code> (definição) + <code>lead_tag_assignments</code> (vinculação lead↔tag)</p>
          </Section>

          {/* 9. Agentes de IA */}
          <Section title="9. Agentes de IA">
            <p>Sistema de agentes de inteligência artificial que podem atender leads automaticamente via chat, com personalidade e ferramentas configuráveis.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Templates Pré-configurados</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Template</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Função</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">SDR (Qualificação)</td><td className="border border-gray-300 px-3 py-2">Qualifica leads com perguntas estratégicas</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Agendamento</td><td className="border border-gray-300 px-3 py-2">Agenda reuniões e consultas</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Follow-up</td><td className="border border-gray-300 px-3 py-2">Retoma contato com leads inativos</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Cobrança</td><td className="border border-gray-300 px-3 py-2">Envia lembretes de pagamento</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Customizado</td><td className="border border-gray-300 px-3 py-2">Prompt totalmente livre</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Configurações do Agente</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Modelo de IA</strong> — GPT-4o Mini (padrão), GPT-5, GPT-5 Mini, Claude Haiku/Sonnet (Escala)</li>
              <li><strong>Prompt de Sistema</strong> — Instrução principal que define personalidade e comportamento</li>
              <li><strong>Temperatura</strong> — Controle de criatividade (0.0 = preciso, 1.0 = criativo)</li>
              <li><strong>Max Tokens</strong> — Limite de tamanho de resposta</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">⭐ Ferramentas do Agente (Function Calling)</h3>
            <p>Os agentes podem executar ações reais no CRM durante a conversa:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Atualizar Lead</strong> — Alterar dados do lead (nome, email, empresa, valor)</li>
              <li><strong>Aplicar Tag</strong> — Vincular tag ao lead automaticamente</li>
              <li><strong>Mover Etapa</strong> — Mover lead para outra etapa do funil</li>
              <li><strong>Pausar IA</strong> — O agente pode se auto-pausar e transferir para humano</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Controle Humano</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Código de Pausa</strong> — Palavra-chave que o atendente envia para pausar o agente (ex: "#pausar")</li>
              <li><strong>Keyword de Retomada</strong> — Palavra para reativar o agente (ex: "#ativar")</li>
              <li><strong>Flag is_paused</strong> — Por sessão/lead na tabela <code>agent_memories</code></li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Divisão Automática de Mensagens</h3>
            <p>Quando habilitado, respostas longas da IA são automaticamente divididas em múltiplas mensagens menores para simular uma conversa natural. O comprimento máximo por mensagem é configurável.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Métricas por Agente</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Total de Execuções</strong> — Quantas vezes o agente respondeu</li>
              <li><strong>Tokens Utilizados</strong> — Consumo acumulado</li>
              <li><strong>Latência Média</strong> — Tempo médio de resposta em ms</li>
              <li><strong>Taxa de Sucesso</strong> — Percentual de respostas sem erro</li>
            </ul>
          </Section>

          {/* 10. SalesBots */}
          <Section title="10. SalesBots — Automações Visuais">
            <p>Builder visual para criar fluxos de automação comercial sem código. Funciona como um "mini n8n" focado em vendas.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Builder Visual</h3>
            <p>Interface drag-and-drop com canvas onde o usuário monta o fluxo conectando nós:</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Tipos de Nó</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Tipo</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Ação</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Enviar Mensagem</td><td className="border border-gray-300 px-3 py-2">Envia texto/mídia via WhatsApp</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Condição (If/Else)</td><td className="border border-gray-300 px-3 py-2">Ramifica o fluxo baseado em condição</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Mover Etapa</td><td className="border border-gray-300 px-3 py-2">Move o lead para outra etapa do funil</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Aplicar Tag</td><td className="border border-gray-300 px-3 py-2">Vincula uma tag ao lead</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Webhook n8n</td><td className="border border-gray-300 px-3 py-2">Dispara webhook para integração externa</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Triggers (Gatilhos)</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Mensagem Recebida</strong> — Bot executa quando lead envia mensagem</li>
              <li><strong>Mudança de Etapa</strong> — Bot executa quando lead é movido para uma etapa específica</li>
              <li>Vinculação direta entre <code>funnel_stages.bot_id</code> e o SalesBot</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Funcionalidades Extras</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Duplicação</strong> — Copiar um bot existente como base para novo</li>
              <li><strong>Ativar/Desativar</strong> — Toggle sem excluir o bot</li>
              <li><strong>Métricas</strong> — Contadores de execuções e conversões por bot</li>
              <li><strong>Logs</strong> — Registro detalhado de cada execução com status por nó (<code>bot_execution_logs</code>)</li>
            </ul>
          </Section>

          {/* 11. Contatos */}
          <Section title="11. Contatos">
            <p>Tabela centralizada de todos os contatos/leads do workspace com ferramentas de gestão em massa.</p>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
              <li><strong>Busca</strong> — Filtro por nome, telefone ou email</li>
              <li><strong>Importação em Massa</strong> — Upload de arquivo CSV/Excel com mapeamento de colunas</li>
              <li><strong>Exportação</strong> — Download da base de contatos</li>
              <li><strong>Seleção em Lote</strong> — Checkbox por linha + "selecionar todos"</li>
              <li><strong>Ações Rápidas</strong> — Menu dropdown por contato: enviar mensagem, ligar, enviar email</li>
              <li><strong>Tags</strong> — Exibição das tags vinculadas a cada contato</li>
              <li><strong>Fonte</strong> — Indicação da origem do contato</li>
            </ul>
          </Section>

          {/* 12. Campanhas */}
          <Section title="12. Campanhas">
            <p>Interface para gerenciamento de campanhas de disparo em massa via WhatsApp.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Status de Campanha</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Rascunho</td><td className="border border-gray-300 px-3 py-2">Campanha em criação</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Agendada</td><td className="border border-gray-300 px-3 py-2">Programada para disparo futuro</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Em Execução</td><td className="border border-gray-300 px-3 py-2">Disparo em andamento</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Concluída</td><td className="border border-gray-300 px-3 py-2">Todos os disparos realizados</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Pausada</td><td className="border border-gray-300 px-3 py-2">Execução interrompida temporariamente</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Métricas por Campanha</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Mensagens Enviadas / Entregues / Lidas / Respondidas</li>
              <li>Barra de progresso visual</li>
              <li>Taxas percentuais (entrega, leitura, resposta)</li>
              <li>Ações: Pausar, Retomar, Visualizar Relatório</li>
            </ul>
          </Section>

          {/* 13. Calendário */}
          <Section title="13. Calendário">
            <p>Calendário integrado com visualizações mensal, semanal e diária para gestão de compromissos comerciais.</p>

            <h3 className="text-lg font-semibold mt-6 mb-2">Tipos de Evento</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Chamada</strong> — Ligações agendadas</li>
              <li><strong>Reunião</strong> — Meetings presenciais ou online</li>
              <li><strong>Tarefa</strong> — To-dos e atividades</li>
              <li><strong>Lembrete</strong> — Alertas e lembretes</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-2">Interface</h3>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Grid mensal com indicadores visuais por dia</li>
              <li>Sidebar lateral com detalhes do dia selecionado</li>
              <li>Navegação entre meses com setas</li>
              <li>Botão "Novo Evento" para criação rápida</li>
            </ul>
          </Section>

          {/* 14. Estatísticas */}
          <Section title="14. Estatísticas">
            <p>Painel analítico avançado com métricas de vendas e performance comercial.</p>
            <ul className="list-disc list-inside ml-4 space-y-1 mt-2">
              <li><strong>KPIs de Vendas</strong> — Total vendido, ticket médio, taxa de conversão geral</li>
              <li><strong>Visualização de Funil</strong> — Gráfico do funil com contagem por etapa e taxas de conversão entre etapas</li>
              <li><strong>Evolução Mensal</strong> — Gráfico de barras com vendas por mês</li>
              <li><strong>Conversão por Fonte</strong> — Qual canal (WA/FB/IG) gera mais vendas</li>
              <li><strong>Performance da Equipe</strong> — Tabela comparativa de membros com métricas individuais</li>
            </ul>
          </Section>

          {/* 15. Integrações */}
          <Section title="15. Integrações">
            <table className="w-full border-collapse border border-gray-300 mt-4 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Integração</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Método</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Status</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">WhatsApp (QR Code)</td><td className="border border-gray-300 px-3 py-2">Evolution API — múltiplas instâncias</td><td className="border border-gray-300 px-3 py-2">✅ Ativo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">WhatsApp API Oficial</td><td className="border border-gray-300 px-3 py-2">Meta Cloud API</td><td className="border border-gray-300 px-3 py-2">✅ Ativo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Facebook Messenger</td><td className="border border-gray-300 px-3 py-2">Meta Graph API + OAuth + Webhooks</td><td className="border border-gray-300 px-3 py-2">✅ Ativo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Instagram Direct</td><td className="border border-gray-300 px-3 py-2">Meta Graph API + OAuth + Webhooks</td><td className="border border-gray-300 px-3 py-2">✅ Ativo</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">TikTok</td><td className="border border-gray-300 px-3 py-2">—</td><td className="border border-gray-300 px-3 py-2">🔜 Em breve</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Google Business</td><td className="border border-gray-300 px-3 py-2">—</td><td className="border border-gray-300 px-3 py-2">🔜 Em breve</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Zoom</td><td className="border border-gray-300 px-3 py-2">—</td><td className="border border-gray-300 px-3 py-2">🔜 Em breve</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Calendly</td><td className="border border-gray-300 px-3 py-2">—</td><td className="border border-gray-300 px-3 py-2">🔜 Em breve</td></tr>
              </tbody>
            </table>
          </Section>

          {/* 16. Configurações */}
          <Section title="16. Configurações">
            <p>Painel de configurações organizado em abas:</p>
            <table className="w-full border-collapse border border-gray-300 mt-4 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Aba</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Conteúdo</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Equipe</td><td className="border border-gray-300 px-3 py-2">Gerenciar membros, convidar, atribuir roles, reenviar convites</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Tags</td><td className="border border-gray-300 px-3 py-2">CRUD de tags com cores e contador de uso</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Automações</td><td className="border border-gray-300 px-3 py-2">Regras de tags automáticas por frase de campanha</td></tr>
              </tbody>
            </table>
            <p className="mt-4">Página adicional de Settings com abas extras: Integrações (Meta OAuth), WhatsApp (gerenciar conexões), Geral, Plano e Faturamento.</p>
          </Section>

          {/* 17. Equipe */}
          <Section title="17. Equipe — Sistema Multi-tenant">
            <h3 className="text-lg font-semibold mt-4 mb-2">Roles (Papéis)</h3>
            <table className="w-full border-collapse border border-gray-300 mt-2 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Role</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Permissões</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">Admin</td><td className="border border-gray-300 px-3 py-2">Acesso total: configurações, equipe, integrações, dados</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Manager</td><td className="border border-gray-300 px-3 py-2">Gestão de leads e equipe, sem configurações avançadas</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">Seller</td><td className="border border-gray-300 px-3 py-2">Operação: chat, leads próprios, visualização de dados</td></tr>
              </tbody>
            </table>

            <h3 className="text-lg font-semibold mt-6 mb-2">Fluxo de Convite</h3>
            <ol className="list-decimal list-inside ml-4 space-y-1">
              <li>Admin insere email e role do novo membro</li>
              <li>Edge Function <code>invite-member</code> envia email com link de cadastro</li>
              <li>Membro é listado como <strong>"Pendente"</strong> na tabela de equipe</li>
              <li>Ao fazer cadastro/login, <code>accept-invite</code> aceita automaticamente</li>
              <li>Status muda para <strong>"Ativo"</strong></li>
              <li>Admin pode <strong>reenviar convite</strong> caso necessário</li>
              <li>Admin pode <strong>remover membro</strong> do workspace</li>
            </ol>
          </Section>

          {/* 18. Backend */}
          <Section title="18. Funções de Backend (Edge Functions)">
            <p>O Argos X utiliza 11 Edge Functions serverless para processar lógica de negócio:</p>
            <table className="w-full border-collapse border border-gray-300 mt-4 text-sm">
              <thead><tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left">Função</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Trigger</th>
              </tr></thead>
              <tbody>
                <tr><td className="border border-gray-300 px-3 py-2">accept-invite</td><td className="border border-gray-300 px-3 py-2">Aceita convite pendente e vincula membro ao workspace</td><td className="border border-gray-300 px-3 py-2">Login do convidado</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">ai-agent-chat</td><td className="border border-gray-300 px-3 py-2">Processa mensagem com agente IA, gerencia memória e executa ferramentas</td><td className="border border-gray-300 px-3 py-2">Mensagem recebida</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">check-no-response</td><td className="border border-gray-300 px-3 py-2">Verifica chats sem resposta e envia alerta para equipe</td><td className="border border-gray-300 px-3 py-2">pg_cron (periódico)</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">create-workspace</td><td className="border border-gray-300 px-3 py-2">Cria novo workspace com funil padrão e etapas iniciais</td><td className="border border-gray-300 px-3 py-2">Onboarding</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">evolution-api</td><td className="border border-gray-300 px-3 py-2">Proxy para Evolution API (WhatsApp): criar instância, enviar mensagem, QR code</td><td className="border border-gray-300 px-3 py-2">Ação do usuário</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">facebook-oauth</td><td className="border border-gray-300 px-3 py-2">Gerencia fluxo OAuth para Facebook/Instagram</td><td className="border border-gray-300 px-3 py-2">Configurações</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">facebook-webhook</td><td className="border border-gray-300 px-3 py-2">Recebe e processa webhooks do Meta (FB + IG + WA Business)</td><td className="border border-gray-300 px-3 py-2">Webhook Meta</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">invite-member</td><td className="border border-gray-300 px-3 py-2">Envia email de convite para novo membro do workspace</td><td className="border border-gray-300 px-3 py-2">Admin action</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">meta-send-message</td><td className="border border-gray-300 px-3 py-2">Envia mensagens via Facebook/Instagram Graph API</td><td className="border border-gray-300 px-3 py-2">Chat / Follow-up</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">send-scheduled-messages</td><td className="border border-gray-300 px-3 py-2">Processa e envia mensagens agendadas pendentes</td><td className="border border-gray-300 px-3 py-2">pg_cron (1min)</td></tr>
                <tr><td className="border border-gray-300 px-3 py-2">weekly-report</td><td className="border border-gray-300 px-3 py-2">Gera e envia relatório semanal de performance</td><td className="border border-gray-300 px-3 py-2">pg_cron (semanal)</td></tr>
              </tbody>
            </table>
          </Section>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-300 text-center text-sm text-gray-400">
            <p>Argos X CRM — Documentação Técnica e Funcional</p>
            <p>© 2026 MKT Boost. Todos os direitos reservados.</p>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-12 section-block">
      <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-gray-300">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
