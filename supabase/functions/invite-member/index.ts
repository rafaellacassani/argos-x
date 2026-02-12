import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserId = claimsData.claims.sub as string;

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is a workspace admin
    const { data: isAdmin } = await supabaseAdmin.rpc("is_any_workspace_admin", {
      _user_id: adminUserId,
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem convidar membros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, full_name, phone, role, workspace_id } = await req.json();

    if (!email || !full_name || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Email, nome e workspace são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["admin", "manager", "seller"];
    const memberRole = validRoles.includes(role) ? role : "seller";

    // Check if user already exists in this workspace
    const { data: existingMember } = await supabaseAdmin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace_id)
      .eq("invited_email", email)
      .maybeSingle();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: "Este email já foi convidado para este workspace" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { full_name, phone },
      });

    if (inviteError) {
      // If user already exists in auth, get their ID
      if (inviteError.message?.includes("already been registered") || inviteError.status === 422) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u) => u.email === email);

        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "Usuário já existe mas não foi possível encontrá-lo" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // User exists in auth - add to workspace
        const userId = existingUser.id;

        // Create workspace member
        await supabaseAdmin.from("workspace_members").insert({
          workspace_id,
          user_id: userId,
          role: memberRole,
          invited_email: email,
          accepted_at: new Date().toISOString(),
        });

        // Ensure profile exists
        const { data: existingProfile } = await supabaseAdmin
          .from("user_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingProfile) {
          await supabaseAdmin.from("user_profiles").insert({
            user_id: userId,
            full_name,
            phone: phone || null,
            email,
          });
        }

        // Ensure role exists
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: memberRole,
        });

        // Create notification settings
        await supabaseAdmin.from("notification_settings").insert({
          user_id: userId,
          workspace_id,
        });

        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            message: "Usuário existente adicionado ao workspace",
            already_registered: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error("Invite error:", inviteError);
      return new Response(
        JSON.stringify({ error: `Erro ao enviar convite: ${inviteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = inviteData.user.id;

    // Create user profile
    await supabaseAdmin.from("user_profiles").insert({
      user_id: userId,
      full_name,
      phone: phone || null,
      email,
    });

    // Create user role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: memberRole,
    });

    // Create workspace member (pending acceptance)
    await supabaseAdmin.from("workspace_members").insert({
      workspace_id,
      user_id: userId,
      role: memberRole,
      invited_email: email,
    });

    // Create default notification settings
    await supabaseAdmin.from("notification_settings").insert({
      user_id: userId,
      workspace_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: "Convite enviado com sucesso",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
