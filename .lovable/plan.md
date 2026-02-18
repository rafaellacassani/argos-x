

# Pagina de Documentacao Completa do Projeto Inboxia (Exportavel em PDF)

## Objetivo
Criar uma pagina dedicada `/project-docs` que apresente uma documentacao completa e detalhada de todas as areas, funcionalidades e diferenciais do Inboxia CRM, com um botao para exportar em PDF. A pagina sera acessivel apenas pela administradora.

## Estrutura da Pagina

A documentacao sera organizada em secoes com texto limpo, formatacao de facil leitura (titulos, subtitulos, listas, tabelas), otimizada para impressao/PDF.

### Secoes do Documento

1. **Visao Geral do Inboxia** - Descricao do produto, arquitetura multi-tenant SaaS, sistema de workspaces isolados

2. **Autenticacao e Onboarding** - Fluxo de cadastro, login, reset de senha, criacao de workspace, convites de equipe com aceitacao automatica

3. **Dashboard** - KPIs em tempo real (mensagens, conversas ativas, chats sem resposta), graficos de evolucao, fontes de leads (pizza), leads recentes, metricas de performance, filtro por periodo

4. **Funil de Vendas (Leads)** - Kanban drag-and-drop, multiplos funis, etapas customizaveis com cores, cards detalhados com: dados de contato, tags, vendas/produtos, historico de movimentacoes, responsavel, notas, abrir chat direto do card, mover entre etapas, estatisticas por etapa (contagem + valor total)

5. **Chats Unificados** - Inbox unificado WhatsApp + Facebook + Instagram, multiplas instancias WhatsApp simultaneas, envio de texto/imagem/video/documento/audio, download de midia, visualizacao "Todas as instancias" consolidada, badges de fonte (WA/FB/IG), filtros avancados (periodo, etapa do funil, tags, fonte, responsavel, status de resposta, ultimo remetente), criacao automatica de leads ao receber mensagem

6. **Agendamento de Mensagens (Follow-up)** - Agendar envio futuro para WhatsApp/Facebook/Instagram, selecao de data e hora via calendario, roteamento automatico para o canal correto, processamento automatico via Edge Function a cada minuto (pg_cron), tabela com status (pendente/enviado/falhou)

7. **Tags Automaticas por Campanha** - Sistema de regras "se a primeira mensagem contem X, aplica tag Y", cruzamento com campanhas do Meta para identificar QUAL campanha esta gerando conversao, criacao de tags personalizadas com cores, aplicacao automatica na entrada de novos leads, gestao completa no painel de configuracoes

8. **Gestao de Tags Manual** - CRUD completo de tags, cores personalizaveis, contador de uso por tag, aplicacao/remocao em leads e chats

9. **Agentes de IA** - Templates pre-configurados (SDR, Agendamento, Follow-up, Cobranca, Custom), selecao de modelo (Gemini 3 Flash, Gemini 2.5, GPT-5, etc.), prompt de sistema personalizavel, controle de temperatura (criatividade), ferramentas habilitaveis (atualizar lead, aplicar tag, mover etapa, pausar IA), codigo de pausa e retomada humana, divisao automatica de mensagens longas, metricas por agente (execucoes, tokens, latencia)

10. **SalesBots (Automacoes Visuais)** - Builder visual drag-and-drop, tipos de no: enviar mensagem, condicao (if/else), mover etapa, aplicar tag, webhook n8n, triggers configuraveis (mensagem recebida, mudanca de etapa, etc.), duplicacao de bots, metricas de execucao e conversao, ativacao/desativacao

11. **Contatos** - Tabela completa com busca, importacao em massa, exportacao, selecao em lote, acoes rapidas (enviar mensagem, ligar, email), tags por contato, fonte de origem

12. **Campanhas** - Interface para campanhas WhatsApp em massa, status (rascunho, agendada, em execucao, concluida, pausada), metricas (enviadas, entregues, lidas, respondidas), barra de progresso, acoes de pausar/retomar

13. **Calendario** - Visualizacao mensal/semanal/diaria, eventos com tipos (chamada, reuniao, tarefa, lembrete), sidebar de detalhes por dia

14. **Estatisticas** - KPIs de vendas, visualizacao de funil com taxas de conversao, grafico de evolucao mensal, conversao por fonte, tabela de performance da equipe

15. **Integracoes** - WhatsApp Business (QR Code via Evolution API), WhatsApp API oficial, Instagram (OAuth Meta), Facebook Messenger (OAuth Meta), TikTok/Google Business/Zoom/Calendly (em breve)

16. **Configuracoes** - Aba Integracoes, aba WhatsApp (gerenciar conexoes), aba Tags Automaticas, aba Geral, aba Equipe (convites, reenvio, roles admin/seller/viewer), aba Plano e Faturamento

17. **Equipe (Multi-tenant)** - Convite por email, roles (admin, seller, viewer), indicador de status (pendente/ativo), reenvio de convite, remocao de membro

18. **Funcoes de Backend** - Edge Functions: accept-invite, check-no-response, create-workspace, evolution-api, facebook-oauth, facebook-webhook, invite-member, meta-send-message, send-scheduled-messages, weekly-report, ai-agent-chat

## Implementacao Tecnica

### Arquivo a criar
- `src/pages/ProjectDocs.tsx` - Pagina completa com toda a documentacao e botao de exportar PDF

### Arquivo a editar
- `src/App.tsx` - Adicionar rota `/project-docs` protegida com verificacao de email admin

### Botao de Exportar PDF
Usaremos `window.print()` com CSS `@media print` otimizado para gerar PDF limpo pelo navegador (sem dependencias externas). A pagina tera:
- Estilos de impressao que removem headers/navegacao
- Tipografia otimizada para leitura
- Quebras de pagina entre secoes
- Botao "Exportar PDF" fixo no topo que chama `window.print()`

### Restricao de Acesso
Mesma logica do AdminMindMap: verifica `user.email === "rafaellacassani@gmail.com"`, caso contrario redireciona para `/`.

