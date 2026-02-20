import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";

const DISMISS_KEY = "lead_limit_banner_dismissed_at";

export function LeadLimitBanner() {
  const { isNearLeadLimit, isAtLeadLimit, currentLeadCount, totalLeadLimit, leadUsagePercent } = usePlanLimits();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    return Date.now() - parseInt(dismissedAt, 10) < 24 * 60 * 60 * 1000;
  });

  if (!isNearLeadLimit) return null;
  if (dismissed && !isAtLeadLimit) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const atLimit = isAtLeadLimit;

  return (
    <div className={`${atLimit ? "bg-destructive/10 border-destructive/20" : "bg-amber-500/10 border-amber-500/20"} border-b px-4 py-2.5 flex items-center justify-between gap-3`}>
      <div className={`flex items-center gap-2 text-sm ${atLimit ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          {atLimit
            ? "Limite de leads atingido. Você não pode adicionar novos leads."
            : `Você usou ${currentLeadCount.toLocaleString("pt-BR")} de ${totalLeadLimit.toLocaleString("pt-BR")} leads (${leadUsagePercent}%). Adicione mais leads para continuar crescendo.`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant={atLimit ? "destructive" : "default"}
          onClick={() => navigate("/planos")}
          className="h-7 text-xs"
        >
          {atLimit ? "Adicionar leads agora" : "Ver pacotes de leads"}
        </Button>
        {!atLimit && (
          <button
            onClick={handleDismiss}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
