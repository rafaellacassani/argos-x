import { Lock, CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface WorkspaceBlockedScreenProps {
  reason: "blocked" | "canceled" | "past_due";
}

export function WorkspaceBlockedScreen({ reason }: WorkspaceBlockedScreenProps) {
  const navigate = useNavigate();
  const isPastDue = reason === "past_due";

  const handleActivatePlan = () => {
    navigate("/planos");
  };

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
            className="w-full"
            size="lg"
          >
            {isPastDue ? "Ver planos" : "Escolher plano"}
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
