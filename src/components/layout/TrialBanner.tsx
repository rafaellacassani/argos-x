import { useState } from "react";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TrialBannerProps {
  daysRemaining: number;
}

const DISMISS_KEY = "trial_banner_dismissed_at";

export function TrialBanner({ daysRemaining }: TrialBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    return elapsed < 24 * 60 * 60 * 1000; // 24h
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleActivate = () => {
    navigate("/planos");
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <Clock className="w-4 h-4 shrink-0" />
        <span>
          ⏳ Seu trial encerra em <strong>{daysRemaining} dia{daysRemaining !== 1 ? "s" : ""}</strong>. 
          Ative seu plano para não perder o acesso.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="default"
          onClick={handleActivate}
          className="h-7 text-xs"
        >
          Ativar agora
        </Button>
        <button
          onClick={handleDismiss}
          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
