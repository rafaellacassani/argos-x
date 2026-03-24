import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { metaPageId, mediaId } = await req.json();
    if (!metaPageId || !mediaId) {
      return new Response(
        JSON.stringify({ error: "metaPageId and mediaId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-download-media] Downloading media ${mediaId} for page ${metaPageId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get access token from meta_pages
    const { data: metaPage, error: pageError } = await supabase
      .from("meta_pages")
      .select("id, page_access_token, page_id, workspace_id")
      .eq("id", metaPageId)
      .eq("is_active", true)
      .single();

    if (pageError || !metaPage) {
      return new Response(
        JSON.stringify({ error: "Meta page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to get a fresher token from whatsapp_cloud_connections
    const { data: cloudConn } = await supabase
      .from("whatsapp_cloud_connections")
      .select("access_token")
      .eq("phone_number_id", metaPage.page_id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const accessToken = cloudConn?.access_token || metaPage.page_access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "No access token available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get the media URL from Meta Graph API
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaInfoRes.ok) {
      const errText = await mediaInfoRes.text();
      console.error(`[meta-download-media] Failed to get media info: ${mediaInfoRes.status} ${errText}`);
      return new Response(
        JSON.stringify({ error: "Failed to get media info from Meta" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaInfo = await mediaInfoRes.json();
    const downloadUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type || "application/octet-stream";

    if (!downloadUrl) {
      return new Response(
        JSON.stringify({ error: "No download URL returned from Meta" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Download the actual media binary
    const mediaRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaRes.ok) {
      const errText = await mediaRes.text();
      console.error(`[meta-download-media] Failed to download media: ${mediaRes.status} ${errText}`);
      return new Response(
        JSON.stringify({ error: "Failed to download media from Meta" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const arrayBuffer = await mediaRes.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Chunk-based base64 encoding to avoid stack overflow on large files
    const CHUNK_SIZE = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.subarray(i, i + CHUNK_SIZE);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);

    console.log(`[meta-download-media] ✅ Downloaded ${bytes.length} bytes, mime: ${mimeType}`);

    return new Response(
      JSON.stringify({ base64, mimetype: mimeType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[meta-download-media] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
