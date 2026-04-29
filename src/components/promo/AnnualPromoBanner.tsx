import { useEffect, useState } from "react";
import { Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPromoCountdown, pad } from "./promoConfig";

interface Props {
  onClick: () => void;
}

export function AnnualPromoBanner({ onClick }: Props) {
  const [c, setC] = useState(() => getPromoCountdown());
  useEffect(() => {
    const t = setInterval(() => setC(getPromoCountdown()), 1000);
    return () => clearInterval(t);
  }, []);

  if (c.expired) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-3 text-center sm:text-left">
        <Sparkles className="w-5 h-5 shrink-0 animate-pulse" />
        <p className="text-sm sm:text-base font-semibold leading-tight">
          🎉 OFERTA RELÂMPAGO! Pague seu plano anual com{" "}
          <span className="bg-white text-emerald-700 px-2 py-0.5 rounded font-bold">50% de desconto</span>.
          Economize agora!
        </p>
      </div>
      <div className="flex items-center gap-2 bg-black/20 rounded-md px-3 py-1.5 text-white font-mono text-sm shrink-0">
        <Clock className="w-4 h-4" />
        <span className="tabular-nums font-bold">
          {c.days > 0 && `${c.days}d `}{pad(c.hours)}:{pad(c.minutes)}:{pad(c.seconds)}
        </span>
      </div>
      <Button
        size="sm"
        onClick={onClick}
        className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold shrink-0 shadow-md"
      >
        QUERO 50% DE DESCONTO
      </Button>
    </div>
  );
}