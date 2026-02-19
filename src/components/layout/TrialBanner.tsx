import { useState } from "react";
import { X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface TrialBannerProps {
  daysRemaining: number;
}

const DISMISS_KEY = "trial_banner_dismissed_at";

export function TrialBanner({ daysRemaining }: TrialBannerProps) {
  const { workspaceId } = useWorkspace();
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (!dismissedAt) return false;
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    return elapsed < 24 * 60 * 60 * 1000; // 24h
  });
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleActivate = async () => {
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
      if (!error && data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error creating checkout:", err);
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className="h-7 text-xs"
        >
          {loading ? "..." : "Ativar agora"}
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
