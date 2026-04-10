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
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin of this workspace
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem cancelar" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws } = await supabase
      .from("workspaces")
      .select("stripe_customer_id, stripe_subscription_id, asaas_subscription_id, payment_provider")
      .eq("id", workspaceId)
      .single();

    if (!ws) {
      return new Response(JSON.stringify({ error: "Workspace não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let canceled = false;

    // Cancel Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey && (ws.stripe_subscription_id || ws.stripe_customer_id)) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      if (ws.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(ws.stripe_subscription_id);
          console.log("Stripe subscription canceled:", ws.stripe_subscription_id);
          canceled = true;
        } catch (e) {
          console.warn("Failed to cancel subscription:", e);
        }
      }

      // Also cancel any other active/past_due/trialing subscriptions for this customer
      if (ws.stripe_customer_id) {
        try {
          for (const status of ["active", "past_due", "trialing"] as const) {
            const subs = await stripe.subscriptions.list({
              customer: ws.stripe_customer_id,
              status,
              limit: 100,
            });
            for (const sub of subs.data) {
              await stripe.subscriptions.cancel(sub.id);
              console.log(`Canceled ${status} sub:`, sub.id);
              canceled = true;
            }
          }
        } catch (e) {
          console.warn("Failed to cancel customer subscriptions:", e);
        }
      }
    }

    // Cancel Asaas
    if (ws.asaas_subscription_id) {
      const asaasKey = Deno.env.get("ASAAS_API_KEY");
      if (asaasKey) {
        try {
          await fetch(`https://api.asaas.com/v3/subscriptions/${ws.asaas_subscription_id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", access_token: asaasKey },
          });
          console.log("Asaas subscription canceled:", ws.asaas_subscription_id);
          canceled = true;
        } catch (e) {
          console.warn("Failed to cancel Asaas subscription:", e);
        }
      }
    }

    // Update workspace — clear subscription IDs to prevent orphaned billing
    await supabase
      .from("workspaces")
      .update({
        plan_type: "canceled",
        subscription_status: "canceled",
        stripe_subscription_id: null,
        asaas_subscription_id: null,
      })
      .eq("id", workspaceId);

    return new Response(
      JSON.stringify({ success: true, canceled, message: "Assinatura cancelada com sucesso. Nenhuma nova cobrança será realizada." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cancel-subscription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
