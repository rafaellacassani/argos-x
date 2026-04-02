import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Crown, Zap, Rocket, ArrowDown, Calendar } from "lucide-react";
import { Workspace } from "@/hooks/useWorkspace";
import { PlanLimits, PLAN_DEFINITIONS } from "@/hooks/usePlanLimits";
import { differenceInDays, parseISO } from "date-fns";

interface ActivePlanCardProps {
  workspace: Workspace;
  planLimits: PlanLimits;
  onChangePlan: () => void;
}

const planIcons: Record<string, React.ReactNode> = {
  essencial: <Zap className="w-5 h-5" />,
  negocio: <Crown className="w-5 h-5" />,
  escala: <Rocket className="w-5 h-5" />,
  escala_semestral: <Rocket className="w-5 h-5" />,
  gratuito: <Zap className="w-5 h-5" />,
};

function getPlanStatusBadge(workspace: Workspace) {
  const planType = workspace.plan_type || workspace.subscription_status;

  if (planType === "trialing" || planType === "trial") {
    const trialEnd = workspace.trial_end ? parseISO(workspace.trial_end) : null;
    const daysLeft = trialEnd ? differenceInDays(trialEnd, new Date()) : 0;
    const label = daysLeft > 0 ? `Trial · ${daysLeft} dias restantes` : "Trial expirado";
    const variant = daysLeft > 0 ? "default" : "destructive";
    return <Badge variant={variant}>{label}</Badge>;
  }

  if (planType === "active") return <Badge className="bg-emerald-600 text-white">Ativo</Badge>;
  if (planType === "past_due") return <Badge variant="destructive">Pagamento pendente</Badge>;
  if (planType === "canceled") return <Badge variant="secondary">Cancelado</Badge>;

  return <Badge variant="outline">{planType || "—"}</Badge>;
}

export default function ActivePlanCard({ workspace, planLimits, onChangePlan }: ActivePlanCardProps) {
  const planKey = (workspace.plan_name || "essencial") as keyof typeof PLAN_DEFINITIONS;
  const planDef = PLAN_DEFINITIONS[planKey] || PLAN_DEFINITIONS.essencial;

  const usageBars = [
    {
      label: "Leads",
      current: planLimits.currentLeadCount,
      max: planLimits.totalLeadLimit,
      percent: planLimits.leadUsagePercent,
    },
    {
      label: "Interações IA",
      current: planLimits.aiInteractionsUsed,
      max: planLimits.aiInteractionsLimit,
      percent: planLimits.aiInteractionsLimit > 0
        ? Math.round((planLimits.aiInteractionsUsed / planLimits.aiInteractionsLimit) * 100)
        : 0,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {planIcons[planKey] || <Zap className="w-5 h-5" />}
            </div>
            <div>
              <CardTitle className="text-xl">{planDef.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{planDef.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getPlanStatusBadge(workspace)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {workspace.trial_end && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              Fim do trial:{" "}
              {new Date(workspace.trial_end).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {usageBars.map((bar) => (
            <div key={bar.label} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{bar.label}</span>
                <span className="font-medium text-foreground">
                  {bar.current.toLocaleString("pt-BR")} / {bar.max >= 999999 ? "∞" : bar.max.toLocaleString("pt-BR")}
                </span>
              </div>
              <Progress
                value={Math.min(bar.percent, 100)}
                className="h-2"
              />
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={onChangePlan} className="mt-2">
          <ArrowDown className="w-4 h-4 mr-1" /> Ver planos disponíveis
        </Button>
      </CardContent>
    </Card>
  );
}
