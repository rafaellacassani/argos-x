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

        // Get next pending recipient (join lead name for template fallback)
        const { data: recipients } = await supabase
          .from("campaign_recipients")
          .select("*, leads(name)")
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
        let leadName = (recipient as any).leads?.name || "";

        // Robust fallback: if join didn't work, fetch lead name separately
        if (!leadName && recipient.lead_id) {
          const { data: leadData } = await supabase
            .from("leads")
            .select("name")
            .eq("id", recipient.lead_id)
            .single();
          leadName = leadData?.name || "";
        }

        // Ultimate fallback: never send empty parameter
        if (!leadName) {
          leadName = "Cliente";
        }

        // Determine which instance to use (round-robin or single)
        const instanceNames: string[] = (campaign.instance_names as string[]) || [];
        let currentInstanceName = campaign.instance_name;
        let nextInstanceIndex = campaign.last_instance_index || 0;

        if (instanceNames.length >= 2) {
          const idx = nextInstanceIndex % instanceNames.length;
          currentInstanceName = instanceNames[idx];
          nextInstanceIndex = idx + 1;
        }

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

        // Check if this campaign uses a WABA template
        const isTemplateCampaign = !!campaign.template_id;
        let sendSuccess = false;
        let sendError = "";

        try {
          if (isTemplateCampaign) {
            // --- WABA Template sending via Graph API ---
            const { data: tpl } = await supabase
              .from("whatsapp_templates")
              .select("template_name, language, components, cloud_connection_id")
              .eq("id", campaign.template_id)
              .single();

            if (!tpl) throw new Error("Template not found");

            const { data: conn } = await supabase
              .from("whatsapp_cloud_connections")
              .select("phone_number_id, access_token")
              .eq("id", tpl.cloud_connection_id)
              .single();

            if (!conn) throw new Error("Cloud connection not found");

            // Build template components with variables
            const templateVars: { key: string; value: string }[] = (campaign.template_variables as any[]) || [];
            const bodyComponent = (tpl.components as any[]).find((c: any) => c.type === "BODY");
            const bodyParams: any[] = [];

            if (bodyComponent?.text) {
              const matches = bodyComponent.text.match(/\{\{[^}]+\}\}/g) || [];
              for (const match of matches) {
                const mapping = templateVars.find(v => v.key === match);
                let paramValue = mapping?.value || "";
                // Replace shortcodes with lead data
                if (paramValue === "#nome#") paramValue = leadName;
                else if (paramValue === "#empresa#") paramValue = "";
                else if (paramValue === "#telefone#") paramValue = cleanPhone;
                else if (paramValue === "#email#") paramValue = "";
                // Fallback: if no mapping exists, use lead name as default (most common variable)
                if (!paramValue && !mapping) paramValue = leadName;
                bodyParams.push({ type: "text", text: paramValue || match });
              }
            }

            const templatePayload: any = {
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: "template",
              template: {
                name: tpl.template_name,
                language: { code: tpl.language },
                ...(bodyParams.length > 0 ? {
                  components: [{ type: "body", parameters: bodyParams }]
                } : {}),
              },
            };

            const graphRes = await fetch(
              `https://graph.facebook.com/v21.0/${conn.phone_number_id}/messages`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${conn.access_token}`,
                },
                body: JSON.stringify(templatePayload),
              }
            );

            if (!graphRes.ok) {
              const errBody = await graphRes.text();
              throw new Error(`Graph API error ${graphRes.status}: ${errBody}`);
            }
            await graphRes.json(); // consume body
            sendSuccess = true;
          } else if (campaign.attachment_url && campaign.attachment_type) {
            // Send media via Evolution API
            const messageText = recipient.personalized_message || campaign.message_text;
            const mediaPayload: Record<string, unknown> = {
              number: cleanPhone,
              mediatype: campaign.attachment_type,
              media: campaign.attachment_url,
              caption: messageText,
            };

            const mediaRes = await fetch(`${evolutionApiUrl}/message/sendMedia/${currentInstanceName}`, {
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
            // Send text via Evolution API
            const messageText = recipient.personalized_message || campaign.message_text;
            const textRes = await fetch(`${evolutionApiUrl}/message/sendText/${currentInstanceName}`, {
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
            last_instance_index: nextInstanceIndex,
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
            last_instance_index: nextInstanceIndex,
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
