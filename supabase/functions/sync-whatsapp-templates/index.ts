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
    // Auth check
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
    const { connectionId } = await req.json();

    if (!connectionId) {
      return new Response(JSON.stringify({ error: "connectionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the cloud connection
    const { data: conn, error: connError } = await supabase
      .from("whatsapp_cloud_connections")
      .select("id, workspace_id, waba_id, access_token")
      .eq("id", connectionId)
      .eq("is_active", true)
      .single();

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch templates from Meta Graph API
    let allTemplates: any[] = [];
    let url: string | null = `https://graph.facebook.com/v21.0/${conn.waba_id}/message_templates?limit=100`;

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${conn.access_token}` },
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[sync-whatsapp-templates] Graph API error:", errBody);
        return new Response(
          JSON.stringify({ error: "Failed to fetch templates from Meta", details: errBody }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await res.json();
      allTemplates = allTemplates.concat(data.data || []);
      url = data.paging?.next || null;
    }

    console.log(`[sync-whatsapp-templates] Fetched ${allTemplates.length} templates from Meta`);

    // Upsert templates into DB
    const now = new Date().toISOString();
    let upserted = 0;

    for (const tpl of allTemplates) {
      const { error: upsertError } = await supabase
        .from("whatsapp_templates")
        .upsert(
          {
            workspace_id: conn.workspace_id,
            cloud_connection_id: conn.id,
            template_id: tpl.id,
            template_name: tpl.name,
            language: tpl.language,
            category: tpl.category || "MARKETING",
            status: tpl.status || "PENDING",
            components: tpl.components || [],
            synced_at: now,
          },
          { onConflict: "workspace_id,template_id" }
        );

      if (upsertError) {
        console.error(`[sync-whatsapp-templates] Upsert error for ${tpl.name}:`, upsertError);
      } else {
        upserted++;
      }
    }

    // Remove templates that no longer exist in Meta
    const metaTemplateIds = allTemplates.map((t: any) => t.id);
    if (metaTemplateIds.length > 0) {
      await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("cloud_connection_id", conn.id)
        .not("template_id", "in", `(${metaTemplateIds.join(",")})`);
    }

    return new Response(
      JSON.stringify({ success: true, total: allTemplates.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[sync-whatsapp-templates] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
