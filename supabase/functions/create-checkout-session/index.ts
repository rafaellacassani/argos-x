import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_PRICE_MAP: Record<string, string> = {
  essencial: "STRIPE_PRICE_ESSENCIAL",
  negocio: "STRIPE_PRICE_NEGOCIO",
  escala: "STRIPE_PRICE_ESCALA",
};

const PACK_PRICE_MAP: Record<number, string> = {
  1000: "STRIPE_PRICE_PACK_1000",
  5000: "STRIPE_PRICE_PACK_5000",
  20000: "STRIPE_PRICE_PACK_20000",
  50000: "STRIPE_PRICE_PACK_50000",
};

const PACK_PRICES: Record<number, number> = {
  1000: 17,
  5000: 47,
  20000: 97,
  50000: 197,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { workspaceId, plan, priceId: directPriceId, successUrl, cancelUrl, type, packSize } = body;

    if (!workspaceId || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: workspaceId, successUrl, cancelUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve priceId based on type
    let priceId = directPriceId;

    if (type === "lead_pack") {
      // Lead pack flow
      if (!packSize || !PACK_PRICE_MAP[packSize]) {
        return new Response(
          JSON.stringify({ error: `packSize inválido: "${packSize}". Use: 1000, 5000, 20000 ou 50000.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const envKey = PACK_PRICE_MAP[packSize];
      priceId = Deno.env.get(envKey);
      if (!priceId) {
        return new Response(
          JSON.stringify({ error: `Stripe Price ID não configurado para o pacote de ${packSize} leads. Configure o secret ${envKey}.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (!priceId && plan) {
      // Plan flow
      const envKey = PLAN_PRICE_MAP[plan];
      if (!envKey) {
        return new Response(
          JSON.stringify({ error: `Plano inválido: "${plan}". Use: essencial, negocio ou escala.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      priceId = Deno.env.get(envKey);
      if (!priceId) {
        return new Response(
          JSON.stringify({ error: `Stripe Price ID não configurado para o plano "${plan}". Configure o secret ${envKey}.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Informe 'plan', 'priceId' ou 'type: lead_pack' com 'packSize'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch workspace
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile for email
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("email, full_name")
      .eq("user_id", user.id)
      .single();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // Create or reuse Stripe customer
    let stripeCustomerId = workspace.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || undefined,
        name: profile?.full_name || workspace.name,
        metadata: { workspace_id: workspaceId },
      });
      stripeCustomerId = customer.id;

      await supabaseAdmin
        .from("workspaces")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", workspaceId);
    }

    // Build metadata for checkout session
    const sessionMetadata: Record<string, string> = { workspace_id: workspaceId };
    const subscriptionMetadata: Record<string, string> = { workspace_id: workspaceId };

    if (type === "lead_pack") {
      sessionMetadata.type = "lead_pack";
      sessionMetadata.pack_size = String(packSize);
      subscriptionMetadata.type = "lead_pack";
      subscriptionMetadata.pack_size = String(packSize);
    } else {
      subscriptionMetadata.plan = plan || "unknown";
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        metadata: subscriptionMetadata,
      },
      success_url: successUrl + (successUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl,
      metadata: sessionMetadata,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
