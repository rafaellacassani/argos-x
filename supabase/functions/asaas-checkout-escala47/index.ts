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

// Internal CRM
const INTERNAL_WS = "41efdc6d-d4ba-4589-9761-7438a5911d57";
const STAGE_TRIAL = "fc4b4ff8-fbb8-40f3-ad51-9f6564b6ae3b";
const TAG_TRIAL = "a57de997-9b5c-467d-ad1e-8b50e0d07958";

const ASAAS_BASE = "https://api.asaas.com/v3";

// Promo configuration — Escala 47
const PROMO_CAMPAIGN = "escala_47";
const PROMO_PLAN = "escala";
const PROMO_FIRST_VALUE = 47.90;
const PROMO_FULL_VALUE = 197.90;
const PROMO_DAYS = 30;

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

async function createInternalLead(supabaseAdmin: any, contact: { name: string; email: string; phone: string }) {
  try {
    const { data: existing } = await supabaseAdmin
      .from("leads").select("id").eq("workspace_id", INTERNAL_WS)
      .or(`phone.eq.${contact.phone},email.eq.${contact.email}`).limit(1).maybeSingle();
    if (existing) return;
    const { data: lead } = await supabaseAdmin.from("leads").insert({
      workspace_id: INTERNAL_WS, name: contact.name, phone: contact.phone, email: contact.email,
      stage_id: STAGE_TRIAL, source: "asaas_checkout_escala47",
    }).select("id").single();
    if (lead) {
      await supabaseAdmin.from("lead_tag_assignments").insert({
        workspace_id: INTERNAL_WS, lead_id: lead.id, tag_id: TAG_TRIAL,
      });
    }
  } catch (e) { console.warn("createInternalLead error:", e); }
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function buildMetaUserData(p: { email: string; phone: string; name: string; ip: string; userAgent: string; fbp?: string; fbc?: string }) {
  let cleanPhone = p.phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) cleanPhone = "55" + cleanPhone;
  const [emailHash, phoneHash] = await Promise.all([sha256(p.email), sha256(cleanPhone)]);
  const nameParts = (p.name || "").trim().toLowerCase().split(/\s+/);
  const fnHash = nameParts[0] ? await sha256(nameParts[0]) : null;
  const lnHash = nameParts.length > 1 ? await sha256(nameParts.slice(1).join(" ")) : null;
  return {
    em: [emailHash], ph: [phoneHash],
    ...(fnHash ? { fn: [fnHash] } : {}), ...(lnHash ? { ln: [lnHash] } : {}),
    client_ip_address: p.ip, client_user_agent: p.userAgent,
    ...(p.fbp ? { fbp: p.fbp } : {}), ...(p.fbc ? { fbc: p.fbc } : {}),
  };
}

