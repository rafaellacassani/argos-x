import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExcessItem } from "@/hooks/usePlanExcess";
import { PLAN_DEFINITIONS } from "@/hooks/usePlanLimits";

interface PlanExcessBlockScreenProps {
  items: ExcessItem[];
  planName: string;
}

export function PlanExcessBlockScreen({ items, planName }: PlanExcessBlockScreenProps) {
  const planDef =
    PLAN_DEFINITIONS[(planName as keyof typeof PLAN_DEFINITIONS)] || PLAN_DEFINITIONS.essencial;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Acesso temporariamente bloqueado</h1>
          <p className="text-muted-foreground mt-2">
            Seu workspace está usando recursos acima do que o plano <Badge variant="outline">{planDef.name}</Badge> permite.
            Para continuar, ajuste o uso ou faça upgrade do plano.
          </p>
        </div>

        <div className="px-6 pb-2 space-y-3">
          {items.map((item) => (
            <div
              key={item.type}
              className="flex items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5"
            >
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.current} em uso · limite do plano: {item.limit} ·{" "}
                    <span className="text-destructive font-medium">
                      {item.excess} acima do permitido
                    </span>
                  </p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to={item.resolvePath}>
                  {item.resolveLabel}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="px-6 py-5 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Prefere manter tudo como está? Faça upgrade do plano e libere o acesso na hora.
          </div>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/planos">
              <Crown className="w-4 h-4 mr-2" />
              Ver planos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}