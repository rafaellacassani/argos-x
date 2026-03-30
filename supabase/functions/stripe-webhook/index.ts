// Stripe webhook handler — redeployed 2026-03-29 — constructEventAsync fix
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";
import { crypto as stdCrypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Internal CRM constants (admin workspace)
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

async function moveInternalLead(
  supabaseAdmin: any,
  customerEmail: string,
  targetStageId: string,
  addTagId: string,
  planName?: string
) {
  try {
    // Find lead by email in internal workspace
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("workspace_id", INTERNAL_WS)
      .eq("email", customerEmail)
      .limit(1)
      .maybeSingle();

    if (!lead) return;

    // Move to target stage
    await supabaseAdmin
      .from("leads")
      .update({ stage_id: targetStageId })
      .eq("id", lead.id);

    // Remove old status tags
    await supabaseAdmin
      .from("lead_tag_assignments")
      .delete()
      .eq("lead_id", lead.id)
      .eq("workspace_id", INTERNAL_WS)
      .in("tag_id", STATUS_TAGS);

    // Add new status tag
    await supabaseAdmin.from("lead_tag_assignments").upsert(
      { workspace_id: INTERNAL_WS, lead_id: lead.id, tag_id: addTagId },
      { onConflict: "lead_id,tag_id" }
    ).select();

    // Handle plan tags
    if (planName) {
      // Remove old plan tags
      await supabaseAdmin
        .from("lead_tag_assignments")
        .delete()
        .eq("lead_id", lead.id)
        .eq("workspace_id", INTERNAL_WS)
        .in("tag_id", ALL_PLAN_TAGS);

      // Add new plan tag
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

// Plan definitions by Stripe Price ID
function getPlanConfig(priceId: string, env: Record<string, string | undefined>) {
  const priceEssencial = env.STRIPE_PRICE_ESSENCIAL;
  const priceNegocio = env.STRIPE_PRICE_NEGOCIO;
  const priceEscala = env.STRIPE_PRICE_ESCALA;

  if (priceId === priceEssencial) {
    return { plan_name: "essencial", lead_limit: 300, whatsapp_limit: 1, user_limit: 1, ai_interactions_limit: 500 };
  }
  if (priceId === priceNegocio) {
    return { plan_name: "negocio", lead_limit: 2000, whatsapp_limit: 3, user_limit: 1, ai_interactions_limit: 2000 };
  }
  if (priceId === priceEscala) {
    return { plan_name: "escala", lead_limit: 999999, whatsapp_limit: 999, user_limit: 3, ai_interactions_limit: 10000 };
  }
  return { plan_name: "essencial", lead_limit: 300, whatsapp_limit: 1, user_limit: 1, ai_interactions_limit: 500 };
}

async function sendWelcomeWhatsApp(phone: string, name: string) {
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: config } = await supabaseAdmin
    .from("reactivation_cadence_config")
    .select("id, whatsapp_instance_name, welcome_message_template")
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

async function createWorkspaceForCustomer(
  supabaseAdmin: any,
  stripeCustomerId: string,
  subscriptionId: string,
  priceId: string | null
) {
  // Check if workspace already exists for this Stripe customer
  const { data: existingWsByStripe } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (existingWsByStripe) {
    console.log("Workspace already exists for customer:", stripeCustomerId);
    return;
  }

  const env = {
    STRIPE_PRICE_ESSENCIAL: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
    STRIPE_PRICE_NEGOCIO: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
    STRIPE_PRICE_ESCALA: Deno.env.get("STRIPE_PRICE_ESCALA"),
  };

  const planConfig = getPlanConfig(priceId || "", env);

  // Get customer info from Stripe
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });
  const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;

  const email = customer.email;
  const customerMeta = (customer as any).metadata || {};
  const companyName = customerMeta.company_name || customer.name || customer.email || "Cliente";
  const fullName = customer.name || customer.email || "Cliente";
  const signupPhone = customerMeta.signup_phone || (customer as any).phone || null;

  if (!email) {
    console.error("Customer has no email, cannot create workspace:", stripeCustomerId);
    return;
  }

  // 1. Create or find user
  let userId: string;
  const randomPassword = crypto.randomUUID() + "Aa1!";

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
  });

  if (createError) {
    if (
      createError.message?.includes("already been registered") ||
      createError.message?.includes("already exists")
    ) {
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const foundUser = allUsers?.users?.find((u: any) => u.email === email);
      if (!foundUser) {
        console.error("User exists but could not be found:", email);
        return;
      }
      userId = foundUser.id;
    } else {
      throw createError;
    }
  } else {
    userId = newUser.user.id;
  }

  // 2. Check if user already has a workspace (e.g. from trial signup) — upgrade it instead of creating new one
  // First check workspace_members, then fallback to created_by (in case members insert failed previously)
  const { data: existingUserWs } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  let existingWsId = existingUserWs?.workspace_id;

  // Fallback: check if workspace exists by created_by (covers case where workspace_members insert failed)
  if (!existingWsId) {
    const { data: wsByCreator } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("created_by", userId)
      .limit(1)
      .maybeSingle();
    if (wsByCreator) {
      existingWsId = wsByCreator.id;
      console.log("Found workspace by created_by (no member entry), repairing:", existingWsId);
      // Repair: ensure user is a member
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
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        plan_name: planConfig.plan_name,
        plan_type: "active",
        subscription_status: "active",
        lead_limit: planConfig.lead_limit,
        whatsapp_limit: planConfig.whatsapp_limit,
        user_limit: planConfig.user_limit,
        ai_interactions_limit: planConfig.ai_interactions_limit,
        blocked_at: null,
        trial_end: null,
      })
      .eq("id", existingWsId);

    // Move internal CRM lead
    await moveInternalLead(supabaseAdmin, email, STAGE_ACTIVE, TAG_ACTIVE, planConfig.plan_name);
    console.log("Existing workspace upgraded for customer:", stripeCustomerId, "workspace:", existingWsId);
    return;
  }

  // 3. Upsert user_profiles
  await supabaseAdmin.from("user_profiles").upsert(
    { user_id: userId, full_name: fullName, email, phone: (customer as any).phone || null },
    { onConflict: "user_id" }
  );

  // 3. Create workspace
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
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      lead_limit: planConfig.lead_limit,
      whatsapp_limit: planConfig.whatsapp_limit,
      user_limit: planConfig.user_limit,
      ai_interactions_limit: planConfig.ai_interactions_limit,
    })
    .select()
    .single();

  if (wsError) throw wsError;

  // 4. Add user as admin member (upsert to avoid silent failures)
  const { error: memberError } = await supabaseAdmin.from("workspace_members").upsert(
    {
      workspace_id: workspace.id,
      user_id: userId,
      role: "admin",
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,user_id" }
  );
  if (memberError) {
    console.error("Failed to add workspace member:", memberError);
  }

  // 5. Create default funnel + stages
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

  // 6. Generate password recovery link
  try {
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: "https://argosx.com.br/auth/reset-password" },
    });

    if (linkData?.properties?.action_link) {
      // Send welcome email with password setup link
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Argos X <onboarding@resend.dev>",
            to: [email],
            subject: `Bem-vindo ao Argos X, ${fullName}! 🎉`,
            html: `
<!DOCTYPE html>
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
            Sua assinatura do plano <strong>${planConfig.plan_name.charAt(0).toUpperCase() + planConfig.plan_name.slice(1)}</strong> foi confirmada com sucesso!
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
    console.warn("Could not send welcome email:", e);
  }

  // Send WhatsApp welcome if we have a phone number
  if (signupPhone) {
    sendWelcomeWhatsApp(signupPhone, fullName).catch((e) => console.warn("Welcome WA error:", e));
  }

  console.log("Workspace created successfully for customer:", stripeCustomerId, "workspace:", workspace.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");

  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set!");
    return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!signature) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;
  const body = await req.text();

  console.log(`[stripe-webhook] Received request: body_length=${body.length}, has_signature=true, secret_length=${webhookSecret.length}`);

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    console.log(`[stripe-webhook] ✅ Signature verified. Event: ${event.type} (${event.id})`);
  } catch (err) {
    console.error(`[stripe-webhook] ❌ Signature verification failed: ${err.message}`);
    console.error(`[stripe-webhook] Debug: body_length=${body.length}, sig_prefix=${signature.substring(0, 20)}..., secret_prefix=${webhookSecret.substring(0, 10)}...`);
    return new Response(JSON.stringify({ error: "Invalid signature", detail: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const sessionMeta = session.metadata || {};

        // Fire CompleteRegistration via Meta CAPI (server-side deduplication)
        try {
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          const custEmail = customer.email || "";
          const custPhone = (customer as any).phone || (customer as any).metadata?.signup_phone || "";

          if (custEmail) {
            const { data: internalWs } = await supabaseAdmin
              .from("workspaces")
              .select("meta_pixel_id, meta_conversions_token")
              .eq("id", INTERNAL_WS)
              .single();

            if (internalWs?.meta_pixel_id && internalWs?.meta_conversions_token) {
              const sha256 = async (v: string) => {
                const d = new TextEncoder().encode(v.trim().toLowerCase());
                const h = await crypto.subtle.digest("SHA-256", d);
                return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
              };

              let cleanPh = custPhone.replace(/\D/g, "");
              if (cleanPh.length >= 10 && !cleanPh.startsWith("55")) cleanPh = "55" + cleanPh;

              const [emHash, phHash] = await Promise.all([sha256(custEmail), sha256(cleanPh || "")]);

              // Hash name parts for fn/ln
              const custName = (customer as any).name || "";
              const nameParts = custName.trim().toLowerCase().split(/\s+/);
              const fnHash = nameParts[0] ? await sha256(nameParts[0]) : null;
              const lnHash = nameParts.length > 1 ? await sha256(nameParts.slice(1).join(" ")) : null;

              const capiPayload = {
                data: [{
                  event_name: "CompleteRegistration",
                  event_time: Math.floor(Date.now() / 1000),
                  event_id: session.id,
                  event_source_url: "https://argosx.com.br/cadastro/sucesso",
                  action_source: "website",
                  user_data: {
                    em: [emHash],
                    ...(cleanPh ? { ph: [phHash] } : {}),
                    ...(fnHash ? { fn: [fnHash] } : {}),
                    ...(lnHash ? { ln: [lnHash] } : {}),
                  },
                  custom_data: { content_name: "Argos X Trial", currency: "BRL", value: 0 },
                }],
              };

              await fetch(
                `https://graph.facebook.com/v21.0/${internalWs.meta_pixel_id}/events?access_token=${internalWs.meta_conversions_token}`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(capiPayload) }
              );
              console.log("Meta CAPI CompleteRegistration sent for session:", session.id);
            }
          }
        } catch (capiErr) {
          console.warn("Meta CAPI CompleteRegistration error:", capiErr);
        }

        // Handle lead pack checkout
        if (sessionMeta.type === "lead_pack" && sessionMeta.pack_size) {
          const packSize = parseInt(sessionMeta.pack_size, 10);
          const workspaceId = sessionMeta.workspace_id;

          if (workspaceId && packSize) {
            const packPrices: Record<number, number> = { 1000: 17, 5000: 47, 20000: 97, 50000: 197 };

            await supabaseAdmin.from("lead_packs").insert({
              workspace_id: workspaceId,
              pack_size: packSize,
              price_paid: packPrices[packSize] || 0,
              stripe_item_id: subscriptionId,
              active: true,
            });

            console.log(`Lead pack +${packSize} activated for workspace ${workspaceId}`);
          }
          break;
        }

        // Normal plan checkout
        if (customerId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items?.data?.[0]?.price?.id || null;

          await createWorkspaceForCustomer(supabaseAdmin, customerId, subscriptionId, priceId);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = (subscription as any).items?.data?.[0]?.price?.id || null;

        // Update existing workspace if it exists
        const { data: existingWs } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (existingWs) {
          const env = {
            STRIPE_PRICE_ESSENCIAL: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
            STRIPE_PRICE_NEGOCIO: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
            STRIPE_PRICE_ESCALA: Deno.env.get("STRIPE_PRICE_ESCALA"),
          };
          const planConfig = getPlanConfig(priceId || "", env);

          await supabaseAdmin
            .from("workspaces")
            .update({
              subscription_status: "trialing",
              plan_type: "trialing",
              plan_name: planConfig.plan_name,
              lead_limit: planConfig.lead_limit,
              whatsapp_limit: planConfig.whatsapp_limit,
              user_limit: planConfig.user_limit,
              ai_interactions_limit: planConfig.ai_interactions_limit,
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId,
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
              blocked_at: null,
            })
            .eq("id", existingWs.id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status;
        const updates: Record<string, any> = {
          subscription_status: status,
          stripe_price_id: (subscription as any).items?.data?.[0]?.price?.id || null,
        };

        if (status === "active") {
          const env = {
            STRIPE_PRICE_ESSENCIAL: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
            STRIPE_PRICE_NEGOCIO: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
            STRIPE_PRICE_ESCALA: Deno.env.get("STRIPE_PRICE_ESCALA"),
          };
          const planConfig = getPlanConfig(updates.stripe_price_id || "", env);
          updates.plan_type = "active";
          updates.blocked_at = null;
          updates.plan_name = planConfig.plan_name;
          updates.lead_limit = planConfig.lead_limit;
          updates.whatsapp_limit = planConfig.whatsapp_limit;
          updates.user_limit = planConfig.user_limit;
          updates.ai_interactions_limit = planConfig.ai_interactions_limit;
        } else if (status === "past_due") {
          updates.plan_type = "past_due";
        } else if (status === "canceled") {
          updates.plan_type = "canceled";
          updates.blocked_at = new Date().toISOString();
        } else if (status === "trialing") {
          updates.plan_type = "trialing";
          updates.trial_end = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null;
        }

        // Also ensure stripe_subscription_id is stored
        updates.stripe_subscription_id = subscription.id;

        const { data: updatedRows, count } = await supabaseAdmin
          .from("workspaces")
          .update(updates)
          .eq("stripe_customer_id", subscription.customer as string)
          .select("id");

        if (!updatedRows || updatedRows.length === 0) {
          console.warn(`[stripe-webhook] subscription.updated: no workspace found for customer ${subscription.customer}, attempting invoice.payment_succeeded will handle it`);
        } else {
          console.log(`[stripe-webhook] subscription.updated: workspace ${updatedRows[0].id} updated to ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const subMeta = (subscription as any).metadata || {};

        // If it's a lead pack subscription being canceled, deactivate the pack
        if (subMeta.type === "lead_pack") {
          await supabaseAdmin
            .from("lead_packs")
            .update({ active: false })
            .eq("stripe_item_id", subscription.id);
          console.log(`Lead pack subscription ${subscription.id} deactivated`);
          break;
        }

        // Normal plan cancellation
        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "canceled",
            plan_type: "canceled",
            blocked_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", customerId);

        // Move internal CRM lead to "Cancelou Assinatura"
        try {
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          if (customer.email) {
            await moveInternalLead(supabaseAdmin, customer.email, STAGE_CANCELED, TAG_CANCELED);
          }
        } catch (e) {
          console.warn("Internal lead move on cancel error:", e);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("subscription_status, blocked_at")
          .eq("stripe_customer_id", customerId)
          .single();

        const updates: Record<string, any> = {
          subscription_status: "past_due",
        };

        if (ws?.subscription_status === "past_due" && !ws?.blocked_at) {
          updates.blocked_at = new Date().toISOString();
          updates.plan_type = "blocked";
        }

        await supabaseAdmin
          .from("workspaces")
          .update(updates)
          .eq("stripe_customer_id", customerId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Get current workspace to read stripe_price_id
        const { data: wsForLimits } = await supabaseAdmin
          .from("workspaces")
          .select("stripe_price_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        const envLimits = {
          STRIPE_PRICE_ESSENCIAL: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
          STRIPE_PRICE_NEGOCIO: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
          STRIPE_PRICE_ESCALA: Deno.env.get("STRIPE_PRICE_ESCALA"),
        };
        const paidPlanConfig = getPlanConfig(wsForLimits?.stripe_price_id || "", envLimits);

        await supabaseAdmin
          .from("workspaces")
          .update({
            subscription_status: "active",
            plan_type: "active",
            blocked_at: null,
            plan_name: paidPlanConfig.plan_name,
            lead_limit: paidPlanConfig.lead_limit,
            whatsapp_limit: paidPlanConfig.whatsapp_limit,
            user_limit: paidPlanConfig.user_limit,
            ai_interactions_limit: paidPlanConfig.ai_interactions_limit,
          })
          .eq("stripe_customer_id", customerId);

        // Move internal CRM lead to "Cliente Ativo"
        try {
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          if (customer.email) {
            const { data: ws } = await supabaseAdmin
              .from("workspaces")
              .select("stripe_price_id")
              .eq("stripe_customer_id", customerId)
              .maybeSingle();
            const env = {
              STRIPE_PRICE_ESSENCIAL: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
              STRIPE_PRICE_NEGOCIO: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
              STRIPE_PRICE_ESCALA: Deno.env.get("STRIPE_PRICE_ESCALA"),
            };
            const planConfig = getPlanConfig(ws?.stripe_price_id || "", env);
            await moveInternalLead(supabaseAdmin, customer.email, STAGE_ACTIVE, TAG_ACTIVE, planConfig.plan_name);
          }
        } catch (e) {
          console.warn("Internal lead move on payment error:", e);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
