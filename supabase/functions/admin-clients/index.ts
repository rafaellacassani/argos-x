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

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // ──────────────────────────────────────
    // ACTION: LIST
    // ──────────────────────────────────────
    if (action === "list") {
      const { data: workspaces, error: wsError } = await supabaseAdmin
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (wsError) throw wsError;

      const ownerIds = [
        ...new Set((workspaces || []).map((w: any) => w.created_by)),
      ];
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, full_name, email, phone, personal_whatsapp")
        .in("user_id", ownerIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      const enriched = await Promise.all(
        (workspaces || []).map(async (ws: any) => {
          const [leadResult, memberResult, instanceResult] =
            await Promise.all([
              supabaseAdmin
                .from("leads")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id),
              supabaseAdmin
                .from("workspace_members")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id)
                .not("accepted_at", "is", null),
              supabaseAdmin
                .from("whatsapp_instances")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id),
            ]);

          return {
            ...ws,
            owner: profileMap.get(ws.created_by) || null,
            leads_count: leadResult.count || 0,
            members_count: memberResult.count || 0,
            instances_count: instanceResult.count || 0,
          };
        })
      );

      return new Response(JSON.stringify({ clients: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: CREATE-CHECKOUT
    // ──────────────────────────────────────
    if (action === "create-checkout") {
      const { plan, email, fullName, phone, successUrl, cancelUrl } = body;

      if (!plan || !email || !fullName) {
        return new Response(
          JSON.stringify({
            error: "Campos obrigatórios: plan, email, fullName",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2023-10-16",
      });

      const priceMap: Record<string, string | undefined> = {
        semente: Deno.env.get("STRIPE_PRICE_SEMENTE"),
        negocio: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
        escala: Deno.env.get("STRIPE_PRICE_ESCALA"),
      };

      const priceId = priceMap[plan];
      if (!priceId) {
        return new Response(
          JSON.stringify({
            error: `Stripe Price ID não configurado para o plano "${plan}". Configure o secret STRIPE_PRICE_${plan.toUpperCase()}.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: fullName,
        phone: phone || undefined,
        metadata: { plan, created_by_admin: user.id },
      });

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 7,
          metadata: { plan, admin_created: "true" },
        },
        success_url:
          successUrl || "https://argos-x.lovable.app/auth",
        cancel_url:
          cancelUrl || "https://argos-x.lovable.app/admin/clients",
      });

      return new Response(
        JSON.stringify({
          url: session.url,
          customerId: customer.id,
          sessionId: session.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ──────────────────────────────────────
    // ACTION: LINK-STRIPE
    // ──────────────────────────────────────
    if (action === "link-stripe") {
      const { workspaceId, stripeCustomerId } = body;
      if (!workspaceId || !stripeCustomerId) {
        return new Response(
          JSON.stringify({ error: "workspaceId and stripeCustomerId required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("workspaces")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", workspaceId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-clients error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
