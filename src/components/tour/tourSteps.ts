export interface TourStep {
  id: number;
  route: string;
  targetSelector: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

export const tourSteps: TourStep[] = [
  {
    id: 1,
    route: "/settings",
    targetSelector: "[data-tour='whatsapp-section']",
    title: "Conecte seu WhatsApp",
    description:
      "Aqui você conecta o WhatsApp da sua empresa. Sem essa conexão, nenhuma mensagem será recebida ou enviada. Você pode usar a conexão via QR Code ou a API Oficial do WhatsApp Business.",
    placement: "bottom",
  },
  {
    id: 2,
    route: "/configuracoes",
    targetSelector: "[data-tour='team-section']",
    title: "Monte sua equipe",
    description:
      "Adicione vendedores e gestores ao seu time. Cada pessoa terá acesso ao sistema e poderá atender leads, ver relatórios e receber alertas no WhatsApp pessoal.",
    placement: "bottom",
  },
  {
    id: 3,
    route: "/leads",
    targetSelector: "[data-tour='funnel-section']",
    title: "Organize o Funil de Vendas",
    description:
      "Este é o coração da sua operação. Todos os leads que te chamarem nos seus canais cairão automaticamente na primeira fase. Edite, adicione ou exclua fases do jeito que funcionar melhor para o seu negócio.",
    placement: "bottom",
  },
  {
    id: 4,
    route: "/chats",
    targetSelector: "[data-tour='chat-section']",
    title: "Converse com seus leads",
    description:
      "Aqui você conversa com todos os seus leads em um só lugar. Agende mensagens, controle orçamentos, registre vendas e mude a fase do lead pelo painel lateral — tudo sem sair da tela.",
    placement: "right",
  },
  {
    id: 5,
    route: "/ai-agents",
    targetSelector: "[data-tour='ai-agents-section']",
    title: "Monte sua Agente de IA",
    description:
      "Crie uma agente inteligente que atende seus leads 24 horas no WhatsApp. Configure a personalidade, base de conhecimento com seus produtos e preços, perguntas frequentes, regras de comportamento, qualificação automática de leads, ferramentas de ação e configurações avançadas. Cada detalhe faz a IA atender como se fosse alguém da sua equipe.",
    placement: "bottom",
  },
  {
    id: 6,
    route: "/contacts",
    targetSelector: "[data-tour='contacts-section']",
    title: "Todos os contatos organizados",
    description:
      "Aqui ficam todos os seus leads em uma lista centralizada. Pesquise por nome, telefone ou e-mail, filtre por tags e exporte quando precisar.",
    placement: "bottom",
  },
  {
    id: 7,
    route: "/calendar",
    targetSelector: "[data-tour='calendar-section']",
    title: "Agenda e compromissos",
    description:
      "Você ou sua agente de IA podem agendar e desmarcar compromissos. Configure lembretes automáticos para que seus clientes nunca esqueçam de uma reunião.",
    placement: "bottom",
  },
  {
    id: 8,
    route: "/email",
    targetSelector: "[data-tour='email-section']",
    title: "Sincronize seu e-mail",
    description:
      "Conecte sua caixa de e-mail para ler e responder mensagens sem sair do painel. Tudo centralizado em um só lugar.",
    placement: "bottom",
  },
  {
    id: 9,
    route: "/dashboard",
    targetSelector: "[data-tour='dashboard-section']",
    title: "Acompanhe suas métricas",
    description:
      "Veja em tempo real quantos leads entraram, quantas conversas estão ativas, taxa de conversão e muito mais. Filtre por período e por membro da equipe.",
    placement: "bottom",
  },
  {
    id: 10,
    route: "/statistics",
    targetSelector: "[data-tour='statistics-section']",
    title: "Analise o progresso dos leads",
    description:
      "Visualize como seus leads avançam pelo funil de vendas. Identifique gargalos e otimize cada etapa do seu processo comercial.",
    placement: "bottom",
  },
  {
    id: 11,
    route: "/configuracoes",
    targetSelector: "[data-tour='alerts-section']",
    title: "Alertas e relatórios automáticos",
    description:
      "Defina alertas para gestores e vendedores. Receba relatórios completos no seu WhatsApp periodicamente — sem precisar abrir a ferramenta para conferir como está a operação.",
    placement: "bottom",
  },
  {
    id: 12,
    route: "/salesbots",
    targetSelector: "[data-tour='salesbots-section']",
    title: "Crie sequências automáticas",
    description:
      "Monte fluxos inteligentes de mensagens. Por exemplo: quando um lead chega, o bot envia uma saudação, aguarda a resposta e encaminha para a etapa certa do funil — tudo sem precisar de um humano.",
    placement: "bottom",
  },
  {
    id: 13,
    route: "/campaigns",
    targetSelector: "[data-tour='campaigns-section']",
    title: "Dispare campanhas em massa",
    description:
      "Envie mensagens em massa para seus contatos no WhatsApp. Defina o conteúdo, data de início e fim, ajuste intervalos e horários de funcionamento, ou pause quando quiser.",
    placement: "bottom",
  },
];
