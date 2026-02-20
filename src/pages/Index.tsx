import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Play,
  BookOpen,
  Calendar,
  Headphones,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const quickActions = [
  {
    icon: Play,
    title: "Tutorial Rápido",
    description: "Aprenda os conceitos básicos em 5 minutos",
    color: "from-secondary to-secondary/70",
  },
  {
    icon: BookOpen,
    title: "Documentação",
    description: "Guias completos e referências",
    color: "from-success to-success/70",
  },
  {
    icon: Calendar,
    title: "Agendar Demo",
    description: "Fale com nosso time comercial",
    color: "from-warning to-warning/70",
  },
  {
    icon: Headphones,
    title: "Suporte",
    description: "Central de ajuda e tickets",
    color: "from-primary to-primary/70",
  },
];

const features = [
  {
    icon: MessageCircle,
    title: "WhatsApp Integrado",
    description: "Conecte seu WhatsApp Business ou API e centralize todas as conversas.",
  },
  {
    icon: Zap,
    title: "Automação Inteligente",
    description: "Agentes de IA que qualificam e atendem leads 24/7.",
  },
  {
    icon: BarChart3,
    title: "Análises em Tempo Real",
    description: "Dashboards com métricas importantes para seu negócio.",
  },
  {
    icon: Shield,
    title: "Seguro e Confiável",
    description: "Seus dados protegidos com criptografia de ponta.",
  },
];

export default function Index() {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl inboxia-gradient-bg p-8 text-primary-foreground"
      >
        <div className="relative z-10">
          <h1 className="font-display text-3xl font-bold mb-2">
            Bem-vindo ao Argos X! 👋
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-2xl">
            Seu CRM completo para WhatsApp. Gerencie leads, automatize atendimentos
            e aumente suas vendas em um só lugar.
          </p>
          <div className="flex gap-3 mt-6">
            <Button
              asChild
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              <Link to="/dashboard">
                Ir para Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              Assistir Tutorial
            </Button>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
      </motion.div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="inboxia-card p-5 cursor-pointer group"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-4">
          O que você pode fazer
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
              className="inboxia-card p-5 flex gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Getting Started Checklist */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="inboxia-card p-6"
      >
        <h2 className="font-display text-xl font-semibold mb-4">
          Primeiros Passos
        </h2>
        <div className="space-y-3">
          {[
            { label: "Conecte seu WhatsApp Business", done: false },
            { label: "Configure suas etapas do funil", done: false },
            { label: "Crie seu primeiro agente de IA", done: false },
            { label: "Importe seus contatos", done: false },
          ].map((step, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  step.done
                    ? "bg-success border-success"
                    : "border-muted-foreground/30"
                }`}
              >
                {step.done && (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <span className={step.done ? "text-muted-foreground line-through" : "text-foreground"}>
                {step.label}
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
