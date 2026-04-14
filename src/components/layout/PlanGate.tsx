import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface PlanGateProps {
  children: ReactNode;
  /** Plans that are blocked. If the current plan is in this list, content is hidden. */
  blockedPlans: string[];
  /** Feature name shown in the locked message */
  feature: string;
  /** Minimum plan name shown in the upgrade message */
  minPlan?: string;
}

export function PlanGate({ children, blockedPlans, feature, minPlan = "Negócio" }: PlanGateProps) {
  const { planName } = usePlanLimits();
  const navigate = useNavigate();

  if (blockedPlans.includes(planName)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Disponível a partir do plano {minPlan}
        </h2>
        <p className="text-sm text-center max-w-md">
          {feature} não está incluído no seu plano atual. Faça upgrade para desbloquear.
        </p>
        <Button onClick={() => navigate("/planos")} className="gap-2">
          <ArrowUpRight className="w-4 h-4" />
          Ver planos
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
