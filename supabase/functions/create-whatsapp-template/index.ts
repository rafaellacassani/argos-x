import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { connectionId, name, language, category, components } = await req.json();

    if (!connectionId || !name || !language || !category || !components?.length) {
      return new Response(
        JSON.stringify({ error: "connectionId, name, language, category e components são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get cloud connection
    const { data: conn, error: connError } = await supabase
      .from("whatsapp_cloud_connections")
      .select("id, workspace_id, waba_id, access_token")
      .eq("id", connectionId)
      .eq("is_active", true)
      .single();

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Conexão não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create template via Meta Graph API
    const payload = {
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      language,
      category,
      components,
    };

    console.log("[create-whatsapp-template] Creating template:", JSON.stringify(payload));

    const res = await fetch(`https://graph.facebook.com/v21.0/${conn.waba_id}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("[create-whatsapp-template] Meta API error:", JSON.stringify(result));
      const metaError = result?.error?.message || result?.error?.error_user_msg || "Erro ao criar template no Meta";
      return new Response(
        JSON.stringify({ error: metaError, details: result }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-whatsapp-template] Created:", JSON.stringify(result));

    // Save locally
    const now = new Date().toISOString();
    await supabase.from("whatsapp_templates").upsert(
      {
        workspace_id: conn.workspace_id,
        cloud_connection_id: conn.id,
        template_id: result.id,
        template_name: payload.name,
        language,
        category,
        status: result.status || "PENDING",
        components,
        synced_at: now,
      },
      { onConflict: "workspace_id,template_id" }
    );

    return new Response(
      JSON.stringify({ success: true, template_id: result.id, status: result.status || "PENDING" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[create-whatsapp-template] Error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
