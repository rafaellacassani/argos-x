import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use anon client to verify user identity
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    // Use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user already has a workspace
    const { data: existingMember } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .limit(1)
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: "User already has a workspace" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create workspace
    const { data: workspace, error: wsError } = await adminClient
      .from("workspaces")
      .insert({ name: name.trim(), slug: `${slug}-${Date.now()}`, created_by: user.id })
      .select()
      .single();

    if (wsError) {
      console.error("Workspace insert error:", wsError);
      return new Response(JSON.stringify({ error: "Failed to create workspace" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add creator as admin member
    const { error: memberError } = await adminClient
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "admin",
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error("Member insert error:", memberError);
      // Rollback workspace
      await adminClient.from("workspaces").delete().eq("id", workspace.id);
      return new Response(JSON.stringify({ error: "Failed to add member" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ workspace }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
