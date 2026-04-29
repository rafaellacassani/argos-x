import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

// Internal CRM constants
const INTERNAL_WS = "41efdc6d-d4ba-4589-9761-7438a5911d57";
const STAGE_TRIAL = "fc4b4ff8-fbb8-40f3-ad51-9f6564b6ae3b";
const STAGE_ACTIVE = "7030e322-ac11-4dfa-b128-c9b09c5efbb4";
const STAGE_CANCELED = "a1c9acb9-82e5-4b99-966b-d7a033372a9a";
const TAG_TRIAL = "a57de997-9b5c-467d-ad1e-8b50e0d07958";
const TAG_ACTIVE = "62750bf4-b139-4462-b646-100e1c69723b";
const TAG_CANCELED = "0594a852-068d-4a23-a9d5-c17e8106f396";
const PLAN_TAGS: Record<string, string> = {
  essencial: "e399514f-7df6-46ab-b6a9-e19eaf8b257f",
  negocio: "ed1b0c84-f306-4e82-bcb7-bce4e2174abc",
  escala: "4dcb6219-e129-4d0c-8b9f-aeea14b296c2",
};
const STATUS_TAGS = [TAG_TRIAL, TAG_ACTIVE, TAG_CANCELED];
const ALL_PLAN_TAGS = Object.values(PLAN_TAGS);

const ASAAS_BASE = "https://api.asaas.com/v3";

function getPlanConfig(planName: string) {
  const configs: Record<string, any> = {
    essencial: { plan_name: "essencial", lead_limit: 300, whatsapp_limit: 1, user_limit: 1, ai_interactions_limit: 500 },
    negocio: { plan_name: "negocio", lead_limit: 2000, whatsapp_limit: 3, user_limit: 1, ai_interactions_limit: 2000 },
    escala: { plan_name: "escala", lead_limit: 999999, whatsapp_limit: 999, user_limit: 3, ai_interactions_limit: 10000 },
  };
  return configs[planName] || configs.essencial;
}

async function asaasFetch(path: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "Content-Type": "application/json", access_token: apiKey },
  });
  return res.json();
}

const META_PIXEL_ID = "1294031842786070";
const META_ACCESS_TOKEN_KEY = "META_CONVERSION_TOKEN";

async function sha256Hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendMetaPurchaseEvent(email: string, phone: string, paymentValue: number, paymentId: string, planName: string) {
  try {
    const accessToken = Deno.env.get(META_ACCESS_TOKEN_KEY);
    if (!accessToken) {
      console.warn("[asaas-webhook] META_CONVERSION_TOKEN not set, skipping CAPI");
      return;
    }

    const userData: Record<string, string[]> = {};
    if (email) userData.em = [await sha256Hash(email)];
    if (phone) {
      let clean = phone.replace(/\D/g, "");
      if (clean.length >= 10 && !clean.startsWith("55")) clean = "55" + clean;
      userData.ph = [await sha256Hash(clean)];
    }

    const eventId = `asaas_pay_${paymentId}`;
    const payload = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: "https://argosx.com.br/cadastro",
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: "BRL",
          value: paymentValue,
          content_name: `Plano ${planName}`,
        },
      }],
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events?access_token=${accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    );
    const result = await res.json();
    console.log("[asaas-webhook] Meta CAPI Purchase sent:", JSON.stringify(result));
  } catch (e) {
    console.warn("[asaas-webhook] Meta CAPI Purchase failed:", e);
  }
}

