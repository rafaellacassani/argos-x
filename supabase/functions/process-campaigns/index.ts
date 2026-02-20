import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBrazilTime(): Date {
  const now = new Date();
  // UTC-3
  return new Date(now.getTime() - 3 * 60 * 60 * 1000);
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- 1. Activate scheduled campaigns ---
    const { data: scheduledCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (scheduledCampaigns && scheduledCampaigns.length > 0) {
      for (const sc of scheduledCampaigns) {
        await supabase.from("campaigns").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", sc.id);
        console.log(`[process-campaigns] ▶️ Campaign ${sc.id} activated from scheduled`);
      }
    }

    // --- 2. Process running campaigns ---
    const { data: campaigns, error: campError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "running");

    if (campError) {
      console.error("[process-campaigns] ❌ Error fetching campaigns:", campError);
      throw campError;
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const brazilNow = getBrazilTime();
    const currentMinutes = brazilNow.getUTCHours() * 60 + brazilNow.getUTCMinutes();
    const currentDay = brazilNow.getUTCDay();
    let processed = 0;

    for (const campaign of campaigns) {
      try {
        // Check schedule_days
        const allowedDays: number[] = campaign.schedule_days || [1, 2, 3, 4, 5];
        if (!allowedDays.includes(currentDay)) {
          console.log(`[process-campaigns] ⏭️ Campaign ${campaign.id}: day ${currentDay} not allowed`);
          continue;
        }

        // Check time window
        if (campaign.schedule_start_time && campaign.schedule_end_time) {
          const startMin = timeToMinutes(campaign.schedule_start_time);
          const endMin = timeToMinutes(campaign.schedule_end_time);
          if (currentMinutes < startMin || currentMinutes > endMin) {
            console.log(`[process-campaigns] ⏭️ Campaign ${campaign.id}: outside time window`);
            continue;
          }
        }

        // Check interval
        if (campaign.last_sent_at) {
          const lastSent = new Date(campaign.last_sent_at).getTime();
          const elapsed = (Date.now() - lastSent) / 1000;
          if (elapsed < (campaign.interval_seconds || 30)) {
            continue;
          }
        }

        // Get next pending recipient
        const { data: recipients } = await supabase
          .from("campaign_recipients")
          .select("*")
          .eq("campaign_id", campaign.id)
          .eq("status", "pending")
          .order("position", { ascending: true })
          .limit(1);

        if (!recipients || recipients.length === 0) {
          // All done
          await supabase.from("campaigns").update({
            status: "completed",
            updated_at: new Date().toISOString(),
          }).eq("id", campaign.id);
          console.log(`[process-campaigns] ✅ Campaign ${campaign.id} completed`);
          continue;
        }

        const recipient = recipients[0];

        // Validate phone
        const cleanPhone = (recipient.phone || "").replace(/\D/g, "");
        if (cleanPhone.length < 10) {
          await supabase.from("campaign_recipients").update({
            status: "skipped",
            error_message: "Número inválido (< 10 dígitos)",
          }).eq("id", recipient.id);
          await supabase.from("campaigns").update({
            failed_count: (campaign.failed_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", campaign.id);
          continue;
        }

        // Send message
        const messageText = recipient.personalized_message || campaign.message_text;
        let sendSuccess = false;
        let sendError = "";

        try {
          if (campaign.attachment_url && campaign.attachment_type) {
            // Send media
            const mediaPayload: Record<string, unknown> = {
              number: cleanPhone,
              mediatype: campaign.attachment_type,
              media: campaign.attachment_url,
              caption: messageText,
            };

            const mediaRes = await fetch(`${evolutionApiUrl}/message/sendMedia/${campaign.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionApiKey,
              },
              body: JSON.stringify(mediaPayload),
            });

            if (!mediaRes.ok) {
              const errBody = await mediaRes.text();
              throw new Error(`Evolution API media error ${mediaRes.status}: ${errBody}`);
            }
            sendSuccess = true;
          } else {
            // Send text
            const textRes = await fetch(`${evolutionApiUrl}/message/sendText/${campaign.instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": evolutionApiKey,
              },
              body: JSON.stringify({ number: cleanPhone, text: messageText }),
            });

            if (!textRes.ok) {
              const errBody = await textRes.text();
              throw new Error(`Evolution API text error ${textRes.status}: ${errBody}`);
            }
            sendSuccess = true;
          }
        } catch (apiErr) {
          sendError = apiErr instanceof Error ? apiErr.message : String(apiErr);
          console.error(`[process-campaigns] ❌ Send failed for ${recipient.id}:`, sendError);
        }

        // Update recipient
        if (sendSuccess) {
          await supabase.from("campaign_recipients").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("id", recipient.id);

          await supabase.from("campaigns").update({
            sent_count: (campaign.sent_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", campaign.id);
        } else {
          await supabase.from("campaign_recipients").update({
            status: "failed",
            error_message: sendError.substring(0, 500),
          }).eq("id", recipient.id);

          await supabase.from("campaigns").update({
            failed_count: (campaign.failed_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", campaign.id);
        }

        processed++;
        console.log(`[process-campaigns] 📤 Campaign ${campaign.id}: sent to ${cleanPhone} (${sendSuccess ? "ok" : "fail"})`);
      } catch (campErr) {
        console.error(`[process-campaigns] ❌ Campaign ${campaign.id} error:`, campErr);
      }
    }

    console.log(`[process-campaigns] ✅ Processed ${processed} messages`);
    return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[process-campaigns] ❌ Fatal error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
