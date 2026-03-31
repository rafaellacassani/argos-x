import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { FloatingNotifications } from "@/components/landing/FloatingNotifications";
import {
  MessageCircle,
  Zap,
  BarChart3,
  Shield,
  Users,
  Calendar,
  Bot,
  ArrowRight,
  Check,
  Star,
  Phone,
  Clock,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: MessageCircle,
    title: "WhatsApp Integrado",
    description:
      "Conecte WhatsApp Business API ou Evolution API e centralize todas as conversas em um único painel.",
  },
  {
    icon: Bot,
    title: "Agentes de IA 24/7",
    description:
      "Atendentes virtuais que qualificam leads, agendam reuniões e vendem — mesmo enquanto você dorme.",
  },
  {
    icon: Target,
    title: "Funil de Vendas Visual",
    description:
      "Kanban drag-and-drop com automações por etapa. Mova leads, dispare bots e aplique tags automaticamente.",
  },
  {
    icon: BarChart3,
    title: "Dashboard em Tempo Real",
    description:
      "Métricas de conversão, ranking da equipe, volume de mensagens e performance dos agentes de IA.",
  },
  {
    icon: Calendar,
    title: "Agenda Integrada",
    description:
      "Calendário sincronizado com Google Calendar. A IA agenda reuniões direto na sua agenda.",
  },
  {
    icon: Users,
    title: "Gestão de Equipe",
    description:
      "Atribua leads, controle permissões, monitore performance e distribua atendimentos automaticamente.",
  },
];

const benefits = [
  "Atendimento automático 24 horas via WhatsApp",
  "IA que qualifica, agenda e vende por você",
  "Funil de vendas visual com automações",
  "Campanhas em massa com personalização por IA",
  "Dashboard completo com métricas em tempo real",
  "Integração WhatsApp Cloud API + Evolution API",
  "Calendário com Google Calendar sync",
  "Sistema multi-equipe com permissões granulares",
];

const plans = [
  {
    name: "Essencial",
    price: "197",
    period: "/mês",
    description: "Para quem está começando a automatizar vendas",
    features: [
      "1 instância WhatsApp",
      "1 agente de IA",
      "500 leads ativos",
      "Funil de vendas",
      "Dashboard básico",
    ],
    cta: "Começar Agora",
    highlight: false,
  },
  {
    name: "Negócio",
    price: "297",
    period: "/mês",
    description: "Para empresas que precisam escalar",
    features: [
      "3 instâncias WhatsApp",
      "3 agentes de IA",
      "2.000 leads ativos",
      "Automações avançadas",
      "Campanhas em massa",
      "Calendário integrado",
    ],
    cta: "Escolher Negócio",
    highlight: true,
  },
  {
    name: "Escala",
    price: "497",
    period: "/mês",
    description: "Para operações de alta performance",
    features: [
      "Instâncias ilimitadas",
      "Agentes ilimitados",
      "10.000 leads ativos",
      "API completa",
      "Suporte prioritário",
      "White-label disponível",
    ],
    cta: "Falar com Consultor",
    highlight: false,
  },
];

