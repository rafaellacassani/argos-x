import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

async function sendWhatsApp(instanceName: string, phone: string, text: string): Promise<boolean> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !phone || !instanceName) return false;
  try {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return false;
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: cleanPhone, text, delay: 0 }),
    });
    if (!res.ok) {
      console.error(`[notify-new-lead] Send failed: ${await res.text()}`);
      return false;
    }
    await res.text();
    return true;
  } catch (e) {
    console.error("[notify-new-lead] Send error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, workspace_id } = await req.json();
    if (!lead_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "lead_id and workspace_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for bulk import: count recent leads in last minute
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .gte("created_at", oneMinAgo);

    // If bulk import (>5 in last minute), check if we already sent a bulk summary
    const isBulk = (recentCount || 0) > 5;

    if (isBulk) {
      // Check if bulk alert already sent in last 2 minutes
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentBulkAlerts } = await supabase
        .from("alert_log")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("alert_type", "new_lead")
        .is("lead_id", null)
        .gte("sent_at", twoMinAgo)
        .limit(1);

      if (recentBulkAlerts?.length) {
        // Already sent a bulk summary recently, skip
        return new Response(JSON.stringify({ message: "Bulk summary already sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get workspace alert config
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("alert_instance_name")
      .eq("id", workspace_id)
      .single();

    if (!workspace?.alert_instance_name) {
      return new Response(JSON.stringify({ message: "No alert instance configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, phone, source, instance_name, created_at")
      .eq("id", lead_id)
      .single();

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup: check if alert already sent for this specific lead
    if (!isBulk) {
      const { data: existingAlert } = await supabase
        .from("alert_log")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("alert_type", "new_lead")
        .eq("lead_id", lead_id)
        .limit(1);

      if (existingAlert?.length) {
        return new Response(JSON.stringify({ message: "Alert already sent for this lead" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get users with new_lead_alert_enabled
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_profile_id")
      .eq("workspace_id", workspace_id)
      .eq("new_lead_alert_enabled", true);

    if (!prefs?.length) {
      return new Response(JSON.stringify({ message: "No users with new lead alerts enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileIds = prefs.map((p: any) => p.user_profile_id);
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, personal_whatsapp")
      .in("id", profileIds);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ message: "No profiles with WhatsApp" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const hora = new Date(lead.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    for (const profile of profiles) {
      if (!profile.personal_whatsapp) continue;

      let message: string;
      if (isBulk) {
        message = `🆕 *${recentCount} novos leads recebidos!*\n\nOrigem: ${lead.source || "—"}\nPeríodo: último minuto\n\nAcesse o ArgoX para ver todos.`;
      } else {
        message = `🆕 *Novo lead!*\n\n*${lead.name}* (${lead.phone || "sem telefone"})\nOrigem: ${lead.source || "—"}\n${lead.instance_name ? `Instância: ${lead.instance_name}\n` : ""}Recebido agora às ${hora}`;
      }

      const ok = await sendWhatsApp(workspace.alert_instance_name, profile.personal_whatsapp, message);
      if (ok) {
        sent++;
        await supabase.from("alert_log").insert({
          workspace_id,
          user_profile_id: profile.id,
          alert_type: "new_lead",
          lead_id: isBulk ? null : lead_id,
          message_preview: message.slice(0, 200),
        });
      }
    }

    console.log(`[notify-new-lead] Sent ${sent} alerts for lead ${lead_id}`);
    return new Response(JSON.stringify({ alerts_sent: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-new-lead] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
