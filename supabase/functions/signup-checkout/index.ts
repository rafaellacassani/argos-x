import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW = 10 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Internal CRM constants
const INTERNAL_WS = "41efdc6d-d4ba-4589-9761-7438a5911d57";
const STAGE_TRIAL = "fc4b4ff8-fbb8-40f3-ad51-9f6564b6ae3b";
const TAG_TRIAL = "a57de997-9b5c-467d-ad1e-8b50e0d07958";

const PLAN_PRICE_MAP: Record<string, string> = {
  essencial: "STRIPE_PRICE_ESSENCIAL",
  negocio: "STRIPE_PRICE_NEGOCIO",
  escala: "STRIPE_PRICE_ESCALA",
};

const PLAN_DISPLAY: Record<string, string> = {
  essencial: "Essencial",
  negocio: "Negócio",
  escala: "Escala",
};

async function createInternalLead(
  supabaseAdmin: any,
  contact: { name: string; email: string; phone: string }
) {
  try {
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("workspace_id", INTERNAL_WS)
      .or(`phone.eq.${contact.phone},email.eq.${contact.email}`)
      .limit(1)
      .maybeSingle();

    if (existing) return;

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .insert({
        workspace_id: INTERNAL_WS,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        stage_id: STAGE_TRIAL,
        source: "signup_checkout",
      })
      .select("id")
      .single();

    if (lead) {
      await supabaseAdmin.from("lead_tag_assignments").insert({
        workspace_id: INTERNAL_WS,
        lead_id: lead.id,
        tag_id: TAG_TRIAL,
      });
    }
  } catch (e) {
    console.warn("createInternalLead error:", e);
  }
}

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendMetaConversionEvent(
  supabaseAdmin: any,
  params: { email: string; phone: string; name: string; eventId: string; ip: string; userAgent: string }
) {
  try {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("meta_pixel_id, meta_conversions_token")
      .eq("id", INTERNAL_WS)
      .single();

    if (!ws?.meta_pixel_id || !ws?.meta_conversions_token) return;

    let cleanPhone = params.phone.replace(/\D/g, "");
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }

    const [emailHash, phoneHash] = await Promise.all([
      sha256(params.email),
      sha256(cleanPhone),
    ]);

    // Hash name parts for fn/ln
    const nameParts = (params.name || "").trim().toLowerCase().split(/\s+/);
    const fnHash = nameParts[0] ? await sha256(nameParts[0]) : null;
    const lnHash = nameParts.length > 1 ? await sha256(nameParts.slice(1).join(" ")) : null;

    const payload = {
      data: [{
        event_name: "InitiateCheckout",
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.eventId,
        event_source_url: "https://argosx.com.br/cadastro",
        action_source: "website",
        user_data: {
          em: [emailHash],
          ph: [phoneHash],
          ...(fnHash ? { fn: [fnHash] } : {}),
          ...(lnHash ? { ln: [lnHash] } : {}),
          client_ip_address: params.ip,
          client_user_agent: params.userAgent,
        },
        custom_data: { content_name: "Argos X Trial Checkout", currency: "BRL", value: 0 },
      }],
    };

    await fetch(
      `https://graph.facebook.com/v21.0/${ws.meta_pixel_id}/events?access_token=${ws.meta_conversions_token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
  } catch (e) {
    console.warn("Meta CAPI event failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { name, phone, email, companyName, password, plan, eventId, sourceUrl } = body;

    if (!name || !phone || !email || !companyName || !password || !plan) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve Stripe Price ID
    const envKey = PLAN_PRICE_MAP[plan];
    if (!envKey) {
      return new Response(
        JSON.stringify({ error: `Plano inválido: "${plan}".` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const priceId = Deno.env.get(envKey);
    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Stripe Price ID não configurado para o plano "${plan}".` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if email already has a workspace
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    if (existingUser) {
      const { data: existingMember } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("user_id", existingUser.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Este email já possui uma conta. Faça login em /auth." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Create or update user
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = newUser.user.id;
    }

    // 2. Upsert user_profiles
    const cleanPhone = phone.replace(/\D/g, "");
    await supabaseAdmin.from("user_profiles").upsert(
      { user_id: userId, full_name: name, email, phone: cleanPhone || null },
      { onConflict: "user_id" }
    );

    // 3. Create Stripe customer
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

    const customer = await stripe.customers.create({
      email,
      name,
      phone: cleanPhone || undefined,
      metadata: { user_id: userId, company_name: companyName, plan },
    });

    // 4. Save client_invite record with consent data
    await supabaseAdmin.from("client_invites").insert({
      email,
      full_name: name,
      phone: cleanPhone || null,
      plan,
      invite_type: "signup_checkout",
      status: "pending_payment",
      created_by: userId,
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_ip: ip,
      terms_accepted_user_agent: userAgent,
      terms_version: "v1.0-2026-03-28",
    });

    // 5. Store signup data in customer metadata so webhook can use it
    await stripe.customers.update(customer.id, {
      metadata: {
        user_id: userId,
        company_name: companyName,
        plan,
        signup_phone: cleanPhone,
      },
    });

    // 6. Create Stripe Checkout Session with 7-day trial
    const successUrl = `https://argosx.com.br/cadastro/sucesso?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(cleanPhone)}&name=${encodeURIComponent(name)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `https://argosx.com.br/cadastro?plan=${plan}`;

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7,
        metadata: { workspace_id: "pending", plan, user_id: userId, company_name: companyName },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { plan, user_id: userId, company_name: companyName, signup_phone: cleanPhone },
    });

    // 7. Fire-and-forget: internal CRM lead + Meta CAPI
    createInternalLead(supabaseAdmin, { name, email, phone: cleanPhone }).catch(console.warn);
    if (eventId) {
      sendMetaConversionEvent(supabaseAdmin, { email, phone: cleanPhone, name, eventId, ip, userAgent }).catch(console.warn);
    }

    // 8. Save attribution data
    const attribution = body.attribution;
    if (attribution && typeof attribution === 'object' && Object.keys(attribution).length > 0) {
      const allowedKeys = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      const safeAttribution: Record<string, string> = {};
      for (const key of allowedKeys) {
        if (attribution[key] && typeof attribution[key] === 'string') {
          safeAttribution[key] = attribution[key].substring(0, 500);
        }
      }
      if (Object.keys(safeAttribution).length > 0) {
        await supabaseAdmin.from("lead_attribution").insert({
          ...safeAttribution,
          workspace_id: INTERNAL_WS,
        }).catch(console.warn);
      }
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("signup-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
