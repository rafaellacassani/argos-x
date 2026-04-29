import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

// Master workspaces — never eligible
const PROTECTED_WORKSPACES = new Set([
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X
  "6a8540c9-6eb5-42ce-8d20-960002d85bac", // ECX Company
]);

// Promo only valid on this single day (server-side check, America/Sao_Paulo)
const PROMO_DATE_BR = "2026-04-29";

const PROMO_VALUES: Record<string, number> = {
  essencial: 287.40,
  negocio: 587.40,
  escala: 1187.40,
};

const PLAN_LABELS: Record<string, string> = {
  essencial: "Essencial",
  negocio: "Negócio",
  escala: "Escala",
};

const PAID_PLANS = new Set(["essencial", "negocio", "escala"]);

function todayInSaoPaulo(): string {
  // Returns YYYY-MM-DD in America/Sao_Paulo timezone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

async function asaasRequest(path: string, init?: RequestInit) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data: json, raw: text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1) Auth — manual JWT (verify_jwt = false in config)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // 2) Body
    const { workspaceId, plan: requestedPlan } = await req.json().catch(() => ({}));
    if (!workspaceId || typeof workspaceId !== "string") {
      return new Response(JSON.stringify({ error: "Missing workspaceId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Server-side date guard
    const today = todayInSaoPaulo();
    if (today !== PROMO_DATE_BR) {
      return new Response(JSON.stringify({
        error: "Promoção encerrada",
        message: "Esta oferta era válida apenas em 29/04/2026.",
      }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4) Verify membership
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Eligibility
    if (PROTECTED_WORKSPACES.has(workspaceId)) {
      return new Response(JSON.stringify({ error: "Workspace não elegível para esta promoção" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, plan_name, blocked_at, annual_promo_expires_at, asaas_customer_id, asaas_subscription_id, payment_provider, created_by")
      .eq("id", workspaceId)
      .maybeSingle();

    if (wsErr || !ws) {
      return new Response(JSON.stringify({ error: "Workspace não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ws.blocked_at) {
      return new Response(JSON.stringify({ error: "Workspace bloqueado — não elegível" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ws.annual_promo_expires_at && new Date(ws.annual_promo_expires_at) > new Date()) {
      return new Response(JSON.stringify({
        error: "Já contratado",
        message: "Você já adquiriu o plano anual promocional.",
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Plan resolution:
    //  - If workspace already has a paid plan → lock to it (ignore client input)
    //  - Otherwise (trial / gratuito / null) → trust client choice from selector
    const currentPlan = (ws.plan_name || "").toLowerCase();
    const isPaidPlan = PAID_PLANS.has(currentPlan);
    const clientPlan = typeof requestedPlan === "string" ? requestedPlan.toLowerCase() : "";
    let planName = isPaidPlan ? currentPlan : clientPlan;
    if (!PAID_PLANS.has(planName)) {
      return new Response(JSON.stringify({ error: "Plano inválido. Escolha Essencial, Negócio ou Escala." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const value = PROMO_VALUES[planName];
    if (!value) {
      return new Response(JSON.stringify({ error: `Plano não suportado: ${planName}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) Get/create Asaas customer
    let asaasCustomerId = ws.asaas_customer_id as string | null;

    if (!asaasCustomerId) {
      // Try to find via user profile
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("email, full_name, phone")
        .eq("user_id", ws.created_by)
        .maybeSingle();

      const name = profile?.full_name || ws.name || "Cliente";
      const email = profile?.email;
      if (!email) {
        return new Response(JSON.stringify({ error: "Email do cliente não encontrado para criar cobrança." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createCust = await asaasRequest("/customers", {
        method: "POST",
        body: JSON.stringify({
          name, email,
          mobilePhone: profile?.phone || undefined,
        }),
      });
      if (!createCust.ok || !createCust.data?.id) {
        console.error("[annual-promo] Asaas customer create failed:", createCust.raw);
        return new Response(JSON.stringify({ error: "Falha ao criar cliente no provedor de pagamento" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      asaasCustomerId = createCust.data.id;
      await supabaseAdmin.from("workspaces")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("id", workspaceId);
    }

    // 7) Create one-off charge — encode plan in externalReference so the webhook
    // knows which plan to activate. Format: annual_promo_20260429_{plan}_{workspaceId}
    const externalReference = `annual_promo_20260429_${planName}_${workspaceId}`;
    const description = `Argos X - Plano Anual ${PLAN_LABELS[planName]} - Promo 50% OFF`;

    const dueDate = today; // 2026-04-29

    const charge = await asaasRequest("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED",
        value,
        dueDate,
        description,
        externalReference,
      }),
    });

    if (!charge.ok || !charge.data?.id) {
      console.error("[annual-promo] Asaas payment create failed:", charge.raw);
      return new Response(JSON.stringify({ error: "Falha ao criar cobrança", detail: charge.data }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoiceUrl = charge.data.invoiceUrl || charge.data.bankSlipUrl;

    return new Response(JSON.stringify({
      success: true,
      payment_id: charge.data.id,
      invoice_url: invoiceUrl,
      value,
      plan: planName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[annual-promo-checkout] error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});