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

function getFollowupDelayMs(value: number, unit: string): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours": return value * 3600 * 1000;
    case "days": return value * 86400 * 1000;
    default: return value * 60 * 1000;
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
      // Fetch automation details and lead details for each queue item
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

      // Fetch stage names for variable substitution
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

      // Fetch lead tags for condition checks
      const { data: leadTagAssignments } = await supabase
        .from("lead_tag_assignments")
        .select("lead_id, tag_id")
        .in("lead_id", leadIds);

      const leadTagsMap = new Map<string, Set<string>>();
      (leadTagAssignments || []).forEach((lta: any) => {
        if (!leadTagsMap.has(lta.lead_id)) leadTagsMap.set(lta.lead_id, new Set());
        leadTagsMap.get(lta.lead_id)!.add(lta.tag_id);
      });

      // Helper: check conditions
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

        // Check conditions
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

                  // Find start node and execute send_message nodes in sequence
                  const startNode = nodes.find((n: any) => n.type === "trigger" || n.data?.nodeType === "trigger");
                  if (startNode) {
                    let currentNodeId = startNode.id;
                    let executedNodes = 0;
                    const maxNodes = 20;

                    while (currentNodeId && executedNodes < maxNodes) {
                      const outEdge = edges.find((e: any) => e.source === currentNodeId);
                      if (!outEdge) break;

                      const nextNode = nodes.find((n: any) => n.id === outEdge.target);
                      if (!nextNode) break;

                      currentNodeId = nextNode.id;
                      executedNodes++;

                      if (nextNode.data?.nodeType === "send_message" && nextNode.data?.message) {
                        const instanceName = lead.instance_name;
                        const phone = lead.phone || lead.whatsapp_jid;
                        if (instanceName && phone) {
                          await sendWhatsApp(instanceName, phone, nextNode.data.message);
                          await supabase.from("bot_execution_logs").insert({
                            bot_id: bot.id,
                            lead_id: lead.id,
                            node_id: nextNode.id,
                            status: "sent",
                            message: nextNode.data.message?.slice(0, 500),
                            workspace_id: lead.workspace_id,
                          });
                        }
                      }
                    }
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

              // Get responsible profile
              if (lead.responsible_user) {
                const { data: respProfile } = await supabase
                  .from("user_profiles")
                  .select("id, full_name, personal_whatsapp")
                  .eq("id", lead.responsible_user)
                  .single();

                if (respProfile) {
                  message = message.replace(/\{\{responsible\.name\}\}/g, respProfile.full_name || "");

                  if (respProfile.personal_whatsapp) {
                    // Get workspace alert instance
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
                  // Get user_profile ids for these members
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

      // Fetch agent details
      const agentIds = [...new Set(followupItems.map((q: any) => q.agent_id))];
      const leadIds = [...new Set(followupItems.map((q: any) => q.lead_id))];

      const [agentsRes, leadsRes] = await Promise.all([
        supabase.from("ai_agents").select("id, name, agent_role, system_prompt, model, tone_of_voice, use_emojis, response_length, followup_sequence, followup_end_stage_id, instance_name, is_active, workspace_id").in("id", agentIds),
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

        // Skip if agent is inactive
        if (!agent.is_active) {
          await supabase.from("agent_followup_queue").update({ status: "canceled", canceled_reason: "agent_disabled" }).eq("id", item.id);
          followupsProcessed++;
          continue;
        }

        // Check if lead responded since this was queued — look at agent_memories
        const { data: memory } = await supabase
          .from("agent_memories")
          .select("messages")
          .eq("agent_id", agent.id)
          .eq("session_id", item.session_id)
          .single();

        if (memory?.messages && Array.isArray(memory.messages) && memory.messages.length > 0) {
          const lastMsg = memory.messages[memory.messages.length - 1];
          if (lastMsg.role === "user") {
            // Lead responded — cancel
            await supabase.from("agent_followup_queue").update({ status: "canceled", canceled_reason: "lead_responded" }).eq("id", item.id);
            followupsProcessed++;
            console.log(`[followup-queue] ⏭️ Canceled — lead responded: ${lead.name}`);
            continue;
          }
        }

        // Generate follow-up message via AI
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
                model: agent.model || "google/gemini-3-flash-preview",
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

        // Send via Evolution API
        const instanceName = lead.instance_name || agent.instance_name;
        const phoneNumber = (lead.phone || "").replace(/\D/g, "") || (lead.whatsapp_jid || "").replace(/@.*$/, "");

        if (instanceName && phoneNumber) {
          const sent = await sendWhatsApp(instanceName, phoneNumber, followupMessage);
          if (sent) {
            console.log(`[followup-queue] ✅ Follow-up sent: step ${stepNum}, lead: ${lead.name}`);
          } else {
            console.error(`[followup-queue] ❌ Failed to send follow-up to ${lead.name}`);
          }
        }

        // Mark as executed
        await supabase.from("agent_followup_queue").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", item.id);
        followupsProcessed++;

        // Schedule next step or execute end action
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
          // Last step — move lead to end stage
          await supabase.from("leads").update({ stage_id: agent.followup_end_stage_id }).eq("id", lead.id);
          console.log(`[followup-queue] 🏁 Sequence ended for lead ${lead.name} — moved to stage ${agent.followup_end_stage_id}`);
        }
      }
    }

    console.log(`[followup-queue] Processed: ${followupsProcessed}`);

    return new Response(JSON.stringify({ alerts_sent: totalSent, automations_processed: automationsProcessed, followups_processed: followupsProcessed }), {
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
