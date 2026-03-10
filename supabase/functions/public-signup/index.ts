import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (per isolate)
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

// Internal CRM constants (admin workspace)
const INTERNAL_WS = "41efdc6d-d4ba-4589-9761-7438a5911d57";
const STAGE_TRIAL = "fc4b4ff8-fbb8-40f3-ad51-9f6564b6ae3b";
const TAG_TRIAL = "a57de997-9b5c-467d-ad1e-8b50e0d07958";

async function createInternalLead(
  supabaseAdmin: any,
  contact: { name: string; email: string; phone: string }
) {
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
      source: "signup_publico",
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
}

async function sendWelcomeEmail(email: string, name: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) return;

  const loginLink = "https://argosx.com.br/auth";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:#0F172A;padding:24px 32px;text-align:center">
<img src="https://argosx.com.br/favicon.png" width="40" height="40" alt="Argos X" style="display:inline-block;vertical-align:middle;margin-right:8px">
<span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle">Argos X</span>
</td></tr>
<tr><td style="padding:32px">
<h2 style="color:#0F172A;margin:0 0 16px">Bem-vindo ao Argos X, ${name}! 🚀</h2>
<p style="color:#475569;font-size:15px;line-height:1.6">Sua conta foi criada com sucesso! Você tem <strong>7 dias de teste grátis</strong> para explorar todas as funcionalidades.</p>
<p style="color:#475569;font-size:15px;line-height:1.6">Sua conta já está pronta para uso. Acesse agora:</p>
<div style="text-align:center;margin:28px 0">
<a href="${loginLink}" style="background:#0171C3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Acessar o Argos X</a>
</div>
<p style="color:#475569;font-size:15px;line-height:1.6">O que você pode fazer agora:</p>
<ul style="color:#475569;font-size:15px;line-height:1.8">
<li>📱 Conectar seu WhatsApp</li>
<li>🤖 Configurar seu agente de IA</li>
<li>📊 Organizar seu funil de vendas</li>
</ul>
<p style="color:#94a3b8;font-size:13px;margin-top:24px">Qualquer dúvida, estamos aqui para ajudar!</p>
</td></tr>
<tr><td style="padding:16px 32px 24px;text-align:center;color:#94a3b8;font-size:12px">
© ${new Date().getFullYear()} Argos X — CRM Inteligente
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Argos X <noreply@argosx.com.br>",
        to: [email],
        subject: `Bem-vindo ao Argos X, ${name}! 🚀`,
        html,
      }),
    });
  } catch (e) {
    console.warn("Welcome email failed:", e);
  }
}

async function sendWelcomeWhatsApp(phone: string, name: string) {
  const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

  // Get the reactivation config to find the WhatsApp instance
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: config } = await supabaseAdmin
    .from("reactivation_cadence_config")
    .select("whatsapp_instance_name")
    .limit(1)
    .single();

  if (!config?.whatsapp_instance_name) return;

  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }

  const message = `Olá, ${name}! 👋\n\nBem-vindo ao *Argos X*! 🚀\n\nSua conta foi criada com sucesso. Você tem *7 dias de teste grátis*.\n\nAcesse agora e defina sua senha:\n👉 https://argosx.com.br/auth\n\nQualquer dúvida, é só responder aqui! 😊`;

  const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

  try {
    await fetch(`${apiUrl}/message/sendText/${config.whatsapp_instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    });
  } catch (e) {
    console.warn("Welcome WhatsApp failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { name, phone, email, companyName, password } = body;

    // Validate required fields
    if (!name || !phone || !email || !companyName || !password) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios: name, phone, email, companyName, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Email inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Length validations
    if (name.length > 100 || email.length > 255 || companyName.length > 100 || phone.length > 30) {
      return new Response(
        JSON.stringify({ error: "Campos excedem o tamanho máximo permitido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if email already registered
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUsers?.users?.find((u: any) => u.email === email);
    if (existingUser) {
      const { data: existingMember } = await supabaseAdmin
        .from("workspace_members")
        .select("id")
        .eq("user_id", existingUser.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .single();

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "Este email já possui uma conta. Faça login em /auth." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Create user in Supabase Auth
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Update password for existing user who hasn't fully onboarded
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

    // 2. Create user_profiles (upsert)
    const cleanPhone = phone.replace(/\D/g, "");
    await supabaseAdmin.from("user_profiles").upsert(
      { user_id: userId, full_name: name, email, phone: cleanPhone || null },
      { onConflict: "user_id" }
    );

    // 3. Create workspace
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .insert({
        name: companyName,
        slug: `${slug}-${Date.now()}`,
        created_by: userId,
        plan_name: "gratuito",
        plan_type: "trialing",
        subscription_status: "trialing",
        trial_end: trialEnd.toISOString(),
        lead_limit: 300,
        whatsapp_limit: 1,
        user_limit: 1,
        ai_interactions_limit: 100,
      })
      .select()
      .single();

    if (wsError) throw wsError;

    // 4. Add user as admin member
    await supabaseAdmin.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: "admin",
      accepted_at: new Date().toISOString(),
    });

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

    // 6. Save invite record
    await supabaseAdmin.from("client_invites").insert({
      email,
      full_name: name,
      phone: cleanPhone || null,
      plan: "gratuito",
      invite_type: "public_signup",
      status: "completed",
      workspace_id: workspace.id,
      created_by: userId,
    });

    // 7. Send welcome email + WhatsApp (fire-and-forget)
    sendWelcomeEmail(email, name).catch((e) => console.warn("Welcome email error:", e));
    if (cleanPhone) {
      sendWelcomeWhatsApp(cleanPhone, name).catch((e) => console.warn("Welcome WA error:", e));
    }

    // 8. Create lead in internal admin CRM (fire-and-forget)
    createInternalLead(supabaseAdmin, { name, email, phone: cleanPhone }).catch(
      (e) => console.warn("Internal lead creation error:", e)
    );

    return new Response(
      JSON.stringify({ success: true, email, workspaceId: workspace.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("public-signup error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
