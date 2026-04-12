import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Optional: dry_run mode (default true for safety)
    let dryRun = true;
    try {
      const body = await req.json();
      if (body.dry_run === false) dryRun = false;
    } catch {
      // no body = dry run
    }

    // Fetch all blocked/canceled workspaces with stripe_customer_id
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id, name, stripe_customer_id, plan_type, subscription_status")
      .in("plan_type", ["blocked", "canceled"])
      .not("stripe_customer_id", "is", null);

    if (wsError) {
      return new Response(JSON.stringify({ error: wsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: Array<{
      workspace_id: string;
      workspace_name: string;
      stripe_customer_id: string;
      subscriptions_found: number;
      subscriptions_canceled: string[];
      errors: string[];
    }> = [];

    let totalCanceled = 0;

    for (const ws of workspaces || []) {
      const entry = {
        workspace_id: ws.id,
        workspace_name: ws.name,
        stripe_customer_id: ws.stripe_customer_id,
        subscriptions_found: 0,
        subscriptions_canceled: [] as string[],
        errors: [] as string[],
      };

      try {
        // List ALL subscriptions for this customer (any status that could generate charges)
        for (const status of ["active", "past_due", "trialing"] as const) {
          const subs = await stripe.subscriptions.list({
            customer: ws.stripe_customer_id,
            status,
            limit: 100,
          });

          entry.subscriptions_found += subs.data.length;

          for (const sub of subs.data) {
            if (!dryRun) {
              try {
                await stripe.subscriptions.cancel(sub.id);
                entry.subscriptions_canceled.push(sub.id);
                totalCanceled++;
                console.log(`Canceled subscription ${sub.id} for workspace ${ws.name}`);
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                entry.errors.push(`Failed to cancel ${sub.id}: ${msg}`);
                console.warn(`Failed to cancel ${sub.id}:`, msg);
              }
            } else {
              entry.subscriptions_canceled.push(`[DRY_RUN] ${sub.id}`);
              totalCanceled++;
            }
          }
        }

        // Clear stripe_customer_id from workspace after successful cancellation
        if (!dryRun && entry.errors.length === 0) {
          await supabase
            .from("workspaces")
            .update({ stripe_customer_id: null, stripe_subscription_id: null })
            .eq("id", ws.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        entry.errors.push(`Customer-level error: ${msg}`);
        console.error(`Error processing workspace ${ws.name}:`, msg);
      }

      report.push(entry);
    }

    return new Response(
      JSON.stringify({
        dry_run: dryRun,
        workspaces_processed: report.length,
        total_subscriptions_canceled: totalCanceled,
        report,
        message: dryRun
          ? "MODO SIMULAÇÃO — nenhuma assinatura foi cancelada. Envie { dry_run: false } para executar de verdade."
          : `${totalCanceled} assinaturas canceladas com sucesso.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cleanup-orphan-subscriptions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