async function moveInternalLead(
  supabaseAdmin: any,
  customerEmail: string,
  targetStageId: string,
  addTagId: string,
  planName?: string
) {
  try {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("workspace_id", INTERNAL_WS)
      .eq("email", customerEmail)
      .limit(1)
      .maybeSingle();

    if (!lead) return;

    await supabaseAdmin
      .from("leads")
      .update({ stage_id: targetStageId })
      .eq("id", lead.id);

    await supabaseAdmin
      .from("lead_tag_assignments")
      .delete()
      .eq("lead_id", lead.id)
      .eq("workspace_id", INTERNAL_WS)
      .in("tag_id", STATUS_TAGS);

    await supabaseAdmin.from("lead_tag_assignments").upsert(
      { workspace_id: INTERNAL_WS, lead_id: lead.id, tag_id: addTagId },
      { onConflict: "lead_id,tag_id" }
    ).select();

    if (planName) {
      await supabaseAdmin
        .from("lead_tag_assignments")
        .delete()
        .eq("lead_id", lead.id)
        .eq("workspace_id", INTERNAL_WS)
        .in("tag_id", ALL_PLAN_TAGS);

      const planTagId = PLAN_TAGS[planName];
      if (planTagId) {
        await supabaseAdmin.from("lead_tag_assignments").upsert(
          { workspace_id: INTERNAL_WS, lead_id: lead.id, tag_id: planTagId },
          { onConflict: "lead_id,tag_id" }
        ).select();
      }
    }
  } catch (e) {
    console.warn("moveInternalLead error:", e);
  }
}

