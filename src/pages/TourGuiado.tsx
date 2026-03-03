import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plug,
  Users,
  LayoutDashboard,
  MessageCircle,
  Bot,
  Contact,
  Calendar,
  Mail,
  BarChart3,
  TrendingUp,
  Bell,
  Workflow,
  Megaphone,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Circle,
  PartyPopper,
  Brain,
  BookOpen,
  HelpCircle,
  Settings2,
  Target,
  Wrench,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TourStep {
  number: number;
  title: string;
  icon: React.ElementType;
  route: string;
  description: string;
  details: string[];
  subSteps?: { icon: React.ElementType; title: string; description: string }[];
}

const tourSteps: TourStep[] = [
  {
    number: 1,
    title: "Conecte seu WhatsApp",
    icon: Plug,
    route: "/settings",
    description:
      "Tudo começa aqui. Sem conectar o WhatsApp da sua empresa, o sistema não consegue receber nem enviar mensagens. Você pode conectar pelo WhatsApp Business (Evolution API) ou pela API Oficial do Meta.",
    details: [
      "Escolha entre a conexão via QR Code (mais rápida para testar) ou a API Oficial (mais estável e profissional).",
      "Após conectar, todas as mensagens recebidas serão salvas automaticamente no sistema.",
      "Você pode conectar mais de um número conforme o seu plano.",
    ],
  },
  {
    number: 2,
    title: "Adicione sua equipe",
    icon: Users,
    route: "/configuracoes",
    description:
      "Convide vendedores e gestores para trabalharem com você. Cada pessoa terá seu próprio acesso com permissões adequadas ao seu papel.",
    details: [
      "Administradores podem ver tudo e configurar o sistema inteiro.",
      "Gestores acompanham a equipe e têm acesso a relatórios e automações.",
      "Vendedores focam nos seus próprios leads e conversas.",
      "Basta informar o e-mail do colaborador — ele recebe o convite automaticamente.",
    ],
  },
  {
    number: 3,
    title: "Organize o Funil de Vendas",
    icon: LayoutDashboard,
    route: "/leads",
    description:
      "O funil é o coração da sua operação. Todo lead que entrar em contato com você aparece automaticamente na primeira fase. A partir daí, você move ele pelas etapas do seu processo de vendas.",
    details: [
      "Personalize as fases do jeito que funcionar melhor para o seu negócio — adicione, renomeie, reordene ou exclua livremente.",
      "Defina quais fases representam 'venda ganha' e 'venda perdida' para as métricas funcionarem corretamente.",
      "Cada fase pode ter automações próprias: enviar mensagem, mover lead, notificar vendedor.",
      "Arraste e solte os leads entre as fases com um clique.",
    ],
  },
  {
    number: 4,
    title: "Converse nos Chats",
    icon: MessageCircle,
    route: "/chats",
    description:
      "Este é o seu painel principal do dia a dia. Aqui você conversa com seus leads em tempo real, sem precisar trocar de tela para nada.",
    details: [
      "Responda mensagens do WhatsApp, Instagram e Facebook — tudo em um só lugar.",
      "No painel lateral de cada conversa, você controla a fase do lead no funil, agenda mensagens, registra vendas e orçamentos.",
      "Agende mensagens para serem enviadas depois, no horário ideal.",
      "Use filtros para encontrar rapidamente qualquer conversa.",
    ],
  },
  {
    number: 5,
    title: "Monte sua Agente de IA",
    icon: Bot,
    route: "/ai-agents",
    description:
      "Aqui está o maior diferencial do sistema. Sua agente de IA atende leads no WhatsApp 24 horas por dia, como nenhuma outra ferramenta oferece. Configure cada detalhe para que ela represente sua empresa com perfeição.",
    details: [
      "A agente aprende sobre o seu negócio e responde de forma natural, como um vendedor humano.",
      "Ela pode qualificar leads, agendar compromissos, mover leads no funil e muito mais — tudo automaticamente.",
    ],
    subSteps: [
      {
        icon: Brain,
        title: "Personalidade",
        description:
          "Defina o nome da agente, o tom de voz (formal, descontraído, técnico), como ela se apresenta e o papel que ela assume na conversa. Isso garante que todas as respostas tenham a cara da sua marca.",
      },
      {
        icon: BookOpen,
        title: "Base de Conhecimento",
        description:
          "Ensine tudo sobre o seu negócio: produtos, serviços, preços, diferenciais, regras de atendimento. Quanto mais informação você fornecer, mais precisa e confiável será a resposta da agente. Você pode colar textos, adicionar links e até anexar documentos.",
      },
      {
        icon: HelpCircle,
        title: "Perguntas Frequentes (FAQ)",
        description:
          "Cadastre as perguntas que seus clientes fazem com mais frequência e as respostas ideais. Quando a agente identificar uma dessas perguntas, ela responde instantaneamente com a resposta que você definiu.",
      },
      {
        icon: Settings2,
        title: "Comportamento",
        description:
          "Configure para quais leads a agente deve responder, em quais fases do funil ela atua, qual instância do WhatsApp ela usa e quanto tempo espera antes de responder (para parecer mais natural).",
      },
      {
        icon: Target,
        title: "Qualificação",
        description:
          "Defina perguntas que a agente faz automaticamente para classificar cada lead. Por exemplo: orçamento disponível, prazo de decisão, tipo de serviço desejado. As respostas ficam salvas no perfil do lead.",
      },
      {
        icon: Wrench,
        title: "Ferramentas",
        description:
          "Ações que a agente executa automaticamente: mover o lead para outra fase do funil, agendar um follow-up, pausar o atendimento quando necessário. São os superpoderes da sua agente.",
      },
      {
        icon: SlidersHorizontal,
        title: "Avançado",
        description:
          "Controles técnicos: limite de mensagens, horário de funcionamento, modelo de IA utilizado, temperatura das respostas (mais criativa ou mais precisa) e configurações de divisão de mensagens longas.",
      },
    ],
  },
  {
    number: 6,
    title: "Contatos",
    icon: Contact,
    route: "/contacts",
    description:
      "Todos os seus leads ficam organizados em uma lista completa, fácil de buscar e filtrar. É o seu caderno de contatos inteligente.",
    details: [
      "Pesquise por nome, telefone, e-mail ou empresa.",
      "Filtre por etiquetas, fase do funil ou responsável.",
      "Importe contatos em massa via planilha.",
      "Exporte sua base quando precisar.",
    ],
  },
  {
    number: 7,
    title: "Calendário",
    icon: Calendar,
    route: "/calendar",
    description:
      "Você ou a sua agente de IA podem agendar compromissos diretamente no calendário. Sua IA também pode lembrar seus clientes sobre compromissos, tudo de forma automática.",
    details: [
      "Veja todos os agendamentos da equipe em uma única visualização.",
      "Sincronize com o Google Agenda para manter tudo atualizado.",
      "Vincule compromissos a leads específicos para ter contexto completo.",
      "Configure lembretes automáticos por WhatsApp para reduzir faltas.",
    ],
  },
  {
    number: 8,
    title: "E-mail",
    icon: Mail,
    route: "/email",
    description:
      "Sincronize sua caixa de e-mail para ler e responder e-mails sem sair do painel. Todas as comunicações em um só lugar.",
    details: [
      "Conecte sua conta Gmail com um clique.",
      "Leia, responda e organize e-mails diretamente aqui.",
      "Mantenha o histórico de comunicação com cada lead centralizado.",
    ],
  },
  {
    number: 9,
    title: "Dashboard",
    icon: BarChart3,
    route: "/dashboard",
    description:
      "Acompanhe todas as métricas do seu negócio em tempo real. Saiba exatamente o que está acontecendo na sua operação a qualquer momento.",
    details: [
      "Veja o número de leads novos, conversas ativas e vendas realizadas.",
      "Filtre por período, equipe ou vendedor específico.",
      "Acompanhe o desempenho da sua agente de IA.",
      "Identifique gargalos rapidamente com gráficos visuais.",
    ],
  },
  {
    number: 10,
    title: "Estatísticas",
    icon: TrendingUp,
    route: "/statistics",
    description:
      "Analise o progresso dos leads ao longo do seu funil de vendas. Entenda onde estão as oportunidades e onde estão os gargalos.",
    details: [
      "Veja quantos leads passaram por cada fase.",
      "Identifique em qual etapa você perde mais leads.",
      "Compare o desempenho entre períodos diferentes.",
      "Use os dados para tomar decisões estratégicas com confiança.",
    ],
  },
  {
    number: 11,
    title: "Alertas e Relatórios",
    icon: Bell,
    route: "/configuracoes",
    description:
      "Defina alertas para gestores e vendedores de acordo com a sua necessidade. E não se preocupe: você recebe relatórios completos no seu WhatsApp, sem precisar abrir a ferramenta.",
    details: [
      "Receba alertas quando um lead ficar sem resposta por muito tempo.",
      "Configure relatórios diários ou semanais automáticos.",
      "Escolha o horário e a frequência que preferir.",
      "Gestores podem receber resumos da equipe inteira periodicamente.",
    ],
  },
  {
    number: 12,
    title: "SalesBots",
    icon: Workflow,
    route: "/salesbots",
    description:
      "Crie sequências automáticas de mensagens e ações. Por exemplo: quando um lead chega, o bot envia uma saudação, espera a resposta e encaminha para a etapa certa do funil — tudo sem precisar de um humano.",
    details: [
      "Monte fluxos visuais arrastando e soltando blocos.",
      "Combine mensagens, esperas, condições e ações em um único fluxo.",
      "Ative o bot para disparar automaticamente quando um lead entrar em uma fase específica.",
      "Acompanhe quantas execuções e conversões cada bot gerou.",
    ],
  },
  {
    number: 13,
    title: "Campanhas",
    icon: Megaphone,
    route: "/campaigns",
    description:
      "Dispare campanhas em massa para seus contatos no WhatsApp. Defina o conteúdo, a data de início e término, e ajuste intervalos e horários de funcionamento.",
    details: [
      "Filtre os destinatários por etiquetas, fase do funil ou responsável.",
      "Defina o intervalo entre cada envio para evitar bloqueios.",
      "Programe horários específicos de funcionamento (ex: só em horário comercial).",
      "Pause e retome campanhas a qualquer momento.",
      "Acompanhe em tempo real quantas mensagens foram enviadas, entregues e falharam.",
    ],
  },
];

