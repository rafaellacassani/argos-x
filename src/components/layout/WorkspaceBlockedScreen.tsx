import { useState } from "react";
import { Lock, CreditCard, MessageCircle, Check, Zap, Crown, Rocket, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface WorkspaceBlockedScreenProps {
  reason: "blocked" | "canceled" | "past_due";
}

const plans = [
  {
    key: "essencial",
    name: "Essencial",
    price: 47.9,
    icon: Zap,
    features: [
      "1 conexão WhatsApp",
      "300 leads",
      "1 usuário",
      "Agente de IA (100 interações/mês)",
      "Funil básico",
    ],
    colors: {
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
  },
  {
    key: "negocio",
    name: "Negócio",
    price: 97.9,
    icon: Crown,
    popular: true,
    features: [
      "3 conexões WhatsApp",
      "2.000 leads",
      "1 usuário incluído",
      "3 Agentes de IA (500 interações/mês)",
      "Funis ilimitados + Campanhas",
    ],
    colors: {
      border: "border-blue-500/40",
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  },
  {
    key: "escala",
    name: "Escala",
    price: 197.9,
    icon: Rocket,
    features: [
      "Conexões ilimitadas",
      "Leads ilimitados",
      "3 usuários incluídos",
      "Agentes ilimitados (2.000 interações/mês)",
      "Tudo do Negócio + Suporte prioritário",
    ],
    colors: {
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      text: "text-purple-600 dark:text-purple-400",
      button: "bg-purple-600 hover:bg-purple-700 text-white",
    },
  },
];

export function WorkspaceBlockedScreen({ reason }: WorkspaceBlockedScreenProps) {
  const { workspaceId } = useWorkspace();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const isPastDue = reason === "past_due";

  const handleSubscribe = async (planKey: string) => {
    if (!workspaceId) return;
    setLoadingPlan(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          workspaceId,
          plan: planKey,
          successUrl: window.location.origin + "/dashboard?checkout=success",
          cancelUrl: window.location.origin + "/dashboard",
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Nenhuma URL de checkout retornada.");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({
        title: "Erro ao iniciar checkout",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            {isPastDue ? (
              <CreditCard className="w-8 h-8 text-destructive" />
            ) : (
              <Lock className="w-8 h-8 text-destructive" />
            )}
          </div>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-2xl font-bold text-center">
              {isPastDue ? "Pagamento pendente" : "Seu período de teste acabou"}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {isPastDue
                ? "Houve um problema com seu pagamento. Escolha um plano para continuar."
                : "Escolha um plano para desbloquear seu acesso ao Argos X."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Plans Grid */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isLoading = loadingPlan === plan.key;

              return (
                <div
                  key={plan.key}
                  className={`relative rounded-xl border-2 p-5 flex flex-col transition-all hover:shadow-lg ${
                    plan.popular
                      ? `${plan.colors.border} ${plan.colors.bg} shadow-md`
                      : "border-border bg-card"
                  }`}
                >
                  {plan.popular && (
                    <Badge className={`absolute -top-3 left-4 ${plan.colors.button}`}>
                      Mais popular
                    </Badge>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${plan.colors.bg} ${plan.colors.text}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-lg text-foreground">{plan.name}</h3>
                  </div>

                  <div className="mb-4">
                    <span className="text-2xl font-bold text-foreground">
                      R$ {plan.price.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.colors.text}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${plan.colors.button}`}
                    disabled={isLoading || !!loadingPlan}
                    onClick={() => handleSubscribe(plan.key)}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      "Assinar agora"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Support link */}
          <div className="mt-6 text-center">
            <Button variant="ghost" size="sm" asChild>
              <a
                href="https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20meu%20plano"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com suporte
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