async function sendWelcomeWhatsApp(supabaseAdmin: any, phone: string, name: string) {
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

  const { data: config } = await supabaseAdmin
    .from("reactivation_cadence_config")
    .select("whatsapp_instance_name, welcome_message_template")
    .limit(1)
    .single();

  if (!config?.whatsapp_instance_name) return;

  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }

  const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
  const defaultMessage = `Olá, ${name}! 👋\n\nBem-vindo ao *Argos X*! 🚀\n\nSua conta foi ativada com sucesso. Você tem *7 dias de teste grátis*.\n\nAcesse agora e comece a usar:\n👉 https://argosx.com.br/auth\n\nQualquer dúvida, é só responder aqui! 😊`;

  const message = config.welcome_message_template
    ? config.welcome_message_template.replace(/\{nome\}/g, name)
    : defaultMessage;

  try {
    await fetch(`${apiUrl}/message/sendText/${config.whatsapp_instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
  } catch (e) {
    console.warn("Welcome WhatsApp failed:", e);
  }
}

async function createWorkspaceForAsaasCustomer(
  supabaseAdmin: any,
  asaasCustomerId: string,
  asaasSubscriptionId: string,
  planName: string,
  meta: { user_id: string; company_name: string; signup_phone: string; email?: string }
) {
  // Check if workspace already exists for this Asaas customer
  const { data: existingWs } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("asaas_customer_id", asaasCustomerId)
    .maybeSingle();

  if (existingWs) {
    console.log("Workspace already exists for Asaas customer:", asaasCustomerId);
    return;
  }

  const planConfig = getPlanConfig(planName);
  const userId = meta.user_id;
  const companyName = meta.company_name || "Cliente";

  // Check if user already has a workspace — upgrade instead of creating new
  const { data: existingUserWs } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  let existingWsId = existingUserWs?.workspace_id;

  if (!existingWsId) {
    const { data: wsByCreator } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("created_by", userId)
      .limit(1)
      .maybeSingle();
    if (wsByCreator) {
      existingWsId = wsByCreator.id;
      await supabaseAdmin.from("workspace_members").upsert(
        { workspace_id: existingWsId, user_id: userId, role: "admin", accepted_at: new Date().toISOString() },
        { onConflict: "workspace_id,user_id" }
      );
    }
  }

  if (existingWsId) {
    console.log("User already has workspace, upgrading:", existingWsId);
    await supabaseAdmin
      .from("workspaces")
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscriptionId,
        payment_provider: "asaas",
        plan_name: planConfig.plan_name,
        plan_type: "trialing",
        subscription_status: "trialing",
        lead_limit: planConfig.lead_limit,
        whatsapp_limit: planConfig.whatsapp_limit,
        user_limit: planConfig.user_limit,
        ai_interactions_limit: planConfig.ai_interactions_limit,
        trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        blocked_at: null,
      })
      .eq("id", existingWsId);

    if (meta.email) {
      await moveInternalLead(supabaseAdmin, meta.email, STAGE_TRIAL, TAG_TRIAL, planName);
    }
    return;
  }

  // Get user profile for email
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("email, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  const fullName = profile?.full_name || companyName;
  const email = profile?.email || meta.email || "";

  // Create workspace
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: workspace, error: wsError } = await supabaseAdmin
    .from("workspaces")
    .insert({
      name: companyName,
      slug: `${slug}-${Date.now()}`,
      created_by: userId,
      plan_name: planConfig.plan_name,
      plan_type: "trialing",
      subscription_status: "trialing",
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: asaasSubscriptionId,
      payment_provider: "asaas",
      lead_limit: planConfig.lead_limit,
      whatsapp_limit: planConfig.whatsapp_limit,
      user_limit: planConfig.user_limit,
      ai_interactions_limit: planConfig.ai_interactions_limit,
      trial_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (wsError) throw wsError;

  // Add user as admin member
  await supabaseAdmin.from("workspace_members").upsert(
    { workspace_id: workspace.id, user_id: userId, role: "admin", accepted_at: new Date().toISOString() },
    { onConflict: "workspace_id,user_id" }
  );

  // Create default funnel + stages
  const { data: funnel } = await supabaseAdmin
    .from("funnels")
    .insert({ name: "Funil de Vendas", workspace_id: workspace.id, is_default: true })
    .select()
    .single();

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
        funnel_id: funnel.id,
        workspace_id: workspace.id,
        ...stage,
      });
    }
  }

  // Send welcome email
  try {
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://argosx.com.br/auth/reset-password" },
    });

    if (linkData?.properties?.action_link) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Argos X <onboarding@resend.dev>",
            to: [email],
            subject: `Bem-vindo ao Argos X, ${fullName}! 🎉`,
            html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:#0171C3;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Argos X</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;">Bem-vindo(a), ${fullName}! 🎉</h2>
          <p style="margin:0 0 16px;color:#52525b;font-size:15px;line-height:1.6;">
            Sua conta do plano <strong>${planConfig.plan_name.charAt(0).toUpperCase() + planConfig.plan_name.slice(1)}</strong> foi criada com sucesso! Você tem 7 dias de teste grátis.
          </p>
          <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
            Para acessar sua conta, clique no botão abaixo e defina sua senha:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${linkData.properties.action_link}" target="_blank" style="display:inline-block;background:#0171C3;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Definir Senha e Acessar
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 40px;background:#fafafa;text-align:center;">
          <p style="margin:0;color:#a1a1aa;font-size:12px;">© ${new Date().getFullYear()} Argos X</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          }),
        });
      }
    }
  } catch (e) {
    console.warn("Welcome email failed:", e);
  }

  // Send WhatsApp welcome
  if (meta.signup_phone) {
    sendWelcomeWhatsApp(supabaseAdmin, meta.signup_phone, fullName).catch(console.warn);
  }

  console.log("Workspace created for Asaas customer:", asaasCustomerId, "workspace:", workspace.id);
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
    const body = await req.json();
    const { event, payment } = body;

    if (!event || !payment) {
      console.log("[asaas-webhook] Invalid payload, missing event or payment");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[asaas-webhook] Event: ${event}, Payment ID: ${payment.id}, Status: ${payment.status}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ========================================================================
    // ANNUAL PROMO 2026-04-29 — one-off charge (no subscription)
    // Intercepted BEFORE the "no subscription" early return so it never falls
    // through to the regular subscription-based flow.
    // ========================================================================
    const paymentExternalRef: string = payment.externalReference || "";
    if (paymentExternalRef.startsWith("annual_promo_20260429_")) {
      // Parse: "annual_promo_20260429_{plan}_{workspaceId}" (new)
      //  or:   "annual_promo_20260429_{workspaceId}"        (legacy fallback)
      const tail = paymentExternalRef.replace("annual_promo_20260429_", "");
      const PROMO_PLANS = new Set(["essencial", "negocio", "escala"]);
      let promoPlan: string | null = null;
      let promoWorkspaceId: string;
      const firstUnderscore = tail.indexOf("_");
      const maybePlan = firstUnderscore > 0 ? tail.slice(0, firstUnderscore).toLowerCase() : "";
      if (PROMO_PLANS.has(maybePlan)) {
        promoPlan = maybePlan;
        promoWorkspaceId = tail.slice(firstUnderscore + 1);
      } else {
        promoWorkspaceId = tail;
      }
      console.log(`[asaas-webhook] ANNUAL PROMO event=${event} ws=${promoWorkspaceId} plan=${promoPlan || "(legacy/auto)"}`);

      if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        // Load workspace to get current subscription to cancel
        const { data: promoWs } = await supabaseAdmin
          .from("workspaces")
          .select("id, asaas_subscription_id, plan_name")
          .eq("id", promoWorkspaceId)
          .maybeSingle();

        if (!promoWs) {
          console.warn(`[asaas-webhook] Annual promo: workspace ${promoWorkspaceId} not found`);
          return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Resolve final plan: explicit from ref > existing on workspace > essencial
        const finalPlan = promoPlan
          || (PROMO_PLANS.has((promoWs.plan_name || "").toLowerCase()) ? (promoWs.plan_name as string).toLowerCase() : "essencial");
        const planConfig = getPlanConfig(finalPlan);

        // Activate annual promo + apply plan limits
        await supabaseAdmin
          .from("workspaces")
          .update({
            annual_promo_expires_at: expiresAt,
            subscription_status: "active",
            plan_type: "active",
            plan_name: planConfig.plan_name,
            lead_limit: planConfig.lead_limit,
            whatsapp_limit: planConfig.whatsapp_limit,
            user_limit: planConfig.user_limit,
            ai_interactions_limit: planConfig.ai_interactions_limit,
            blocked_at: null,
          })
          .eq("id", promoWorkspaceId);

        // Cancel existing monthly subscription on Asaas (if any)
        if (promoWs.asaas_subscription_id) {
          try {
            const apiKey = Deno.env.get("ASAAS_API_KEY");
            if (apiKey) {
              const cancelRes = await fetch(
                `${ASAAS_BASE}/subscriptions/${promoWs.asaas_subscription_id}`,
                { method: "DELETE", headers: { "Content-Type": "application/json", access_token: apiKey } }
              );
              console.log(`[asaas-webhook] Annual promo: cancelled monthly sub ${promoWs.asaas_subscription_id} status=${cancelRes.status}`);
            }
          } catch (e) {
            console.warn("[asaas-webhook] Annual promo: failed to cancel monthly sub:", e);
          }

          await supabaseAdmin
            .from("workspaces")
            .update({ asaas_subscription_id: null })
            .eq("id", promoWorkspaceId);
        }

        console.log(`[asaas-webhook] Annual promo activated for ws=${promoWorkspaceId} plan=${finalPlan} until ${expiresAt}`);
      } else {
        console.log(`[asaas-webhook] Annual promo: ignoring event ${event}`);
      }

      return new Response(JSON.stringify({ received: true, annual_promo: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscription details to find externalReference
    const subscriptionId = payment.subscription;
    if (!subscriptionId) {
      console.log("[asaas-webhook] Payment has no subscription, ignoring");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch subscription to get externalReference
    const subscription = await asaasFetch(`/subscriptions/${subscriptionId}`);
    let meta: any = {};
    try {
      meta = JSON.parse(subscription.externalReference || "{}");
    } catch {
      // Fallback: pipe-separated format "userId|plan|company|phone"
      const parts = (subscription.externalReference || "").split("|");
      if (parts.length >= 2) {
        meta = {
          user_id: parts[0],
          plan: parts[1],
          company_name: parts[2] || "",
          signup_phone: parts[3] || "",
        };
        console.log("[asaas-webhook] Parsed pipe-separated externalReference:", JSON.stringify(meta));
      } else {
        console.warn("[asaas-webhook] Could not parse externalReference:", subscription.externalReference);
      }
    }

    const asaasCustomerId = subscription.customer || payment.customer;
    const planName = meta.plan || "essencial";

    // Get customer details for CRM updates and Meta CAPI
    let customerEmail = "";
    let customerPhone = "";
    try {
      const customer = await asaasFetch(`/customers/${asaasCustomerId}`);
      customerEmail = customer.email || "";
      customerPhone = customer.mobilePhone || customer.phone || "";
    } catch (e) {
      console.warn("[asaas-webhook] Could not fetch customer:", e);
    }

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        // Check if this is a lead_pack subscription
        let isLeadPack = false;
        let leadPackMeta: any = {};
        try {
          const parsed = JSON.parse(subscription.externalReference || "{}");
          if (parsed.type === "lead_pack") {
            isLeadPack = true;
            leadPackMeta = parsed;
          }
        } catch { /* not JSON, not a lead pack */ }

        if (isLeadPack && event === "PAYMENT_RECEIVED") {
          // Lead pack payment — ensure pack exists in DB
          const packWsId = leadPackMeta.workspace_id;
          const packSize = leadPackMeta.pack_size;
          if (packWsId && packSize) {
            const { data: existingPack } = await supabaseAdmin
              .from("lead_packs")
              .select("id")
              .eq("workspace_id", packWsId)
              .eq("asaas_subscription_id", subscriptionId)
              .maybeSingle();

            if (!existingPack) {
              await supabaseAdmin.from("lead_packs").insert({
                workspace_id: packWsId,
                pack_size: packSize,
                price_paid: payment.value || 0,
                active: true,
                asaas_subscription_id: subscriptionId,
              });
              console.log(`[asaas-webhook] Lead pack +${packSize} inserted for workspace ${packWsId}`);
            }

            // Recalculate extra_leads from all active packs
            const { data: allPacks } = await supabaseAdmin
              .from("lead_packs")
              .select("pack_size")
              .eq("workspace_id", packWsId)
              .eq("active", true);
            
            const totalExtra = (allPacks || []).reduce((sum: number, p: any) => sum + p.pack_size, 0);
            await supabaseAdmin
              .from("workspaces")
              .update({ extra_leads: totalExtra })
              .eq("id", packWsId);
            
            console.log(`[asaas-webhook] Updated extra_leads to ${totalExtra} for workspace ${packWsId}`);
          }
          break;
        }

        // Check if this is an add_user subscription
        let isAddUser = false;
        let addUserMeta: any = {};
        try {
          const parsed = JSON.parse(subscription.externalReference || "{}");
          if (parsed.type === "add_user") {
            isAddUser = true;
            addUserMeta = parsed;
          }
        } catch { /* not JSON */ }

        if (isAddUser && event === "PAYMENT_RECEIVED") {
          const userWsId = addUserMeta.workspace_id;
          const extraUsers = addUserMeta.extra_users || 1;
          if (userWsId) {
            const { data: ws } = await supabaseAdmin
              .from("workspaces")
              .select("user_limit")
              .eq("id", userWsId)
              .single();
            
            if (ws) {
              const planBaseLimit = getPlanConfig(planName || "essencial").user_limit;
              const newLimit = Math.max(ws.user_limit, planBaseLimit) + extraUsers;
              await supabaseAdmin
                .from("workspaces")
                .update({ user_limit: newLimit })
                .eq("id", userWsId);
              console.log(`[asaas-webhook] Updated user_limit to ${newLimit} for workspace ${userWsId}`);
            }
          }
          break;
        }

        // Regular plan payment flow
        const { data: existingWs } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("asaas_customer_id", asaasCustomerId)
          .maybeSingle();

        if (!existingWs && meta.user_id) {
          await createWorkspaceForAsaasCustomer(
            supabaseAdmin,
            asaasCustomerId,
            subscriptionId,
            planName,
            { ...meta, email: customerEmail }
          );
        }

        if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
          const planConfig = getPlanConfig(planName);
          
          // Preserve user_limit if it's higher than plan default (means extra users were purchased)
          const { data: currentWs } = await supabaseAdmin
            .from("workspaces")
            .select("user_limit")
            .eq("asaas_customer_id", asaasCustomerId)
            .maybeSingle();
          
          const effectiveUserLimit = currentWs && currentWs.user_limit > planConfig.user_limit
            ? currentWs.user_limit
            : planConfig.user_limit;

          await supabaseAdmin
            .from("workspaces")
            .update({
              subscription_status: "active",
              plan_type: "active",
              blocked_at: null,
              plan_name: planConfig.plan_name,
              lead_limit: planConfig.lead_limit,
              whatsapp_limit: planConfig.whatsapp_limit,
              user_limit: effectiveUserLimit,
              ai_interactions_limit: planConfig.ai_interactions_limit,
            })
            .eq("asaas_customer_id", asaasCustomerId);

          if (customerEmail) {
            await moveInternalLead(supabaseAdmin, customerEmail, STAGE_ACTIVE, TAG_ACTIVE, planName);
          }
        }

        const paymentValue = payment.value || 0;
        sendMetaPurchaseEvent(customerEmail, customerPhone, paymentValue, payment.id, planName).catch(console.warn);

        break;
      }

      case "PAYMENT_OVERDUE": {
        // CRITICAL: Set BOTH subscription_status AND plan_type to past_due
        // so check-workspace-access properly blocks access
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "past_due",
            plan_type: "past_due",
          })
          .eq("asaas_customer_id", asaasCustomerId);

        console.log(`[asaas-webhook] Workspace marked past_due for customer ${asaasCustomerId}`);
        break;
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        // CRITICAL FIX: Don't cancel the workspace if the subscription is still ACTIVE
        // in Asaas. PAYMENT_DELETED/REFUNDED can be triggered for a single charge
        // (e.g. trial pre-auth removed, refund on a single invoice) without meaning
        // the whole subscription was canceled. Previously, this was cancelling
        // workspaces ~1h after signup because Asaas removes the trial pre-auth
        // charge, breaking trials for valid paying customers.
        const subStatus = (subscription.status || "").toUpperCase();
        const subDeleted = subscription.deleted === true;
        const isSubscriptionDead = subDeleted || ["INACTIVE", "EXPIRED", "CANCELED", "CANCELLED"].includes(subStatus);

        if (!isSubscriptionDead) {
          console.log(
            `[asaas-webhook] ${event} received but subscription ${subscriptionId} is still ${subStatus || "ACTIVE"} — NOT cancelling workspace.`
          );
          break;
        }

        // CRITICAL FIX (upgrade race condition): When a customer upgrades plans,
        // asaas-manage-subscription cancels the OLD subscription and creates a NEW one.
        // Asaas then fires PAYMENT_DELETED for the old invoice — its `subscription` payload
        // points to the dead old sub. If we cancel the workspace based on that, we wipe out
        // a perfectly valid active customer (this happened with Bernardino Advocacia).
        // So before cancelling, check if the customer has ANY other ACTIVE subscription.
        try {
          const subsList = await fetch(
            `https://api.asaas.com/v3/subscriptions?customer=${asaasCustomerId}&status=ACTIVE&limit=10`,
            { headers: { access_token: Deno.env.get("ASAAS_API_KEY")!, "Content-Type": "application/json" } }
          ).then((r) => r.json());
          const activeOther = (subsList?.data || []).find(
            (s: any) => s?.id && s.id !== subscriptionId && (s.status || "").toUpperCase() === "ACTIVE" && s.deleted !== true
          );
          if (activeOther) {
            console.log(
              `[asaas-webhook] ${event} for dead sub ${subscriptionId}, but customer ${asaasCustomerId} has another ACTIVE sub ${activeOther.id} — NOT cancelling workspace (upgrade in progress).`
            );
            break;
          }
        } catch (e) {
          console.warn("[asaas-webhook] Failed to check for other active subs, proceeding with cancellation:", e);
        }

        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "canceled",
            plan_type: "canceled",
            blocked_at: new Date().toISOString(),
          })
          .eq("asaas_customer_id", asaasCustomerId);

        if (customerEmail) {
          await moveInternalLead(supabaseAdmin, customerEmail, STAGE_CANCELED, TAG_CANCELED);
        }
        break;
      }

      case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": {
        // Card refused — mark as past_due and block
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "past_due",
            plan_type: "past_due",
          })
          .eq("asaas_customer_id", asaasCustomerId);

        console.log(`[asaas-webhook] Card capture refused for customer ${asaasCustomerId}`);
        break;
      }

      default:
        console.log(`[asaas-webhook] Unhandled event: ${event}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[asaas-webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
