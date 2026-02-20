import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Rocket, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanLimits, PLAN_DEFINITIONS, LEAD_PACK_DEFINITIONS } from "@/hooks/usePlanLimits";
import { toast } from "@/hooks/use-toast";

const WHATSAPP_NUMBER = "5500000000000"; // configurar número real

const planIcons: Record<string, React.ReactNode> = {
  semente: <Zap className="w-6 h-6" />,
  negocio: <Crown className="w-6 h-6" />,
  escala: <Rocket className="w-6 h-6" />,
};

const planFeatures: Record<string, string[]> = {
  semente: [
    "1 conexão WhatsApp",
    "300 leads",
    "1 usuário",
    "Agente de IA (100 interações/mês)",
    "Funil básico",
  ],
  negocio: [
    "3 conexões WhatsApp",
    "2.000 leads",
    "1 usuário incluído",
    "3 Agentes de IA (500 interações/mês)",
    "Funis ilimitados + Campanhas",
  ],
  escala: [
    "Conexões ilimitadas",
    "Leads ilimitados",
    "3 usuários incluídos",
    "Agentes ilimitados (2.000 interações/mês)",
    "Tudo do Negócio + API access + Suporte prioritário",
  ],
};

const planColorClasses: Record<string, { border: string; bg: string; text: string; button: string }> = {
  semente: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  negocio: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  escala: {
    border: "border-purple-500/40",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    button: "bg-purple-600 hover:bg-purple-700 text-white",
  },
};

function showComingSoon() {
  toast({
    title: "Em breve!",
    description: "Entre em contato pelo WhatsApp para ativar.",
  });
}

export default function Planos() {
  const { planName, currentLeadCount, totalLeadLimit, leadUsagePercent } = usePlanLimits();

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Planos e Preços</h1>
        <p className="text-muted-foreground">
          Você está usando {currentLeadCount.toLocaleString("pt-BR")} de{" "}
          {totalLeadLimit.toLocaleString("pt-BR")} leads ({leadUsagePercent}%)
        </p>
      </div>

      {/* SECTION 1 — Plans */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Escolha seu plano</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(Object.entries(PLAN_DEFINITIONS) as [string, typeof PLAN_DEFINITIONS[keyof typeof PLAN_DEFINITIONS]][]).map(
            ([key, plan], index) => {
              const isCurrent = planName === key;
              const colors = planColorClasses[key];

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-xl border-2 p-6 flex flex-col ${
                    isCurrent ? `${colors.border} ${colors.bg}` : "border-border bg-card"
                  }`}
                >
                  {isCurrent && (
                    <Badge className={`absolute -top-3 left-4 ${colors.button}`}>
                      Plano atual
                    </Badge>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text}`}>
                      {planIcons[key]}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                    {"extraUserPrice" in plan && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + R$ {plan.extraUserPrice}/usuário adicional
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {planFeatures[key]?.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${colors.text}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={isCurrent ? "" : colors.button}
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent}
                    onClick={showComingSoon}
                  >
                    {isCurrent ? "Plano atual" : "Fazer upgrade"}
                  </Button>
                </motion.div>
              );
            }
          )}
        </div>
      </section>

      {/* SECTION 2 — Lead packs */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Precisa de mais leads? Adicione sem mudar de plano.
          </h2>
          <p className="text-sm text-muted-foreground">
            Os pacotes são cobrados mensalmente junto com seu plano.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LEAD_PACK_DEFINITIONS.map((pack, index) => (
            <motion.div
              key={pack.size}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.08 }}
              className="rounded-xl border border-border bg-card p-5 flex flex-col items-center text-center"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-lg">{pack.label}</h3>
              <p className="text-2xl font-bold text-foreground mt-1">
                R$ {pack.price}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <Button className="mt-4 w-full" variant="outline" onClick={showComingSoon}>
                Adicionar ao plano
              </Button>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
