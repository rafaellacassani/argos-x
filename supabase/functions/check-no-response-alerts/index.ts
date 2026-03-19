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
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return false;
    if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }
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

function getFollowupDelayMs(value: number, unit: string): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours": return value * 3600 * 1000;
    case "days": return value * 86400 * 1000;
    default: return value * 60 * 1000;
  }
}

// --- Find start node ---
function findStartNode(nodes: any[], edges: any[]): any | null {
  const targetIds = new Set(edges.map((e: any) => e.target));
  return nodes.find((n: any) => !targetIds.has(n.id)) || null;
}

// --- Get next node ---
function getNextNode(currentId: string, nodes: any[], edges: any[], label?: string): any | null {
  const matchingEdges = edges.filter((e: any) => e.source === currentId);
  let edge: any = null;
  if (label) {
    edge = matchingEdges.find((e: any) => {
      const handle = (e.sourceHandle || "").toLowerCase();
      const edgeLabel = (e.label || "").toLowerCase();
      const target = label.toLowerCase();
      return handle === target || edgeLabel === target;
    });
    if (!edge && (label === "true" || label === "false")) {
      const handleName = label === "true" ? "yes" : "no";
      const labelName = label === "true" ? "sim" : "não";
      edge = matchingEdges.find((e: any) =>
        (e.sourceHandle || "").toLowerCase() === handleName ||
        (e.label || "").toLowerCase() === labelName
      );
    }
  }
  if (!edge) edge = matchingEdges[0];
  if (!edge) return null;
  return nodes.find((n: any) => n.id === edge.target) || null;
}

// --- Variable substitution ---
function replaceVars(text: string, lead: Record<string, unknown>, instanceName: string): string {
  return text
    .replace(/\{\{lead\.name\}\}/gi, (lead.name as string) || "")
    .replace(/\{\{lead\.phone\}\}/gi, (lead.phone as string) || "")
    .replace(/\{\{lead\.email\}\}/gi, (lead.email as string) || "")
    .replace(/\{\{lead\.company\}\}/gi, (lead.company as string) || "")
    .replace(/\{\{instance\}\}/gi, instanceName);
}

function jidToNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");
}

// --- Migrate wait conditions ---
function migrateWaitConditionsBackend(data: any): any[] {
  if (Array.isArray(data.conditions) && data.conditions.length > 0) return data.conditions;
  const waitMode = data.wait_mode || "timer";
  if (waitMode === "message" || data.wait_for === "message" || data.wait_mode === "wait_message") {
    return [{ id: "legacy_msg", type: "message_received", config: {}, order: 0 }];
  }
  if (waitMode === "business_hours" || data.wait_for === "business_hours") {
    return [{ id: "legacy_bh", type: "business_hours", config: { days: data.days, start: data.start, end: data.end }, order: 0 }];
  }
  return [{ id: "legacy_timer", type: "timer", config: { seconds: Number(data.seconds || data.duration || 5) }, order: 0 }];
}