async function sendMetaCustomEvent(supabaseAdmin: any, eventName: string, value: number, params: any) {
  try {
    const { data: ws } = await supabaseAdmin.from("workspaces")
      .select("meta_pixel_id, meta_conversions_token").eq("id", INTERNAL_WS).single();
    if (!ws?.meta_pixel_id || !ws?.meta_conversions_token) return;
    const userData = await buildMetaUserData(params);
    const payload = {
      data: [{
        event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: params.eventId,
        event_source_url: "https://argosx.com.br/escala-47", action_source: "website",
        user_data: userData,
        custom_data: { content_name: "Argos X - Escala Promo R$47,90", currency: "BRL", value, campaign: PROMO_CAMPAIGN },
      }],
    };
    await fetch(
      `https://graph.facebook.com/v21.0/${ws.meta_pixel_id}/events?access_token=${ws.meta_conversions_token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    console.log(`[escala47] Meta CAPI ${eventName} sent:`, params.eventId);
  } catch (e) { console.warn(`Meta CAPI ${eventName} failed:`, e); }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { name, phone, email, companyName, password, cpfCnpj, eventId, creditCard, creditCardHolderInfo, fbp, fbc } = body;

    if (!name || !phone || !email || !companyName || !password || !cpfCnpj) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!creditCard?.number || !creditCard?.holderName || !creditCard?.expiryMonth || !creditCard?.expiryYear || !creditCard?.ccv) {
      return new Response(JSON.stringify({ error: "Dados do cartão são obrigatórios." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cpfCnpjClean = cpfCnpj.replace(/\D/g, "");
    if (cpfCnpjClean.length !== 11 && cpfCnpjClean.length !== 14) {
      return new Response(JSON.stringify({ error: "CPF ou CNPJ inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check duplicate email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    if (existingUser) {
      const { data: existingMember } = await supabaseAdmin
        .from("workspace_members").select("id").eq("user_id", existingUser.id)
        .not("accepted_at", "is", null).limit(1).maybeSingle();
      if (existingMember) {
        return new Response(JSON.stringify({ error: "Este email já possui uma conta. Faça login em /auth." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create/update user
    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createError) {
        return new Response(JSON.stringify({ error: "Erro ao criar conta. Tente novamente." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    await supabaseAdmin.from("user_profiles").upsert(
      { user_id: userId, full_name: name, email, phone: cleanPhone || null },
      { onConflict: "user_id" }
    );

    // Create Asaas customer
    let mobilePhone = cleanPhone;
    if (mobilePhone.startsWith("55") && mobilePhone.length > 11) mobilePhone = mobilePhone.substring(2);

    const asaasCustomer = await asaasFetch("/customers", {
      method: "POST",
      body: JSON.stringify({ name, cpfCnpj: cpfCnpjClean, email, mobilePhone, externalReference: userId }),
    });
    console.log("[escala47] Asaas customer created:", asaasCustomer.id);

    // Create Asaas subscription with PROMO value (R$47,90)
    // Cobrança imediata (nextDueDate = hoje+1) — sem trial gratuito.
    // Após 30 dias o cron escala47-activate-fullprice atualiza o value para 197,90.
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    const externalReference = `escala47_${userId}|${PROMO_PLAN}|${companyName.slice(0, 20)}|${cleanPhone}`;

    await supabaseAdmin.from("client_invites").insert({
      email, full_name: name, phone: cleanPhone || null, plan: PROMO_PLAN,
      invite_type: "asaas_checkout_escala47", status: "pending_payment", created_by: userId,
      terms_accepted_at: new Date().toISOString(), terms_accepted_ip: ip,
      terms_accepted_user_agent: userAgent, terms_version: "v1.0-escala47-2026-04",
    }).then(() => {}, (e: any) => console.warn("client_invites insert error:", e));

    const holderPhone = creditCardHolderInfo?.phone?.replace(/\D/g, "") || cleanPhone;
    let holderMobilePhone = holderPhone;
    if (holderMobilePhone.startsWith("55") && holderMobilePhone.length > 11) {
      holderMobilePhone = holderMobilePhone.substring(2);
    }

    const asaasSubscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomer.id,
        billingType: "CREDIT_CARD",
        value: PROMO_FIRST_VALUE,
        cycle: "MONTHLY",
        nextDueDate: nextDueDate.toISOString().split("T")[0],
        description: `Argos X - Plano Escala (Promo R$47,90 1º mês)`,
        externalReference,
        creditCard: {
          holderName: creditCard.holderName, number: creditCard.number,
          expiryMonth: creditCard.expiryMonth, expiryYear: creditCard.expiryYear, ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: creditCardHolderInfo?.name || name,
          email: creditCardHolderInfo?.email || email,
          cpfCnpj: creditCardHolderInfo?.cpfCnpj || cpfCnpjClean,
          mobilePhone: holderMobilePhone, postalCode: creditCardHolderInfo?.postalCode || "00000000",
          addressNumber: creditCardHolderInfo?.addressNumber || "0", phone: holderMobilePhone,
        },
        remoteIp: ip,
      }),
    });
    console.log("[escala47] Asaas subscription created:", asaasSubscription.id);

    // Create workspace immediately with promo flags
    let workspaceCreated = false;
    try {
      const planConfig = { lead_limit: 999999, whatsapp_limit: 999, user_limit: 3, ai_interactions_limit: 10000 };
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const now = new Date();
      const lockedUntil = new Date(now);
      lockedUntil.setDate(lockedUntil.getDate() + PROMO_DAYS);

      const { data: workspace, error: wsError } = await supabaseAdmin.from("workspaces").insert({
        name: companyName, slug: `${slug}-${Date.now()}`, created_by: userId,
        plan_name: PROMO_PLAN, plan_type: "active", subscription_status: "active",
        asaas_customer_id: asaasCustomer.id, asaas_subscription_id: asaasSubscription.id,
        payment_provider: "asaas",
        lead_limit: planConfig.lead_limit, whatsapp_limit: planConfig.whatsapp_limit,
        user_limit: planConfig.user_limit, ai_interactions_limit: planConfig.ai_interactions_limit,
        // Promo flags
        promo_campaign: PROMO_CAMPAIGN, promo_starts_at: now.toISOString(),
        promo_locked_until: lockedUntil.toISOString(), is_promo_trial: true,
      }).select().single();

      if (wsError) throw wsError;

      await supabaseAdmin.from("workspace_members").upsert(
        { workspace_id: workspace.id, user_id: userId, role: "admin", accepted_at: new Date().toISOString() },
        { onConflict: "workspace_id,user_id" }
      );

      const { data: funnel } = await supabaseAdmin.from("funnels")
        .insert({ name: "Funil de Vendas", workspace_id: workspace.id, is_default: true })
        .select().single();

      if (funnel) {
        const defaultStages = [
          { name: "Leads de Entrada", color: "#6B7280", position: 0 },
          { name: "Em Qualificação", color: "#0171C3", position: 1 },
          { name: "Lixo", color: "#EF4444", position: 2, is_loss_stage: true },
          { name: "Reunião Agendada", color: "#F59E0B", position: 3 },
          { name: "Venda Realizada", color: "#22C55E", position: 4, is_win_stage: true },
          { name: "No Show", color: "#8B5CF6", position: 5 },
        ];
        for (const stage of defaultStages) {
          await supabaseAdmin.from("funnel_stages").insert({
            funnel_id: funnel.id, workspace_id: workspace.id, ...stage,
          });
        }
      }

      workspaceCreated = true;
      console.log("[escala47] Workspace created with promo flags:", workspace.id);
    } catch (e) {
      console.error("[escala47] Workspace creation failed (webhook will retry):", e);
    }

    // Fire-and-forget Meta CAPI events
    createInternalLead(supabaseAdmin, { name, email, phone: cleanPhone }).catch(console.warn);
    if (eventId) {
      sendMetaCustomEvent(supabaseAdmin, "EscalaPromoSignup", PROMO_FIRST_VALUE,
        { email, phone: cleanPhone, name, eventId, ip, userAgent, fbp, fbc }).catch(console.warn);
    }

    const purchaseEventId = `escala47_purchase_${asaasSubscription.id}_${Date.now()}`;
    if (workspaceCreated) {
      sendMetaCustomEvent(supabaseAdmin, "EscalaPromoPurchase", PROMO_FIRST_VALUE,
        { email, phone: cleanPhone, name, eventId: purchaseEventId, ip, userAgent, fbp, fbc }).catch(console.warn);
    }

    // Save attribution
    const attribution = body.attribution;
    if (attribution && typeof attribution === "object" && Object.keys(attribution).length > 0) {
      const allowedKeys = ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
      const safe: Record<string, string> = {};
      for (const k of allowedKeys) {
        if (attribution[k] && typeof attribution[k] === "string") safe[k] = attribution[k].substring(0, 500);
      }
      if (Object.keys(safe).length > 0) {
        await supabaseAdmin.from("lead_attribution").insert({
          ...safe, workspace_id: INTERNAL_WS,
        }).catch(console.warn);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      workspaceCreated,
      planValue: PROMO_FIRST_VALUE,
      fullPriceValue: PROMO_FULL_VALUE,
      promoDays: PROMO_DAYS,
      purchaseEventId,
      message: `Cadastro concluído! Você pagou R$${PROMO_FIRST_VALUE.toFixed(2).replace(".", ",")} hoje. Após 30 dias o valor passa para R$${PROMO_FULL_VALUE.toFixed(2).replace(".", ",")}/mês.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[escala47] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});