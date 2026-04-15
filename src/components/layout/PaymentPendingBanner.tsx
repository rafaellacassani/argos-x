import { useState, useEffect } from "react";
import { CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Shows a persistent banner when the workspace has no payment method (billingType UNDEFINED)
 * or subscription_status is "past_due" but workspace is still accessible.
 */
export function PaymentPendingBanner() {
  const { workspace } = useWorkspace();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Show banner for workspaces with subscription issues that are still active
  const subscriptionStatus = (workspace as any)?.subscription_status;
  const planType = workspace?.plan_type;
  const paymentProvider = (workspace as any)?.payment_provider;

  // Show for past_due that hasn't been blocked yet, or workspaces marked as needing payment update
  const showBanner =
    paymentProvider === "asaas" &&
    planType === "active" &&
    (subscriptionStatus === "past_due" || subscriptionStatus === "incomplete");

  if (!showBanner) return null;

  return (
    <div className="bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 py-3 flex items-center gap-3 text-sm">
      <CreditCard className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="flex-1">
        <strong>Pagamento pendente:</strong> Houve um problema com sua cobrança.
        Atualize seu método de pagamento para evitar a suspensão do acesso.
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 shrink-0"
        onClick={() => window.open("https://argosx.com.br/planos", "_blank")}
      >
        Atualizar pagamento
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-amber-500/20 shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
