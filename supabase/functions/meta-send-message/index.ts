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
    const body = await req.json();
    const { action } = body;

    // --- DELETE MESSAGE ---
    if (action === "delete") {
      const { metaPageId, messageId } = body;
      if (!metaPageId || !messageId) {
        return new Response(JSON.stringify({ error: "metaPageId and messageId are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: page, error: pageError } = await supabase
        .from("meta_pages")
        .select("id, page_id, page_access_token, platform, instagram_account_id, workspace_id")
        .eq("id", metaPageId)
        .eq("is_active", true)
        .single();

      if (pageError || !page) {
        return new Response(JSON.stringify({ error: "Meta page not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Use Graph API to delete the message
      const deleteUrl = `https://graph.facebook.com/v21.0/${messageId}`;
      const deleteRes = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${page.page_access_token}` },
      });

      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        console.error("[meta-send-message] Delete error:", deleteData);
        return new Response(JSON.stringify({ error: "Failed to delete message", details: deleteData }), { status: deleteRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- SEND MESSAGE ---
    const { metaPageId, recipientId, message, messageType = "text", mediaUrl } = body;

    // --- INPUT VALIDATION ---
    const isMediaType = messageType && messageType !== "text";
    if (!metaPageId || !recipientId) {
      return new Response(JSON.stringify({ error: "metaPageId and recipientId are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // For media (audio/image/document/video) message text is optional (caption); mediaUrl is required.
    if (isMediaType) {
      if (!mediaUrl) {
        return new Response(JSON.stringify({ error: "mediaUrl is required for media messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      if (!message || typeof message !== "string") {
        return new Response(JSON.stringify({ error: "message is required for text messages" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (message && (typeof message !== "string" || message.length > 4000)) {
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
      // Instagram
      graphUrl = `https://graph.facebook.com/v21.0/${page.instagram_account_id || page.page_id}/messages`;
      graphPayload = { recipient: { id: recipientId }, message: { text: message } };
    } else if (page.platform === "whatsapp_business") {
      // WhatsApp Cloud API
      graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
      if (messageType === "image" && mediaUrl) {
        graphPayload = {
          messaging_product: "whatsapp",
          to: recipientId,
          type: "image",
          image: { link: mediaUrl, caption: message || undefined },
        };
      } else if (messageType === "audio" && mediaUrl) {
        graphPayload = {
          messaging_product: "whatsapp",
          to: recipientId,
          type: "audio",
          audio: { link: mediaUrl },
        };
      } else if (messageType === "document" && mediaUrl) {
        graphPayload = {
          messaging_product: "whatsapp",
          to: recipientId,
          type: "document",
          document: { link: mediaUrl, caption: message || undefined },
        };
      } else {
        graphPayload = {
          messaging_product: "whatsapp",
          to: recipientId,
          type: "text",
          text: { body: message },
        };
      }
    } else {
      // Facebook Messenger
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
      const errCode = graphData?.error?.code;
      const errSubcode = graphData?.error?.error_subcode;
      // 190 = OAuthException (token expired/invalid). Subcodes 463/467 = expired/invalid session.
      const isTokenExpired = errCode === 190 || errSubcode === 463 || errSubcode === 467;
      if (isTokenExpired) {
        // Mark page as needing reconnection so UI can surface the alert
        try {
          await supabase.from("meta_pages").update({ is_active: false }).eq("id", page.id);
        } catch (_e) { /* non-fatal */ }
        return new Response(
          JSON.stringify({
            error: "token_expired",
            message: "Token da página Meta expirou. Reconecte sua conta em Configurações → Integrações.",
            details: graphData,
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "Graph API error", details: graphData }), { status: graphRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const outboundMessageId = graphData.message_id || `out-${Date.now()}`;
    const platform = page.instagram_account_id ? "instagram" 
      : (page.platform === "whatsapp_business" ? "whatsapp_business" : "facebook");

    await supabase.from("meta_conversations").insert({
      meta_page_id: page.id, platform, sender_id: recipientId, message_id: outboundMessageId, content: message, message_type: messageType, media_url: mediaUrl, direction: "outbound", timestamp: new Date().toISOString(), raw_payload: graphData, workspace_id: page.workspace_id,
    });

    return new Response(JSON.stringify({ success: true, message_id: outboundMessageId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[meta-send-message] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
