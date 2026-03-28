import { useState } from "react";
import { X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { DisconnectedInstance } from "@/hooks/useInstanceHealth";

interface Props {
  instances: DisconnectedInstance[];
}

const DISMISS_KEY = "instance_banner_dismissed_at";
const DISMISS_DURATION = 30 * 60 * 1000; // 30 min

export function DisconnectedInstanceBanner({ instances }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    const at = localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - parseInt(at, 10) < DISMISS_DURATION;
  });

  if (dismissed || instances.length === 0) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const label =
    instances.length === 1
      ? `WhatsApp desconectado: ${instances[0].displayName}`
      : `${instances.length} instâncias WhatsApp desconectadas`;

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-destructive">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>
          ⚠️ {label}. Reconecte para não perder mensagens.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => navigate("/settings")}
          className="h-7 text-xs"
        >
          Reconectar
        </Button>
        <button
          onClick={handleDismiss}
          className="text-destructive/70 hover:text-destructive"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