const testimonials = [
  {
    name: "Ricardo M.",
    role: "CEO — Agência Digital",
    text: "O Argos X triplicou nossa taxa de resposta. Os agentes de IA atendem leads em segundos, mesmo de madrugada.",
  },
  {
    name: "Camila S.",
    role: "Gerente Comercial — E-commerce",
    text: "Antes perdia 60% dos leads. Com o funil automatizado e a IA, agora converto mais sem aumentar a equipe.",
  },
  {
    name: "André L.",
    role: "Founder — SaaS B2B",
    text: "O melhor CRM de WhatsApp que já usei. O dashboard me mostra tudo em tempo real e a IA realmente vende.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsLoggedIn(true);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>Argos X — CRM de Vendas com IA para WhatsApp</title>
        <meta
          name="description"
          content="CRM completo com agentes de IA que atendem, qualificam e vendem pelo WhatsApp 24/7. Funil visual, automações inteligentes e dashboard em tempo real."
        />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-[hsl(233,94%,98%)] via-white to-[hsl(207,98%,95%)]">
        {/* Nav */}
        <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-border/50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/src/assets/argos-icon.svg" alt="Argos X" className="h-8 w-8" />
              <span className="text-xl font-bold text-foreground">Argos X</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
              <a href="#testimonials" className="hover:text-foreground transition-colors">Depoimentos</a>
            </div>
            <div className="flex items-center gap-3">
              {isLoggedIn ? (
                <Button size="sm" asChild className="bg-secondary hover:bg-secondary/90">
                  <Link to="/dashboard">Ir para Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/auth">Entrar</Link>
                  </Button>
                  <Button size="sm" asChild className="bg-secondary hover:bg-secondary/90">
                    <Link to="/cadastro">Criar Conta Grátis</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="container mx-auto px-4 pt-20 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-block bg-gradient-to-r from-primary to-secondary text-white px-5 py-1.5 rounded-full text-sm font-semibold mb-8">
              🚀 CRM de Vendas com Inteligência Artificial
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Venda mais
              </span>{" "}
              <span className="text-foreground">com IA</span>
              <br />
              <span className="text-foreground">no </span>
              <span className="bg-gradient-to-r from-secondary to-[hsl(207,98%,50%)] bg-clip-text text-transparent">
                WhatsApp
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Agentes de IA que atendem, qualificam e vendem pelos seus canais — 24 horas por dia, 7 dias por
              semana. Sem perder nenhum lead.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="bg-secondary hover:bg-secondary/90 h-14 px-8 text-lg">
                <Link to="/cadastro">
                  Começar Agora — Grátis
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-14 px-8 text-lg border-secondary/30 text-secondary hover:bg-secondary/5"
              >
                <a
                  href="https://wa.me/5511921539991?text=Olá,%20quero%20saber%20mais%20sobre%20o%20Argos%20X!"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="mr-2 w-5 h-5" />
                  Falar com Consultor
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-16"
          >
            {[
              { value: "500+", label: "Empresas ativas" },
              { value: "2M+", label: "Mensagens/mês" },
              { value: "24/7", label: "IA funcionando" },
              { value: "3x", label: "Mais conversões" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-secondary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tudo que você precisa para vender mais
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Um CRM completo desenhado para equipes que vendem pelo WhatsApp.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-gradient-to-r from-primary to-secondary py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                  Por que o Argos X?
                </h2>
                <p className="text-white/80 text-lg mb-8">
                  Não é só um CRM. É um sistema de vendas inteligente que trabalha por você.
                </p>
                <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90 h-12">
                  <Link to="/cadastro">
                    Testar Agora
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <div className="space-y-3">
                {benefits.map((b) => (
                  <div key={b} className="flex items-start gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <Check className="w-5 h-5 text-white mt-0.5 shrink-0" />
                    <span className="text-white text-sm">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto px-4 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Planos que cabem no seu bolso
            </h2>
            <p className="text-muted-foreground text-lg">
              Comece grátis. Evolua quando quiser. Cancele quando precisar.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`rounded-2xl p-8 border-2 ${
                  plan.highlight
                    ? "border-secondary bg-secondary/5 shadow-xl relative"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-4 py-1 rounded-full">
                    MAIS POPULAR
                  </div>
                )}
                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-foreground">R$ {plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-secondary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full h-12 ${
                    plan.highlight
                      ? "bg-secondary hover:bg-secondary/90"
                      : "bg-primary hover:bg-primary/90"
                  }`}
                >
                  <Link to="/cadastro">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Quem usa, recomenda
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl p-6"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="container mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-primary to-secondary rounded-3xl p-12 md:p-16 max-w-4xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para vender mais com IA?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              Crie sua conta agora e comece a automatizar seu atendimento em minutos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="bg-white text-primary hover:bg-white/90 h-14 px-8 text-lg">
                <Link to="/cadastro">
                  Criar Minha Conta Grátis
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card py-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <img src="/src/assets/argos-icon.svg" alt="Argos X" className="h-6 w-6" />
                <span className="font-semibold text-foreground">Argos X</span>
                <span className="text-sm text-muted-foreground">by Mkt Boost</span>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
                  Política de Privacidade
                </Link>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  Termos de Serviço
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Argos X. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </footer>

        {/* WhatsApp float */}
        <a
          href="https://wa.me/5511921539991?text=Olá,%20quero%20saber%20mais%20sobre%20o%20Argos%20X!"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all group"
          aria-label="WhatsApp"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-foreground text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            Fale conosco!
          </span>
        </a>
      </div>
    </>
  );
}
