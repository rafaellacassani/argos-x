import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, plan, successUrl, cancelUrl } = body;

    if (!email || !plan || !successUrl || !cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: email, plan, successUrl, cancelUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by email to get their workspace
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const user = allUsers?.users?.find((u: any) => u.email === email);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado. Faça o cadastro primeiro." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get workspace
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .limit(1)
      .single();

    if (!member) {
      return new Response(
        JSON.stringify({ error: "Workspace não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("id", member.workspace_id)
      .single();

    if (!workspace) {
      return new Response(
        JSON.stringify({ error: "Workspace não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve price ID
    const priceMap: Record<string, string | undefined> = {
      essencial: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
      negocio: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
      escala: Deno.env.get("STRIPE_PRICE_ESCALA"),
    };

    const priceId = priceMap[plan];
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Plano "${plan}" não configurado.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // Get or create Stripe customer
    let stripeCustomerId = workspace.stripe_customer_id;
    if (!stripeCustomerId) {
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .single();

      const customer = await stripe.customers.create({
        email: profile?.email || email,
        name: profile?.full_name || workspace.name,
        metadata: { workspace_id: workspace.id },
      });
      stripeCustomerId = customer.id;

      await supabaseAdmin
        .from("workspaces")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", workspace.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7,
        metadata: { workspace_id: workspace.id, plan },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspace_id: workspace.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("public-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
