import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { metaPageId, recipientId, message, messageType = "text", mediaUrl } = await req.json();

    if (!metaPageId || !recipientId || !message) {
      return new Response(
        JSON.stringify({ error: "metaPageId, recipientId, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch page info
    const { data: page, error: pageError } = await supabase
      .from("meta_pages")
      .select("id, page_id, page_access_token, platform, instagram_account_id")
      .eq("id", metaPageId)
      .eq("is_active", true)
      .single();

    if (pageError || !page) {
      console.error("[meta-send-message] Page not found:", pageError);
      return new Response(
        JSON.stringify({ error: "Meta page not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-send-message] Sending to ${recipientId} via ${page.platform} (page: ${page.page_id})`);

    let graphPayload: any;
    let graphUrl: string;

    if (page.platform === "instagram" || page.instagram_account_id) {
      // Instagram DM via Graph API
      graphUrl = `https://graph.facebook.com/v21.0/${page.instagram_account_id || page.page_id}/messages`;
      graphPayload = {
        recipient: { id: recipientId },
        message: { text: message },
      };
    } else {
      // Facebook Messenger
      graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
      if (messageType === "image" && mediaUrl) {
        graphPayload = {
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "image",
              payload: { url: mediaUrl, is_reusable: true },
            },
          },
        };
      } else {
        graphPayload = {
          recipient: { id: recipientId },
          message: { text: message },
        };
      }
    }

    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${page.page_access_token}`,
      },
      body: JSON.stringify(graphPayload),
    });

    const graphData = await graphRes.json();
    console.log("[meta-send-message] Graph API response:", JSON.stringify(graphData));

    if (!graphRes.ok) {
      return new Response(
        JSON.stringify({ error: "Graph API error", details: graphData }),
        { status: graphRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save outbound message to meta_conversations
    const outboundMessageId = graphData.message_id || `out-${Date.now()}`;
    const platform = page.instagram_account_id ? "instagram" : "facebook";

    const { error: saveError } = await supabase.from("meta_conversations").insert({
      meta_page_id: page.id,
      platform,
      sender_id: recipientId,
      message_id: outboundMessageId,
      content: message,
      message_type: messageType,
      media_url: mediaUrl,
      direction: "outbound",
      timestamp: new Date().toISOString(),
      raw_payload: graphData,
    });

    if (saveError) {
      console.error("[meta-send-message] Error saving outbound message:", saveError);
    }

    return new Response(
      JSON.stringify({ success: true, message_id: outboundMessageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-send-message] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
