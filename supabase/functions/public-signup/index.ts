import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiting (per isolate)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3; // max 3 signups per IP per 10 minutes
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
    const { name, phone, email, companyName } = body;

    // Validate required fields
    if (!name || !phone || !email || !companyName) {
      return new Response(
        JSON.stringify({ error: "Todos os campos são obrigatórios: name, phone, email, companyName" }),
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
      // Check if user already has a workspace
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
    const randomPassword = crypto.randomUUID() + "Aa1!";

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
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