// --- Resume flow from a specific node (simplified for cron context) ---
async function resumeFlowFromNode(
  supabase: ReturnType<typeof createClient>,
  botId: string,
  lead: any,
  startNodeId: string,
  instanceName: string,
  workspaceId: string
) {
  const { data: bot } = await supabase.from("salesbots").select("flow_data").eq("id", botId).single();
  if (!bot?.flow_data) return;

  const flowData = bot.flow_data as any;
  const nodes = flowData.nodes || [];
  const edges = flowData.edges || [];

  let currentNode = nodes.find((n: any) => n.id === startNodeId);
  let executed = 0;
  const maxNodes = 50;

  while (currentNode && executed < maxNodes) {
    executed++;
    const nodeType = currentNode.type || "";

    try {
      switch (nodeType) {
        case "send_message": {
          const rawText = currentNode.data?.message || currentNode.data?.text || "";
          if (rawText) {
            const nodeInstance = currentNode.data?.instanceName || "";
            const effectiveInstance = instanceName || nodeInstance;
            const text = replaceVars(rawText, lead, effectiveInstance);
            const number = jidToNumber(lead.whatsapp_jid || lead.phone || "");
            if (number && effectiveInstance) {
              await sendWhatsApp(effectiveInstance, number, text);
              await supabase.from("bot_execution_logs").insert({
                bot_id: botId, lead_id: lead.id, node_id: currentNode.id,
                status: "success", message: text.substring(0, 200), workspace_id: workspaceId,
              });
            }
          }
          break;
        }

        case "wait": {
          // Enqueue new wait conditions and stop
          const conditions = migrateWaitConditionsBackend(currentNode.data || {});
          for (const cond of conditions) {
            const targetEdge = edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === cond.id);
            const fallbackEdge = conditions.length === 1 ? edges.find((e: any) => e.source === currentNode.id) : null;
            const edge = targetEdge || fallbackEdge;
            if (!edge) continue;

            let executeAt: string | null = null;
            if (cond.type === "timer") {
              const delaySec = Number(cond.config?.seconds || 0);
              if (delaySec > 0) executeAt = new Date(Date.now() + delaySec * 1000).toISOString();
            } else if (cond.type === "business_hours") {
              executeAt = new Date(Date.now() + 86400000).toISOString(); // simplified
            }

            await supabase.from("salesbot_wait_queue").insert({
              workspace_id: workspaceId, bot_id: botId, lead_id: lead.id,
              wait_node_id: currentNode.id, target_node_id: edge.target,
              condition_id: cond.id, condition_type: cond.type,
              session_id: lead.whatsapp_jid || "", execute_at: executeAt, status: "pending",
            });
          }
          return; // Stop execution — paused at wait
        }

        case "tag": {
          const action = currentNode.data?.action || "add";
          const tagName = currentNode.data?.tag_name || currentNode.data?.tagName || "";
          if (tagName) {
            const { data: tag } = await supabase.from("lead_tags").select("id").eq("workspace_id", workspaceId).ilike("name", tagName).single();
            if (tag) {
              if (action === "add") {
                await supabase.from("lead_tag_assignments").upsert({ lead_id: lead.id, tag_id: tag.id, workspace_id: workspaceId }, { onConflict: "lead_id,tag_id" });
              } else {
                await supabase.from("lead_tag_assignments").delete().eq("lead_id", lead.id).eq("tag_id", tag.id);
              }
            }
          }
          break;
        }

        case "move_stage": {
          const stageName = currentNode.data?.stage_name || currentNode.data?.stageName || "";
          if (stageName) {
            const { data: stage } = await supabase.from("funnel_stages").select("id").eq("workspace_id", workspaceId).ilike("name", stageName).single();
            if (stage) {
              await supabase.from("leads").update({ stage_id: stage.id }).eq("id", lead.id);
            }
          }
          break;
        }

        case "condition": {
          // Simplified condition evaluation for cron
          const { field, operator, value } = currentNode.data || {};
          let result = false;
          if (field && operator) {
            const leadValue = String((lead as any)[field] || "").toLowerCase();
            const targetVal = (value || "").toLowerCase();
            if (operator === "equals") result = leadValue === targetVal;
            else if (operator === "contains") result = leadValue.includes(targetVal);
            else if (operator === "not_equals") result = leadValue !== targetVal;
          }
          currentNode = getNextNode(currentNode.id, nodes, edges, result ? "true" : "false");
          continue;
        }

        case "stop":
          return;
      }
    } catch (nodeErr) {
      console.error(`[salesbot-wait] Node ${currentNode.id} error:`, nodeErr);
    }

    currentNode = getNextNode(currentNode.id, nodes, edges);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ========================================
    // PROCESSAR FILA DE WAIT DO SALESBOT
    // ========================================
    let waitQueueProcessed = 0;

    try {
      const { data: pendingWaits } = await supabase
        .from("salesbot_wait_queue")
        .select("*")
        .eq("status", "pending")
        .not("execute_at", "is", null)
        .lte("execute_at", new Date().toISOString())
        .limit(30);

      if (pendingWaits?.length) {
        console.log(`[salesbot-wait] Processing ${pendingWaits.length} expired wait items`);

        for (const item of pendingWaits) {
          // Atomic status update to prevent double execution
          const { data: updated } = await supabase
            .from("salesbot_wait_queue")
            .update({ status: "executed", executed_at: new Date().toISOString() })
            .eq("id", item.id)
            .eq("status", "pending")
            .select("id")
            .single();

          if (!updated) {
            console.log(`[salesbot-wait] Item ${item.id} already processed, skipping`);
            continue;
          }

          // For timer conditions: verify lead hasn't responded since started_at
          if (item.condition_type === "timer") {
            const { data: inboundMsgs } = await supabase
              .from("whatsapp_messages")
              .select("id")
              .eq("remote_jid", item.session_id)
              .eq("workspace_id", item.workspace_id)
              .eq("direction", "inbound")
              .gte("timestamp", item.started_at)
              .limit(1);

            if (inboundMsgs && inboundMsgs.length > 0) {
              // Lead responded — this timer is moot, cancel
              console.log(`[salesbot-wait] Timer canceled — lead responded since ${item.started_at}`);
              await supabase.from("salesbot_wait_queue").update({ status: "canceled", canceled_reason: "lead_responded_before_timer" }).eq("id", item.id);
              continue;
            }
          }

          // Cancel sibling conditions for the same wait node + lead
          await supabase
            .from("salesbot_wait_queue")
            .update({ status: "canceled", canceled_reason: "sibling_triggered", executed_at: new Date().toISOString() })
            .eq("wait_node_id", item.wait_node_id)
            .eq("lead_id", item.lead_id)
            .eq("status", "pending")
            .neq("id", item.id);

          // Fetch lead and resume flow
          const { data: lead } = await supabase.from("leads").select("*").eq("id", item.lead_id).single();
          if (lead) {
            const instanceName = lead.instance_name || "";
            if (instanceName) {
              await resumeFlowFromNode(supabase, item.bot_id, lead, item.target_node_id, instanceName, item.workspace_id);
              console.log(`[salesbot-wait] ✅ Resumed flow for lead ${lead.name} via ${item.condition_type}`);
            }
          }

          waitQueueProcessed++;
        }
      }
    } catch (waitErr) {
      console.error("[salesbot-wait] Error processing wait queue:", waitErr);
    }

    console.log(`[salesbot-wait] Processed: ${waitQueueProcessed}`);

    // ========================================
    // ORIGINAL: NO-RESPONSE ALERTS
    // ========================================

    // 1. Get workspaces with alert instance configured
    const { data: workspaces, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, alert_instance_name")
      .not("alert_instance_name", "is", null);

    if (wsErr) throw wsErr;
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces with alerts configured", wait_queue_processed: waitQueueProcessed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const ws of workspaces) {
      if (totalSent >= MAX_ALERTS_PER_RUN) break;

      const alertInstance = ws.alert_instance_name;

      const { data: prefs, error: prefsErr } = await supabase
        .from("notification_preferences")
        .select("user_profile_id, no_response_minutes, manager_report_enabled")
        .eq("workspace_id", ws.id)
        .eq("no_response_enabled", true);

      if (prefsErr || !prefs?.length) continue;

      const profileIds = prefs.map((p: any) => p.user_profile_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, personal_whatsapp")
        .in("id", profileIds);

      if (!profiles?.length) continue;

      const userIds = profiles.map((p: any) => p.user_id);
      const { data: roles } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", ws.id)
        .in("user_id", userIds);

      const roleMap = new Map<string, string>();
      (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const { data: lossStages } = await supabase
        .from("funnel_stages")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("is_loss_stage", true);

      const lossStageIds = new Set((lossStages || []).map((s: any) => s.id));

      const { data: allLeads } = await supabase
        .from("leads")
        .select("id, name, phone, stage_id, responsible_user, updated_at, whatsapp_jid, instance_name")
        .eq("workspace_id", ws.id)
        .eq("status", "active");

      if (!allLeads?.length) continue;

      const activeLeads = allLeads.filter((l: any) => !lossStageIds.has(l.stage_id));

      const stageIds = [...new Set(activeLeads.map((l: any) => l.stage_id))];
      const { data: stagesData } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .in("id", stageIds);

      const stageNameMap = new Map<string, string>();
      (stagesData || []).forEach((s: any) => stageNameMap.set(s.id, s.name));

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

      for (const pref of prefs) {
        if (totalSent >= MAX_ALERTS_PER_RUN) break;

        const profile = profiles.find((p: any) => p.id === pref.user_profile_id);
        if (!profile?.personal_whatsapp) continue;

        const userRole = roleMap.get(profile.user_id);
        const minutes = pref.no_response_minutes || 30;
        const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        if (userRole === "seller") {
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

        if ((userRole === "admin" || userRole === "manager") && pref.manager_report_enabled) {
          const teamLeads = activeLeads.filter(
            (l: any) => l.responsible_user && l.responsible_user !== profile.id && l.updated_at < cutoff
          );

          if (teamLeads.length > 0) {
            const byResponsible = new Map<string, any[]>();
            for (const lead of teamLeads) {
              const arr = byResponsible.get(lead.responsible_user) || [];
              arr.push(lead);
              byResponsible.set(lead.responsible_user, arr);
            }

            const responsibleIds = [...byResponsible.keys()];
            const { data: sellerProfiles } = await supabase
              .from("user_profiles")
              .select("id, full_name")
              .in("id", responsibleIds);

            const sellerNameMap = new Map<string, string>();
            (sellerProfiles || []).forEach((p: any) => sellerNameMap.set(p.id, p.full_name));

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

    // ========================================
    // PROCESSAR FILA DE AUTOMAÇÕES TEMPORIZADAS
    // ========================================
    let automationsProcessed = 0;

    const { data: queueItems, error: queueErr } = await supabase
      .from("stage_automation_queue")
      .select("id, automation_id, lead_id, workspace_id")
      .eq("status", "pending")
      .lte("execute_at", new Date().toISOString())
      .limit(50);

    if (queueErr) {
      console.error("[automations-queue] Error fetching queue:", queueErr);
    }

    if (queueItems?.length) {
      const automationIds = [...new Set(queueItems.map((q: any) => q.automation_id))];
      const leadIds = [...new Set(queueItems.map((q: any) => q.lead_id))];

      const [automationsRes, leadsRes] = await Promise.all([
        supabase.from("stage_automations").select("id, action_type, action_config, conditions, stage_id").in("id", automationIds),
        supabase.from("leads").select("id, name, phone, responsible_user, whatsapp_jid, instance_name, workspace_id, source, value, stage_id").in("id", leadIds),
      ]);

      const automationMap = new Map<string, any>();
      (automationsRes.data || []).forEach((a: any) => automationMap.set(a.id, a));

      const leadMap = new Map<string, any>();
      (leadsRes.data || []).forEach((l: any) => leadMap.set(l.id, l));

      const stageIdsForQueue = [...new Set([
        ...(automationsRes.data || []).map((a: any) => a.stage_id),
        ...(leadsRes.data || []).map((l: any) => l.stage_id),
      ].filter(Boolean))];

      const { data: stagesForQueue } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .in("id", stageIdsForQueue);

      const stageNameMapQueue = new Map<string, string>();
      (stagesForQueue || []).forEach((s: any) => stageNameMapQueue.set(s.id, s.name));

      const { data: leadTagAssignments } = await supabase
        .from("lead_tag_assignments")
        .select("lead_id, tag_id")
        .in("lead_id", leadIds);

      const leadTagsMap = new Map<string, Set<string>>();
      (leadTagAssignments || []).forEach((lta: any) => {
        if (!leadTagsMap.has(lta.lead_id)) leadTagsMap.set(lta.lead_id, new Set());
        leadTagsMap.get(lta.lead_id)!.add(lta.tag_id);
      });

      function checkConditions(conditions: any[], lead: any): boolean {
        if (!conditions || !Array.isArray(conditions) || conditions.length === 0) return true;
        return conditions.every((c: any) => {
          const { field, operator, value } = c;
          if (field === "source") {
            if (operator === "equals") return lead.source === value;
            if (operator === "not_equals") return lead.source !== value;
          }
          if (field === "value") {
            const leadVal = Number(lead.value) || 0;
            const condVal = Number(value) || 0;
            if (operator === "greater_than") return leadVal > condVal;
            if (operator === "less_than") return leadVal < condVal;
            if (operator === "equals") return leadVal === condVal;
          }
          if (field === "tag") {
            const tags = leadTagsMap.get(lead.id) || new Set();
            if (operator === "contains") return tags.has(value);
            if (operator === "not_contains") return !tags.has(value);
          }
          return true;
        });
      }

      for (const item of queueItems) {
        const automation = automationMap.get(item.automation_id);
        const lead = leadMap.get(item.lead_id);

        if (!automation || !lead) {
          await supabase.from("stage_automation_queue").update({ status: "error", executed_at: new Date().toISOString() }).eq("id", item.id);
          continue;
        }

        if (!checkConditions(automation.conditions, lead)) {
          await supabase.from("stage_automation_queue").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", item.id);
          automationsProcessed++;
          continue;
        }

        try {
          const config = automation.action_config || {};

          switch (automation.action_type) {
            case "run_bot": {
              if (config.skip_if_executed && config.bot_id) {
                const { data: existingLogs } = await supabase
                  .from("bot_execution_logs")
                  .select("id")
                  .eq("bot_id", config.bot_id)
                  .eq("lead_id", lead.id)
                  .limit(1);
                if (existingLogs?.length) break;
              }

              if (config.bot_id) {
                const { data: bot } = await supabase
                  .from("salesbots")
                  .select("id, flow_data")
                  .eq("id", config.bot_id)
                  .eq("is_active", true)
                  .single();

                if (bot?.flow_data) {
                  const flowData = bot.flow_data as any;
                  const nodes = flowData.nodes || [];
                  const edges = flowData.edges || [];

                  // Find start node: first node that has no incoming edges
                  const startNode = findStartNode(nodes, edges);
                  if (startNode) {
                    const instanceForBot = lead.instance_name || config.instance_name || "";
                    await resumeFlowFromNode(supabase, bot.id, lead, startNode.id, instanceForBot, lead.workspace_id);
                    console.log(`[automations-queue] ✅ Bot ${bot.id} executed for lead ${lead.name}`);
                  } else {
                    console.warn(`[automations-queue] No start node found for bot ${bot.id}`);
                  }
                }
              }
              break;
            }

            case "notify_responsible": {
              let message = config.message || "Notificação automática";
              const stageName = stageNameMapQueue.get(lead.stage_id) || "";
              message = message
                .replace(/\{\{lead\.name\}\}/g, lead.name || "")
                .replace(/\{\{stage\.name\}\}/g, stageName);

              if (lead.responsible_user) {
                const { data: respProfile } = await supabase
                  .from("user_profiles")
                  .select("id, full_name, personal_whatsapp")
                  .eq("id", lead.responsible_user)
                  .single();

                if (respProfile) {
                  message = message.replace(/\{\{responsible\.name\}\}/g, respProfile.full_name || "");

                  if (respProfile.personal_whatsapp) {
                    const { data: wsData } = await supabase
                      .from("workspaces")
                      .select("alert_instance_name")
                      .eq("id", lead.workspace_id)
                      .single();

                    if (wsData?.alert_instance_name) {
                      await sendWhatsApp(wsData.alert_instance_name, respProfile.personal_whatsapp, message);
                    }
                  }
                }
              }
              break;
            }

            case "change_responsible": {
              let newResponsible = config.user_id;

              if (config.round_robin) {
                const { data: members } = await supabase
                  .from("workspace_members")
                  .select("user_id")
                  .eq("workspace_id", lead.workspace_id)
                  .eq("role", "seller")
                  .not("accepted_at", "is", null)
                  .order("user_id");

                if (members?.length) {
                  const memberUserIds = members.map((m: any) => m.user_id);
                  const { data: memberProfiles } = await supabase
                    .from("user_profiles")
                    .select("id, user_id")
                    .in("user_id", memberUserIds);

                  if (memberProfiles?.length) {
                    const profileIds = memberProfiles.map((p: any) => p.id);
                    const currentIdx = profileIds.indexOf(lead.responsible_user);
                    const nextIdx = (currentIdx + 1) % profileIds.length;
                    newResponsible = profileIds[nextIdx];
                  }
                }
              }

              if (newResponsible) {
                await supabase.from("leads").update({ responsible_user: newResponsible }).eq("id", lead.id);
              }
              break;
            }

            case "add_tag": {
              const tagId = config.tag_id;
              if (tagId) {
                const existingTags = leadTagsMap.get(lead.id) || new Set();
                if (!existingTags.has(tagId)) {
                  await supabase.from("lead_tag_assignments").insert({
                    lead_id: lead.id,
                    tag_id: tagId,
                    workspace_id: lead.workspace_id,
                  });
                }
              }
              break;
            }

            case "remove_tag": {
              const tagId = config.tag_id;
              if (tagId) {
                await supabase.from("lead_tag_assignments").delete().eq("lead_id", lead.id).eq("tag_id", tagId);
              }
              break;
            }

            case "create_task": {
              await supabase.from("lead_history").insert({
                lead_id: lead.id,
                workspace_id: lead.workspace_id,
                action: "task_created",
                metadata: {
                  title: config.title || "Tarefa automática",
                  due_days: config.due_days || 0,
                  assignee_id: config.assignee_id || lead.responsible_user,
                },
                performed_by: "system",
              });
              break;
            }
          }

          await supabase.from("stage_automation_queue").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", item.id);
          automationsProcessed++;
        } catch (execError) {
          console.error(`[automations-queue] Error processing item ${item.id}:`, execError);
          await supabase.from("stage_automation_queue").update({ status: "error", executed_at: new Date().toISOString() }).eq("id", item.id);
          automationsProcessed++;
        }
      }
    }

    console.log(`[automations-queue] Processed: ${automationsProcessed}`);

    // ========================================
    // PROCESSAR FILA DE FOLLOW-UP DE AGENTES IA
    // ========================================
    let followupsProcessed = 0;

    const { data: followupItems, error: followupErr } = await supabase
      .from("agent_followup_queue")
      .select("*")
      .eq("status", "pending")
      .lte("execute_at", new Date().toISOString())
      .limit(20);

    if (followupErr) {
      console.error("[followup-queue] Error fetching queue:", followupErr);
    }

    if (followupItems?.length) {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

      const agentIds = [...new Set(followupItems.map((q: any) => q.agent_id))];
      const leadIds = [...new Set(followupItems.map((q: any) => q.lead_id))];

      const [agentsRes, leadsRes] = await Promise.all([
        supabase.from("ai_agents").select("id, name, agent_role, system_prompt, model, tone_of_voice, use_emojis, response_length, followup_sequence, followup_end_stage_id, instance_name, is_active, workspace_id, cloud_24h_window_only").in("id", agentIds),
        supabase.from("leads").select("id, name, phone, whatsapp_jid, instance_name, workspace_id, stage_id").in("id", leadIds),
      ]);

      const agentMap = new Map<string, any>();
      (agentsRes.data || []).forEach((a: any) => agentMap.set(a.id, a));
      const leadMapFollowup = new Map<string, any>();
      (leadsRes.data || []).forEach((l: any) => leadMapFollowup.set(l.id, l));

      for (const item of followupItems) {
        const agent = agentMap.get(item.agent_id);
        const lead = leadMapFollowup.get(item.lead_id);

        if (!agent || !lead) {
          await supabase.from("agent_followup_queue").update({ status: "error" }).eq("id", item.id);
          followupsProcessed++;
          continue;
        }

        if (!agent.is_active) {
          await supabase.from("agent_followup_queue").update({ status: "canceled", canceled_reason: "agent_disabled" }).eq("id", item.id);
          followupsProcessed++;
          continue;
        }

        const { data: memory } = await supabase
          .from("agent_memories")
          .select("messages")
          .eq("agent_id", agent.id)
          .eq("session_id", item.session_id)
          .single();

        if (memory?.messages && Array.isArray(memory.messages) && memory.messages.length > 0) {
          const lastMsg = memory.messages[memory.messages.length - 1];
          if (lastMsg.role === "user") {
            await supabase.from("agent_followup_queue").update({ status: "canceled", canceled_reason: "lead_responded" }).eq("id", item.id);
            followupsProcessed++;
            console.log(`[followup-queue] ⏭️ Canceled — lead responded: ${lead.name}`);
            continue;
          }
        }

        const sequence = agent.followup_sequence || [];
        const stepNum = item.step_index + 1;
        const totalSteps = sequence.length;

        const followupPrompt = `Você é ${agent.agent_role || "Atendente"}, ${agent.name}. O lead "${lead.name}" parou de responder. Esta é a tentativa ${stepNum} de ${totalSteps} de recontato. Crie uma mensagem CURTA, criativa e natural de reativação. Não seja repetitivo — seja diferente das tentativas anteriores. Tom: ${agent.tone_of_voice || "consultivo"}. ${agent.use_emojis ? "Pode usar emojis." : "Não use emojis."} Máximo 2 frases. Retorne apenas a mensagem, sem explicações.`;

        let followupMessage = `Oi ${lead.name}, tudo bem? Vi que ficou alguma dúvida, posso ajudar? 😊`;

        if (lovableApiKey) {
          try {
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: (() => { const m = agent.model || "openai/gpt-5-mini"; return (!m.includes("/") || m.startsWith("anthropic/")) ? "openai/gpt-5-mini" : m; })(),
                messages: [{ role: "user", content: followupPrompt }],
                temperature: 0.9,
                max_tokens: 200,
              }),
            });
            if (aiRes.ok) {
              const aiData = await aiRes.json();
              const content = aiData.choices?.[0]?.message?.content;
              if (content) followupMessage = content.trim();
            }
          } catch (aiErr) {
            console.error("[followup-queue] AI generation error:", aiErr);
          }
        }

        const isWabaSession = item.session_id?.startsWith("waba_");
        const instanceName = isWabaSession ? null : (lead.instance_name || agent.instance_name);
        const phoneNumber = (lead.phone || "").replace(/\D/g, "") || (lead.whatsapp_jid || "").replace(/@.*$/, "");

        if (!phoneNumber) {
          console.error(`[followup-queue] ❌ No phone for lead ${lead.name}, skipping`);
          await supabase.from("agent_followup_queue").update({ status: "error", canceled_reason: "no_phone" }).eq("id", item.id);
          followupsProcessed++;
          continue;
        }

        // Check 24h window for WABA sessions
        if (isWabaSession && agent.cloud_24h_window_only !== false) {
          const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: lastInbound } = await supabase
            .from("meta_conversations")
            .select("timestamp")
            .eq("workspace_id", item.workspace_id)
            .eq("sender_id", phoneNumber)
            .eq("direction", "inbound")
            .eq("platform", "whatsapp_business")
            .gte("timestamp", windowCutoff)
            .order("timestamp", { ascending: false })
            .limit(1)
            .single();

          if (!lastInbound) {
            console.log(`[followup-queue] ⏭️ Skipped — 24h window expired for WABA lead: ${lead.name}`);
            await supabase.from("agent_followup_queue").update({ status: "canceled", canceled_reason: "24h_window_expired" }).eq("id", item.id);
            followupsProcessed++;
            continue;
          }
        }

        let sendSuccess = false;

        if (isWabaSession && phoneNumber) {
          // Send via WhatsApp Cloud API
          const cloudPhoneNumberId = item.session_id.replace("waba_", "");
          const agentCloudId = agent.instance_name?.startsWith("cloud_") ? agent.instance_name.replace("cloud_", "") : null;
          
          let cloudQuery = supabase
            .from("whatsapp_cloud_connections")
            .select("phone_number_id, access_token")
            .eq("workspace_id", item.workspace_id)
            .eq("is_active", true);
          
          if (agentCloudId) {
            cloudQuery = cloudQuery.eq("phone_number_id", agentCloudId);
          }

          const { data: cloudConn } = await cloudQuery.limit(1).single();

          if (cloudConn) {
            const res = await fetch(`https://graph.facebook.com/v21.0/${cloudConn.phone_number_id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${cloudConn.access_token}` },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "text",
                text: { body: followupMessage },
              }),
            });
            if (res.ok) {
              sendSuccess = true;
              console.log(`[followup-queue] ✅ WABA follow-up sent: step ${stepNum}, lead: ${lead.name}`);
            } else {
              console.error(`[followup-queue] ❌ WABA send failed: ${res.status} ${await res.text()}`);
            }
          } else {
            console.error(`[followup-queue] ❌ No cloud connection found for WABA follow-up`);
          }
        } else if (instanceName && phoneNumber) {
          sendSuccess = await sendWhatsApp(instanceName, phoneNumber, followupMessage);
          if (sendSuccess) {
            console.log(`[followup-queue] ✅ Follow-up sent: step ${stepNum}, lead: ${lead.name}, instance: ${instanceName}`);
          } else {
            console.error(`[followup-queue] ❌ Failed to send follow-up to ${lead.name} via instance ${instanceName}`);
          }
        } else {
          console.error(`[followup-queue] ❌ No instance for lead ${lead.name} (lead.instance: ${lead.instance_name}, agent.instance: ${agent.instance_name})`);
        }

        if (!sendSuccess) {
          // Mark as error but don't advance to next step
          await supabase.from("agent_followup_queue").update({ status: "error", canceled_reason: "send_failed" }).eq("id", item.id);
          followupsProcessed++;
          continue;
        }

        // ✅ Persist the follow-up message to whatsapp_messages so it appears in chat
        try {
          const remoteJid = item.session_id.includes("@") ? item.session_id : `${phoneNumber}@s.whatsapp.net`;
          const effectiveInstance = instanceName || "cloud_api";
          
          await supabase.from("whatsapp_messages").insert({
            workspace_id: item.workspace_id,
            instance_name: effectiveInstance,
            remote_jid: remoteJid,
            direction: "outbound",
            from_me: true,
            content: followupMessage,
            message_type: "text",
            message_id: `followup_${item.id}`,
            push_name: agent.name || "IA",
            timestamp: new Date().toISOString(),
          });
          console.log(`[followup-queue] 💾 Message persisted to whatsapp_messages`);
        } catch (persistErr) {
          console.error(`[followup-queue] ⚠️ Failed to persist message:`, persistErr);
        }

        // ✅ Update agent_memories with the follow-up message so AI has context
        try {
          const { data: memoryData } = await supabase
            .from("agent_memories")
            .select("id, messages")
            .eq("agent_id", agent.id)
            .eq("session_id", item.session_id)
            .single();

          if (memoryData) {
            const msgs = Array.isArray(memoryData.messages) ? memoryData.messages : [];
            msgs.push({ role: "assistant", content: followupMessage });
            await supabase.from("agent_memories")
              .update({ messages: msgs, updated_at: new Date().toISOString() })
              .eq("id", memoryData.id);
            console.log(`[followup-queue] 🧠 Memory updated with follow-up message`);
          }
        } catch (memErr) {
          console.error(`[followup-queue] ⚠️ Failed to update memory:`, memErr);
        }

        await supabase.from("agent_followup_queue").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", item.id);
        followupsProcessed++;

        const nextStepIndex = item.step_index + 1;
        if (nextStepIndex < sequence.length) {
          const nextStep = sequence[nextStepIndex];
          const delayMs = getFollowupDelayMs(nextStep.delay_value, nextStep.delay_unit);
          const executeAt = new Date(Date.now() + delayMs).toISOString();

          await supabase.from("agent_followup_queue").insert({
            agent_id: agent.id,
            lead_id: lead.id,
            session_id: item.session_id,
            workspace_id: item.workspace_id,
            step_index: nextStepIndex,
            execute_at: executeAt,
            status: "pending",
          });
          console.log(`[followup-queue] 📅 Next follow-up scheduled: step ${nextStepIndex + 1}, at ${executeAt}`);
        } else if (agent.followup_end_stage_id) {
          await supabase.from("leads").update({ stage_id: agent.followup_end_stage_id }).eq("id", lead.id);
          console.log(`[followup-queue] 🏁 Sequence ended for lead ${lead.name} — moved to stage ${agent.followup_end_stage_id}`);
        }
      }
    }

    console.log(`[followup-queue] Processed: ${followupsProcessed}`);

    return new Response(JSON.stringify({ alerts_sent: totalSent, automations_processed: automationsProcessed, followups_processed: followupsProcessed, wait_queue_processed: waitQueueProcessed }), {
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
