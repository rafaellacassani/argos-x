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
    // --- AUTH CHECK ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { metaPageId, recipientId, message, messageType = "text", mediaUrl } = await req.json();

    // --- INPUT VALIDATION ---
    if (!metaPageId || !recipientId || !message) {
      return new Response(JSON.stringify({ error: "metaPageId, recipientId, and message are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof message !== "string" || message.length > 4000) {
      return new Response(JSON.stringify({ error: "Message must be under 4000 characters" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (mediaUrl && (typeof mediaUrl !== "string" || !mediaUrl.startsWith("https://"))) {
      return new Response(JSON.stringify({ error: "Invalid media URL" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch page info
    const { data: page, error: pageError } = await supabase
      .from("meta_pages")
      .select("id, page_id, page_access_token, platform, instagram_account_id, workspace_id")
      .eq("id", metaPageId)
      .eq("is_active", true)
      .single();

    if (pageError || !page) {
      return new Response(JSON.stringify({ error: "Meta page not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let graphPayload: Record<string, unknown>;
    let graphUrl: string;

    if (page.platform === "instagram" || page.instagram_account_id) {
      graphUrl = `https://graph.facebook.com/v21.0/${page.instagram_account_id || page.page_id}/messages`;
      graphPayload = { recipient: { id: recipientId }, message: { text: message } };
    } else {
      graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
      if (messageType === "image" && mediaUrl) {
        graphPayload = { recipient: { id: recipientId }, message: { attachment: { type: "image", payload: { url: mediaUrl, is_reusable: true } } } };
      } else {
        graphPayload = { recipient: { id: recipientId }, message: { text: message } };
      }
    }

    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${page.page_access_token}` },
      body: JSON.stringify(graphPayload),
    });

    const graphData = await graphRes.json();

    if (!graphRes.ok) {
      return new Response(JSON.stringify({ error: "Graph API error", details: graphData }), { status: graphRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const outboundMessageId = graphData.message_id || `out-${Date.now()}`;
    const platform = page.instagram_account_id ? "instagram" : "facebook";

    await supabase.from("meta_conversations").insert({
      meta_page_id: page.id, platform, sender_id: recipientId, message_id: outboundMessageId, content: message, message_type: messageType, media_url: mediaUrl, direction: "outbound", timestamp: new Date().toISOString(), raw_payload: graphData, workspace_id: page.workspace_id,
    });

    return new Response(JSON.stringify({ success: true, message_id: outboundMessageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[meta-send-message] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
