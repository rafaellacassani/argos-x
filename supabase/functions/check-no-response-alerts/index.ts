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

const MAX_ALERTS_PER_RUN = 50;
const DEDUP_HOURS = 2;

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
      const err = await res.text();
      console.error(`[no-response-alerts] Send failed: ${err}`);
      return false;
    }
    await res.text();
    return true;
  } catch (e) {
    console.error("[no-response-alerts] Send error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get workspaces with alert instance configured
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, alert_instance_name")
      .not("alert_instance_name", "is", null);

    if (wsErr) throw wsErr;
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces with alerts configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const ws of workspaces) {
      if (totalSent >= MAX_ALERTS_PER_RUN) break;

      const alertInstance = ws.alert_instance_name;

      // 2. Get all notification_preferences with no_response_enabled
      const { data: prefs, error: prefsErr } = await supabase
        .from("notification_preferences")
        .select("user_profile_id, no_response_minutes, manager_report_enabled")
        .eq("workspace_id", ws.id)
        .eq("no_response_enabled", true);

      if (prefsErr || !prefs?.length) continue;

      // Get user profiles with personal_whatsapp
      const profileIds = prefs.map((p: any) => p.user_profile_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, personal_whatsapp")
        .in("id", profileIds);

      if (!profiles?.length) continue;

      // Get roles for these users
      const userIds = profiles.map((p: any) => p.user_id);
      const { data: roles } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", ws.id)
        .in("user_id", userIds);

      const roleMap = new Map<string, string>();
      (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      // Get funnel stages to identify loss/trash stages
      const { data: lossStages } = await supabase
        .from("funnel_stages")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("is_loss_stage", true);

      const lossStageIds = new Set((lossStages || []).map((s: any) => s.id));

      // Get all active leads for this workspace
      const { data: allLeads } = await supabase
        .from("leads")
        .select("id, name, phone, stage_id, responsible_user, updated_at, whatsapp_jid, instance_name")
        .eq("workspace_id", ws.id)
        .eq("status", "active");

      if (!allLeads?.length) continue;

      // Filter out leads in loss stages
      const activeLeads = allLeads.filter((l: any) => !lossStageIds.has(l.stage_id));

      // Get stage names for context
      const stageIds = [...new Set(activeLeads.map((l: any) => l.stage_id))];
      const { data: stagesData } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .in("id", stageIds);

      const stageNameMap = new Map<string, string>();
      (stagesData || []).forEach((s: any) => stageNameMap.set(s.id, s.name));

      // Check recent alerts to avoid duplicates
      const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();
      const { data: recentAlerts } = await supabase
        .from("alert_log")
        .select("user_profile_id, lead_id")
        .eq("workspace_id", ws.id)
        .eq("alert_type", "no_response")
        .gte("sent_at", dedupCutoff);

      const alertedSet = new Set(
        (recentAlerts || []).map((a: any) => `${a.user_profile_id}:${a.lead_id}`)
      );

      // Collect alerts for managers/admins
      const managerAlerts = new Map<string, Array<{ lead: any; sellerName: string; minutes: number }>>();

      // Process seller alerts
      for (const pref of prefs) {
        if (totalSent >= MAX_ALERTS_PER_RUN) break;

        const profile = profiles.find((p: any) => p.id === pref.user_profile_id);
        if (!profile?.personal_whatsapp) continue;

        const userRole = roleMap.get(profile.user_id);
        const minutes = pref.no_response_minutes || 30;
        const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        if (userRole === "seller") {
          // Find leads assigned to this seller that haven't been updated
          const sellerLeads = activeLeads.filter(
            (l: any) => l.responsible_user === profile.id && l.updated_at < cutoff
          );

          for (const lead of sellerLeads) {
            if (totalSent >= MAX_ALERTS_PER_RUN) break;
            const key = `${profile.id}:${lead.id}`;
            if (alertedSet.has(key)) continue;

            const minutesAgo = Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 60000);
            const stageName = stageNameMap.get(lead.stage_id) || "—";

            const message = `⚠️ *Lead sem resposta*\n\nO lead *${lead.name}* (${lead.phone || "sem telefone"}) está aguardando resposta há *${minutesAgo} minutos*.\n\nFase: ${stageName}\n\n👉 Responda agora pelo ArgoX`;

            const sent = await sendWhatsApp(alertInstance, profile.personal_whatsapp, message);
            if (sent) {
              totalSent++;
              alertedSet.add(key);
              await supabase.from("alert_log").insert({
                workspace_id: ws.id,
                user_profile_id: profile.id,
                alert_type: "no_response",
                lead_id: lead.id,
                message_preview: message.slice(0, 200),
              });
            }
          }
        }

        // For admins/managers with team no-response alert
        if ((userRole === "admin" || userRole === "manager") && pref.manager_report_enabled) {
          // Collect all leads without response from sellers
          const teamLeads = activeLeads.filter(
            (l: any) => l.responsible_user && l.responsible_user !== profile.id && l.updated_at < cutoff
          );

          if (teamLeads.length > 0) {
            // Group by seller
            const byResponsible = new Map<string, any[]>();
            for (const lead of teamLeads) {
              const arr = byResponsible.get(lead.responsible_user) || [];
              arr.push(lead);
              byResponsible.set(lead.responsible_user, arr);
            }

            // Get seller names
            const responsibleIds = [...byResponsible.keys()];
            const { data: sellerProfiles } = await supabase
              .from("user_profiles")
              .select("id, full_name")
              .in("id", responsibleIds);

            const sellerNameMap = new Map<string, string>();
            (sellerProfiles || []).forEach((p: any) => sellerNameMap.set(p.id, p.full_name));

            // Check dedup for manager summary (use null lead_id)
            const managerKey = `${profile.id}:null`;
            if (!alertedSet.has(managerKey)) {
              let summaryLines: string[] = [];
              let totalLeadsWaiting = 0;

              for (const [sellerId, leads] of byResponsible) {
                const sellerName = sellerNameMap.get(sellerId) || "Vendedor";
                summaryLines.push(`\n*${sellerName}:*`);
                for (const lead of leads.slice(0, 5)) {
                  const minutesAgo = Math.round((Date.now() - new Date(lead.updated_at).getTime()) / 60000);
                  summaryLines.push(`  • ${lead.name} — ${minutesAgo}min sem resposta`);
                  totalLeadsWaiting++;
                }
                if (leads.length > 5) {
                  summaryLines.push(`  ... e mais ${leads.length - 5}`);
                  totalLeadsWaiting += leads.length - 5;
                }
              }

              const message = `⚠️ *Leads sem resposta da equipe*\n${summaryLines.join("\n")}\n\nTotal: *${totalLeadsWaiting} leads* aguardando resposta`;

              const sent = await sendWhatsApp(alertInstance, profile.personal_whatsapp, message);
              if (sent) {
                totalSent++;
                alertedSet.add(managerKey);
                await supabase.from("alert_log").insert({
                  workspace_id: ws.id,
                  user_profile_id: profile.id,
                  alert_type: "no_response",
                  lead_id: null,
                  message_preview: message.slice(0, 200),
                });
              }
            }
          }
        }
      }
    }

    console.log(`[no-response-alerts] Total alerts sent: ${totalSent}`);
    return new Response(JSON.stringify({ alerts_sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[no-response-alerts] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
