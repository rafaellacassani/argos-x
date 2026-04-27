import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { ExcessItem } from "@/hooks/usePlanExcess";

interface PlanExcessBannerProps {
  items: ExcessItem[];
  planName: string;
}

export function PlanExcessBanner({ items, planName }: PlanExcessBannerProps) {
  if (!items.length) return null;
  const summary = items
    .map((i) => `${i.label} ${i.current}/${i.limit}`)
    .join(" · ");

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-destructive font-medium min-w-0">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="truncate">
          Plano {planName} excedido: {summary}
        </span>
      </div>
      <Link
        to="/planos"
        className="text-xs font-semibold text-destructive underline hover:no-underline shrink-0"
      >
        Fazer upgrade
      </Link>
    </div>
  );
}