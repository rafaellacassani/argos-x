import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const ASAAS_BASE = "https://api.asaas.com/v3";

const PLAN_VALUES: Record<string, { value: number; display: string }> = {
  essencial: { value: 47.90, display: "Essencial" },
  negocio: { value: 97.90, display: "Negócio" },
  escala: { value: 197.90, display: "Escala" },
};

async function asaasFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Asaas API error:", JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || `Asaas error: ${res.status}`);
  }
  return data;
}

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
        source: "asaas_checkout",
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
        custom_data: { content_name: "Argos X Trial Checkout (Asaas)", currency: "BRL", value: 0 },
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
    const { name, phone, email, companyName, password, plan, cpfCnpj, eventId, sourceUrl } = body;

    if (!name || !phone || !email || !companyName || !password || !plan || !cpfCnpj) {
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

    // Validate CPF/CNPJ (basic: 11 or 14 digits)
    const cpfCnpjClean = cpfCnpj.replace(/\D/g, "");
    if (cpfCnpjClean.length !== 11 && cpfCnpjClean.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CPF ou CNPJ inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planInfo = PLAN_VALUES[plan];
    if (!planInfo) {
      return new Response(
        JSON.stringify({ error: `Plano inválido: "${plan}".` }),
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

    // 3. Create Asaas customer
    let mobilePhone = cleanPhone;
    if (mobilePhone.length >= 10 && !mobilePhone.startsWith("55")) {
      mobilePhone = "55" + mobilePhone;
    }

    const asaasCustomer = await asaasFetch("/customers", {
      method: "POST",
      body: JSON.stringify({
        name,
        cpfCnpj: cpfCnpjClean,
        email,
        mobilePhone,
        externalReference: userId,
      }),
    });

    console.log("Asaas customer created:", asaasCustomer.id);

    // 4. Create Asaas subscription with nextDueDate = today + 7 days (trial)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const nextDueDate = trialEnd.toISOString().split("T")[0]; // YYYY-MM-DD

    const externalReference = JSON.stringify({
      user_id: userId,
      workspace_id: "pending",
      plan,
      company_name: companyName,
      signup_phone: cleanPhone,
    });

    const asaasSubscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomer.id,
        billingType: "CREDIT_CARD",
        value: planInfo.value,
        cycle: "MONTHLY",
        nextDueDate,
        description: `Argos X - Plano ${planInfo.display}`,
        externalReference,
      }),
    });

    console.log("Asaas subscription created:", asaasSubscription.id);

    // 5. Save client_invite record
    await supabaseAdmin.from("client_invites").insert({
      email,
      full_name: name,
      phone: cleanPhone || null,
      plan,
      invite_type: "asaas_checkout",
      status: "pending_payment",
      created_by: userId,
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_ip: ip,
      terms_accepted_user_agent: userAgent,
      terms_version: "v1.0-2026-04-01",
    });

    // 6. Fire-and-forget: internal CRM lead + Meta CAPI
    createInternalLead(supabaseAdmin, { name, email, phone: cleanPhone }).catch(console.warn);
    if (eventId) {
      sendMetaConversionEvent(supabaseAdmin, { email, phone: cleanPhone, name, eventId, ip, userAgent }).catch(console.warn);
    }

    // 7. Save attribution data
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

    // 8. Get the invoiceUrl from the first payment of the subscription
    // Asaas creates a payment automatically — we need to fetch it
    let invoiceUrl = "";

    // Try to get the first payment's invoiceUrl
    const payments = await asaasFetch(`/payments?subscription=${asaasSubscription.id}&limit=1`);
    if (payments.data?.length > 0 && payments.data[0].invoiceUrl) {
      invoiceUrl = payments.data[0].invoiceUrl;
    } else {
      // Fallback: use the subscription's payment link if available
      invoiceUrl = asaasSubscription.invoiceUrl || asaasSubscription.bankSlipUrl || "";
    }

    if (!invoiceUrl) {
      console.warn("No invoiceUrl found, falling back to Asaas checkout page");
      // Ultimate fallback: direct to Asaas payment page
      invoiceUrl = `https://www.asaas.com/c/${asaasSubscription.id}`;
    }

    console.log("Redirecting to Asaas invoice:", invoiceUrl);

    return new Response(JSON.stringify({ url: invoiceUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("asaas-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
