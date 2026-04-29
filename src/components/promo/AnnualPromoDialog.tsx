import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  planName: string | null | undefined;
}

const PLAN_LABELS: Record<string, string> = {
  essencial: "Essencial",
  negocio: "Negócio",
  escala: "Escala",
};

const PROMO_VALUES: Record<string, { full: number; promo: number }> = {
  essencial: { full: 574.80, promo: 287.40 },
  negocio: { full: 1174.80, promo: 587.40 },
  escala: { full: 2374.80, promo: 1187.40 },
};

export function AnnualPromoDialog({ open, onOpenChange, workspaceId, planName }: Props) {
  const [loading, setLoading] = useState(false);
  const plan = (planName || "essencial").toLowerCase();
  const label = PLAN_LABELS[plan] || "Essencial";
  const values = PROMO_VALUES[plan] || PROMO_VALUES.essencial;

  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("annual-promo-checkout", {
        body: { workspaceId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      if (data?.invoice_url) {
        window.location.href = data.invoice_url;
        return;
      }
      throw new Error("Não foi possível gerar o link de pagamento.");
    } catch (err: any) {
      console.error("[AnnualPromoDialog] checkout error:", err);
      toast({
        title: "Erro ao gerar pagamento",
        description: err.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-emerald-500/40">
        <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-emerald-700 text-white p-6 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-2 animate-pulse" />
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              🎉 OFERTA RELÂMPAGO — SÓ HOJE!
            </DialogTitle>
            <DialogDescription className="text-emerald-50 text-base mt-2">
              Pague seu plano anual com <strong className="text-white">50% de desconto</strong>. Válido apenas em 29/04/2026.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Seu plano: {label} (anual)
            </p>
            <div className="mt-1 flex items-baseline justify-center gap-2">
              <span className="text-sm line-through text-muted-foreground">{fmt(values.full)}</span>
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {fmt(values.promo)}
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
              Você economiza {fmt(values.full - values.promo)} no ano
            </p>
          </div>

          <ul className="space-y-2 text-sm text-foreground">
            {[
              "12 meses de plano garantidos",
              "Pagamento único: PIX, boleto ou cartão",
              "Sua mensalidade atual é cancelada automaticamente",
              "Acesso liberado assim que o pagamento for confirmado",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-base"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando link...</>
              ) : (
                "GARANTIR MEU DESCONTO"
              )}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Agora não
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}