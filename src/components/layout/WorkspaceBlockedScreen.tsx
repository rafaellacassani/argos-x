import { Lock, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useState } from "react";

interface WorkspaceBlockedScreenProps {
  reason: "blocked" | "canceled" | "past_due";
}

export function WorkspaceBlockedScreen({ reason }: WorkspaceBlockedScreenProps) {
  const { workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(false);

  const handleActivatePlan = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          workspaceId,
          priceId: import.meta.env.VITE_STRIPE_PRICE_ID || "",
          successUrl: window.location.origin + "/dashboard",
          cancelUrl: window.location.origin + "/dashboard",
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
    } finally {
      setLoading(false);
    }
  };

  const isPastDue = reason === "past_due";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          {isPastDue ? (
            <CreditCard className="w-10 h-10 text-destructive" />
          ) : (
            <Lock className="w-10 h-10 text-destructive" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {isPastDue ? "Pagamento pendente" : "Seu acesso foi suspenso"}
          </h1>
          <p className="text-muted-foreground">
            {isPastDue
              ? "Houve um problema com seu pagamento. Atualize seu cartão para continuar."
              : "Seu período de trial encerrou. Ative seu plano para continuar."}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleActivatePlan}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading
              ? "Redirecionando..."
              : isPastDue
              ? "Atualizar pagamento"
              : "Ativar plano"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            size="lg"
            asChild
          >
            <a
              href="https://wa.me/5511999999999?text=Preciso%20de%20ajuda%20com%20meu%20plano"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Falar com suporte
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