export default function TourGuiado() {
  const { workspace, refreshWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(workspace?.onboarding_step || 0);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspace?.onboarding_step !== undefined) {
      setCurrentStep(workspace.onboarding_step);
    }
  }, [workspace?.onboarding_step]);

  const progressPercent = Math.round((currentStep / tourSteps.length) * 100);

  const updateStep = async (step: number) => {
    if (!workspace) return;
    setSaving(true);
    try {
      await supabase
        .from("workspaces")
        .update({ onboarding_step: step })
        .eq("id", workspace.id);
      setCurrentStep(step);
      refreshWorkspace();
    } finally {
      setSaving(false);
    }
  };

  const completeOnboarding = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await supabase
        .from("workspaces")
        .update({ onboarding_completed: true, onboarding_step: tourSteps.length })
        .eq("id", workspace.id);
      refreshWorkspace();
      toast.success("Tour concluído! Bem-vindo ao Argos X 🚀");
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const resetOnboarding = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await supabase
        .from("workspaces")
        .update({ onboarding_completed: false, onboarding_step: 0 })
        .eq("id", workspace.id);
      setCurrentStep(0);
      refreshWorkspace();
      toast.success("Tour reiniciado!");
    } finally {
      setSaving(false);
    }
  };

  const goToStep = (stepNumber: number) => {
    setExpandedStep(expandedStep === stepNumber ? null : stepNumber);
  };

  const markAndAdvance = async (stepNumber: number) => {
    if (stepNumber > currentStep) {
      await updateStep(stepNumber);
    }
    // expand next step
    const nextIdx = tourSteps.findIndex((s) => s.number === stepNumber);
    if (nextIdx < tourSteps.length - 1) {
      setExpandedStep(tourSteps[nextIdx + 1].number);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-2 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              🗺️ Tour Guiado
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Conheça cada função do sistema, passo a passo. Sem pressa.
            </p>
          </div>
          {workspace?.onboarding_completed && (
            <Button variant="outline" size="sm" onClick={resetOnboarding} disabled={saving}>
              Reiniciar Tour
            </Button>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {currentStep} de {tourSteps.length} etapas concluídas
            </span>
            <span className="font-semibold text-primary">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>
      </div>

      {/* Completed banner */}
      {currentStep >= tourSteps.length && (
        <Card className="border-2 border-success/30 bg-success/5">
          <CardContent className="flex items-center gap-4 py-6">
            <PartyPopper className="w-10 h-10 text-success flex-shrink-0" />
            <div>
              <p className="font-semibold text-lg text-foreground">
                Parabéns! Você concluiu o tour completo! 🎉
              </p>
              <p className="text-muted-foreground">
                Agora você conhece todas as ferramentas. Explore à vontade!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps Timeline */}
      <div className="relative space-y-0">
        {/* Vertical line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

        {tourSteps.map((step, idx) => {
          const isCompleted = step.number <= currentStep;
          const isCurrent = step.number === currentStep + 1;
          const isExpanded = expandedStep === step.number;
          const StepIcon = step.icon;

          return (
            <div key={step.number} className="relative pl-20 pb-6">
              {/* Circle on timeline */}
              <div
                className={cn(
                  "absolute left-[18px] w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "bg-background border-primary text-primary ring-4 ring-primary/20"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{step.number}</span>
                )}
              </div>

              {/* Card */}
              <Card
                className={cn(
                  "transition-all cursor-pointer hover:shadow-md",
                  isCurrent && "border-primary/40 shadow-md ring-1 ring-primary/10",
                  isCompleted && "border-primary/20 bg-primary/[0.02]"
                )}
                onClick={() => goToStep(step.number)}
              >
                <CardContent className="p-5">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          isCompleted
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <StepIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground leading-tight">
                          {step.title}
                        </h3>
                        {!isExpanded && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                            {step.description.slice(0, 80)}...
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                          Concluída
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-5 space-y-4">
                      <p className="text-base text-foreground leading-relaxed">
                        {step.description}
                      </p>

                      <ul className="space-y-2">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Circle className="w-2 h-2 mt-2 flex-shrink-0 fill-current" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Sub-steps for AI Agent */}
                      {step.subSteps && (
                        <div className="mt-4 space-y-3">
                          <p className="font-semibold text-sm text-foreground uppercase tracking-wide">
                            O que você pode configurar:
                          </p>
                          <div className="grid gap-3">
                            {step.subSteps.map((sub, i) => {
                              const SubIcon = sub.icon;
                              return (
                                <div
                                  key={i}
                                  className="flex gap-3 p-4 rounded-xl bg-muted/50 border border-border/50"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <SubIcon className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm text-foreground">
                                      {sub.title}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                                      {sub.description}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(step.route, "_blank");
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ir para essa função
                        </Button>
                        {!isCompleted && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAndAdvance(step.number);
                            }}
                            disabled={saving}
                          >
                            Marcar como concluída
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Final CTA */}
      {currentStep >= tourSteps.length - 1 && !workspace?.onboarding_completed && (
        <div className="text-center py-6">
          <Button
            size="lg"
            onClick={completeOnboarding}
            disabled={saving}
            className="text-lg px-8 py-6"
          >
            <PartyPopper className="w-5 h-5 mr-2" />
            Concluir Tour e Começar a Usar
          </Button>
        </div>
      )}
    </div>
  );
}
