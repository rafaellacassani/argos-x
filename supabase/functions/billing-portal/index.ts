import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "workspaceId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user belongs to workspace
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: member } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await adminClient
      .from("workspaces")
      .select(
        "payment_provider, asaas_customer_id, stripe_customer_id, asaas_subscription_id, stripe_subscription_id"
      )
      .eq("id", workspaceId)
      .single();

    if (!ws) {
      return new Response(
        JSON.stringify({ error: "Workspace not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let invoices: Array<{
      date: string;
      description: string;
      amount: number;
      status: string;
      invoiceUrl?: string;
    }> = [];

    if (ws.payment_provider === "asaas" && ws.asaas_customer_id) {
      const asaasKey = Deno.env.get("ASAAS_API_KEY");
      if (asaasKey) {
        try {
          const res = await fetch(
            `https://api.asaas.com/v3/payments?customer=${ws.asaas_customer_id}&limit=50&offset=0`,
            { headers: { access_token: asaasKey } }
          );
          if (res.ok) {
            const data = await res.json();
            invoices = (data.data || []).map((p: any) => ({
              date: p.paymentDate || p.dueDate || p.dateCreated,
              description: p.description || "Assinatura Argos X",
              amount: p.value || 0,
              status: mapAsaasStatus(p.status),
              invoiceUrl: p.invoiceUrl || p.bankSlipUrl || null,
            }));
          }
        } catch (e) {
          console.error("Asaas fetch error:", e);
        }
      }
    } else if (ws.stripe_customer_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const res = await fetch(
            `https://api.stripe.com/v1/invoices?customer=${ws.stripe_customer_id}&limit=50&status=paid`,
            {
              headers: {
                Authorization: `Bearer ${stripeKey}`,
              },
            }
          );
          if (res.ok) {
            const data = await res.json();
            invoices = (data.data || []).map((inv: any) => ({
              date: new Date(inv.created * 1000).toISOString(),
              description:
                inv.lines?.data?.[0]?.description || "Assinatura Argos X",
              amount: (inv.amount_paid || 0) / 100,
              status: mapStripeStatus(inv.status),
              invoiceUrl: inv.hosted_invoice_url || null,
            }));
          }

          // Also fetch open/draft invoices
          const resOpen = await fetch(
            `https://api.stripe.com/v1/invoices?customer=${ws.stripe_customer_id}&limit=10&status=open`,
            {
              headers: { Authorization: `Bearer ${stripeKey}` },
            }
          );
          if (resOpen.ok) {
            const dataOpen = await resOpen.json();
            const openInvoices = (dataOpen.data || []).map((inv: any) => ({
              date: new Date(inv.created * 1000).toISOString(),
              description:
                inv.lines?.data?.[0]?.description || "Assinatura Argos X",
              amount: (inv.amount_due || 0) / 100,
              status: mapStripeStatus(inv.status),
              invoiceUrl: inv.hosted_invoice_url || null,
            }));
            invoices = [...openInvoices, ...invoices];
          }
        } catch (e) {
          console.error("Stripe fetch error:", e);
        }
      }
    }

    // Sort by date descending
    invoices.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return new Response(
      JSON.stringify({
        invoices,
        provider: ws.payment_provider || "none",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("billing-portal error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function mapAsaasStatus(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: "pago",
    RECEIVED: "pago",
    RECEIVED_IN_CASH: "pago",
    PENDING: "pendente",
    AWAITING_RISK_ANALYSIS: "pendente",
    OVERDUE: "vencido",
    REFUNDED: "reembolsado",
    REFUND_REQUESTED: "reembolso solicitado",
    CHARGEBACK_REQUESTED: "contestado",
    CHARGEBACK_DISPUTE: "contestado",
    DUNNING_RECEIVED: "pago",
    DUNNING_REQUESTED: "pendente",
  };
  return map[status] || status?.toLowerCase() || "desconhecido";
}

function mapStripeStatus(status: string): string {
  const map: Record<string, string> = {
    paid: "pago",
    open: "pendente",
    draft: "rascunho",
    uncollectible: "falhou",
    void: "cancelado",
  };
  return map[status] || status || "desconhecido";
}
