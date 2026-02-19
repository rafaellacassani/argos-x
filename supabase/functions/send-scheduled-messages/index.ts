import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rawEvolutionApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const evolutionApiUrl = rawEvolutionApiUrl.replace(/\/manager\/?$/, "");
const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (fetchError) {
      console.error("[send-scheduled] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-scheduled] Processing ${pendingMessages.length} messages`);

    let sentCount = 0;
    let failCount = 0;

    for (const msg of pendingMessages) {
      try {
        let success = false;

        if (msg.channel_type === "whatsapp") {
          // Send via Evolution API
          const number = msg.phone_number || msg.remote_jid?.replace(/@s\.whatsapp\.net$/, "");
          if (!number || !msg.instance_name) {
            throw new Error("Missing WhatsApp routing info");
          }

          const evoRes = await fetch(
            `${evolutionApiUrl}/message/sendText/${msg.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: evolutionApiKey,
              },
              body: JSON.stringify({
                number,
                text: msg.message,
              }),
            }
          );

          if (!evoRes.ok) {
            const errData = await evoRes.json().catch(() => ({}));
            throw new Error(`Evolution API error ${evoRes.status}: ${JSON.stringify(errData)}`);
          }
          success = true;
        } else if (msg.channel_type === "meta_facebook" || msg.channel_type === "meta_instagram") {
          // Send via Meta Graph API
          if (!msg.meta_page_id || !msg.sender_id) {
            throw new Error("Missing Meta routing info");
          }

          // Fetch page token
          const { data: page, error: pageError } = await supabase
            .from("meta_pages")
            .select("page_id, page_access_token, instagram_account_id")
            .eq("id", msg.meta_page_id)
            .eq("is_active", true)
            .single();

          if (pageError || !page) {
            throw new Error("Meta page not found or inactive");
          }

          let graphUrl: string;
          let graphPayload: Record<string, unknown>;

          if (msg.channel_type === "meta_instagram") {
            graphUrl = `https://graph.facebook.com/v21.0/${page.instagram_account_id || page.page_id}/messages`;
            graphPayload = { recipient: { id: msg.sender_id }, message: { text: msg.message } };
          } else {
            graphUrl = `https://graph.facebook.com/v21.0/${page.page_id}/messages`;
            graphPayload = { recipient: { id: msg.sender_id }, message: { text: msg.message } };
          }

          const graphRes = await fetch(graphUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${page.page_access_token}`,
            },
            body: JSON.stringify(graphPayload),
          });

          if (!graphRes.ok) {
            const errData = await graphRes.json().catch(() => ({}));
            throw new Error(`Graph API error ${graphRes.status}: ${JSON.stringify(errData)}`);
          }
          success = true;
        } else {
          throw new Error(`Unknown channel_type: ${msg.channel_type}`);
        }

        if (success) {
          await supabase
            .from("scheduled_messages")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", msg.id);
          sentCount++;
        }
      } catch (err: any) {
        console.error(`[send-scheduled] Failed msg ${msg.id}:`, err.message);
        await supabase
          .from("scheduled_messages")
          .update({ status: "failed", error_message: err.message?.substring(0, 500) })
          .eq("id", msg.id);
        failCount++;
      }
    }

    console.log(`[send-scheduled] Done: ${sentCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ sent: sentCount, failed: failCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-scheduled] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
