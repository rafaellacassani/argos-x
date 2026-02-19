import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const app = new Hono().basePath("/whatsapp-webhook");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// --- Evolution API helper ---
async function evolutionFetch(endpoint: string, method: string, body?: Record<string, unknown>) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[whatsapp-webhook] Evolution API error ${res.status}: ${text}`);
    return null;
  }
  return res.json();
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

// --- Strip JID suffix ---
function jidToNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");
}

// --- Anti-loop check ---
async function wasRecentlyExecuted(
  supabase: ReturnType<typeof createClient>,
  botId: string,
  remoteJid: string,
  triggerType: string,
  workspaceId: string
): Promise<boolean> {
  let minutesWindow = 5;
  if (triggerType === "keyword") minutesWindow = 60;
  if (triggerType === "new_lead") minutesWindow = 1440; // 24h

  const since = new Date(Date.now() - minutesWindow * 60 * 1000).toISOString();

  const { data: jidLogs } = await supabase
    .from("bot_execution_logs")
    .select("id")
    .eq("bot_id", botId)
    .eq("workspace_id", workspaceId)
    .eq("message", `jid:${remoteJid}`)
    .gte("executed_at", since)
    .limit(1);

  return (jidLogs && jidLogs.length > 0) || false;
}

// --- Log execution ---
async function logExecution(
  supabase: ReturnType<typeof createClient>,
  botId: string,
  leadId: string,
  nodeId: string,
  status: string,
  message: string,
  workspaceId: string
) {
  await supabase.from("bot_execution_logs").insert({
    bot_id: botId,
    lead_id: leadId,
    node_id: nodeId,
    status,
    message,
    workspace_id: workspaceId,
  });
}

// --- Find start node ---
function findStartNode(nodes: any[], edges: any[]): any | null {
  const targetIds = new Set(edges.map((e: any) => e.target));
  const startNodes = nodes.filter((n: any) => !targetIds.has(n.id));
  return startNodes[0] || null;
}

// --- Get next node ---
function getNextNode(currentId: string, nodes: any[], edges: any[], label?: string): any | null {
  const matchingEdges = edges.filter((e: any) => e.source === currentId);
  let edge: any = null;
  if (label) {
    edge = matchingEdges.find((e: any) => (e.label || e.sourceHandle || "").toLowerCase() === label.toLowerCase());
  }
  if (!edge) edge = matchingEdges[0];
  if (!edge) return null;
  return nodes.find((n: any) => n.id === edge.target) || null;
}

// --- Evaluate condition ---
async function evaluateCondition(
  supabase: ReturnType<typeof createClient>,
  node: any,
  leadId: string
): Promise<boolean> {
  const { field, operator, value } = node.data || {};
  if (!field || !operator) return false;

  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return false;

  if (field === "tags") {
    const { data: assignments } = await supabase
      .from("lead_tag_assignments")
      .select("tag_id, lead_tags(name)")
      .eq("lead_id", leadId);
    const tagNames = (assignments || []).map((a: any) => a.lead_tags?.name?.toLowerCase() || "");
    const targetVal = (value || "").toLowerCase();
    if (operator === "equals" || operator === "contains") return tagNames.includes(targetVal);
    if (operator === "not_equals") return !tagNames.includes(targetVal);
    return false;
  }

  const leadValue = String((lead as any)[field] || "").toLowerCase();
  const targetVal = (value || "").toLowerCase();
  if (operator === "equals") return leadValue === targetVal;
  if (operator === "contains") return leadValue.includes(targetVal);
  if (operator === "not_equals") return leadValue !== targetVal;
  return false;
}

// --- Execute a single node ---
async function executeNode(
  supabase: ReturnType<typeof createClient>,
  node: any,
  lead: any,
  instanceName: string,
  messageId: string,
  botId: string,
  workspaceId: string
): Promise<{ success: boolean; conditionResult?: boolean }> {
  const nodeType = node.type || node.data?.type || "";

  try {
    switch (nodeType) {
      case "send_message": {
        const rawText = node.data?.message || node.data?.text || "";
        if (!rawText) return { success: true };
        const text = replaceVars(rawText, lead, instanceName);
        const number = jidToNumber(lead.whatsapp_jid || lead.phone || "");
        if (!number) return { success: false };
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number,
          text,
          delay: 0,
          linkPreview: true,
        });
        await logExecution(supabase, botId, lead.id, node.id, "success", text.substring(0, 200), workspaceId);
        return { success: true };
      }

      case "wait": {
        const seconds = Math.min(Number(node.data?.seconds || node.data?.duration || 5), 30);
        await new Promise((r) => setTimeout(r, seconds * 1000));
        await logExecution(supabase, botId, lead.id, node.id, "success", `Waited ${seconds}s`, workspaceId);
        return { success: true };
      }

      case "tag": {
        const action = node.data?.action || "add";
        const tagName = node.data?.tag_name || node.data?.tagName || "";
        const tagId = node.data?.tag_id || node.data?.tagId || "";

        let resolvedTagId = tagId;
        if (!resolvedTagId && tagName) {
          const { data: tag } = await supabase
            .from("lead_tags")
            .select("id")
            .eq("workspace_id", workspaceId)
            .ilike("name", tagName)
            .single();
          resolvedTagId = tag?.id;
        }
        if (!resolvedTagId) return { success: false };

        if (action === "add") {
          await supabase.from("lead_tag_assignments").upsert(
            { lead_id: lead.id, tag_id: resolvedTagId, workspace_id: workspaceId },
            { onConflict: "lead_id,tag_id" }
          );
        } else {
          await supabase
            .from("lead_tag_assignments")
            .delete()
            .eq("lead_id", lead.id)
            .eq("tag_id", resolvedTagId);
        }
        await logExecution(supabase, botId, lead.id, node.id, "success", `Tag ${action}: ${tagName || resolvedTagId}`, workspaceId);
        return { success: true };
      }

      case "move_stage": {
        const stageId = node.data?.stage_id || node.data?.stageId || "";
        const stageName = node.data?.stage_name || node.data?.stageName || "";

        let resolvedStageId = stageId;
        if (!resolvedStageId && stageName) {
          const { data: stage } = await supabase
            .from("funnel_stages")
            .select("id")
            .eq("workspace_id", workspaceId)
            .ilike("name", stageName)
            .single();
          resolvedStageId = stage?.id;
        }
        if (!resolvedStageId) return { success: false };

        const previousStageId = lead.stage_id;
        await supabase.from("leads").update({ stage_id: resolvedStageId }).eq("id", lead.id);
        await supabase.from("lead_history").insert({
          lead_id: lead.id,
          action: "stage_changed",
          from_stage_id: previousStageId,
          to_stage_id: resolvedStageId,
          performed_by: "SalesBot",
          workspace_id: workspaceId,
        });
        await logExecution(supabase, botId, lead.id, node.id, "success", `Moved to stage ${resolvedStageId}`, workspaceId);
        return { success: true };
      }

      case "condition": {
        const result = await evaluateCondition(supabase, node, lead.id);
        await logExecution(supabase, botId, lead.id, node.id, "success", `Condition: ${result}`, workspaceId);
        return { success: true, conditionResult: result };
      }

      case "round_robin": {
        const { data: members } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .in("role", ["seller", "manager"])
          .not("accepted_at", "is", null);

        if (!members || members.length === 0) return { success: false };

        const { data: lastLog } = await supabase
          .from("bot_execution_logs")
          .select("message")
          .eq("bot_id", botId)
          .eq("node_id", node.id)
          .eq("status", "success")
          .order("executed_at", { ascending: false })
          .limit(1);

        const lastUserId = lastLog?.[0]?.message?.replace("assigned:", "") || "";
        const userIds = members.map((m: any) => m.user_id);
        const lastIndex = userIds.indexOf(lastUserId);
        const nextIndex = (lastIndex + 1) % userIds.length;
        const nextUserId = userIds[nextIndex];

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("user_id", nextUserId)
          .single();

        if (profile) {
          await supabase.from("leads").update({ responsible_user: profile.id }).eq("id", lead.id);
        }
        await logExecution(supabase, botId, lead.id, node.id, "success", `assigned:${nextUserId}`, workspaceId);
        return { success: true };
      }

      case "whatsapp_list": {
        const number = jidToNumber(lead.whatsapp_jid || lead.phone || "");
        if (!number) return { success: false };
        const { title, body, footer, buttonText, sections } = node.data || {};
        await evolutionFetch(`/message/sendList/${instanceName}`, "POST", {
          number,
          title: title || "",
          description: body || "",
          footerText: footer || "",
          buttonText: buttonText || "Menu",
          sections: sections || [],
        });
        await logExecution(supabase, botId, lead.id, node.id, "success", `List sent`, workspaceId);
        return { success: true };
      }

      case "react": {
        const emoji = node.data?.emoji || "👍";
        const remoteJid = lead.whatsapp_jid || "";
        if (!remoteJid || !messageId) return { success: false };
        await evolutionFetch(`/message/sendReaction/${instanceName}`, "POST", {
          key: { remoteJid, id: messageId },
          reaction: emoji,
        });
        await logExecution(supabase, botId, lead.id, node.id, "success", `Reacted: ${emoji}`, workspaceId);
        return { success: true };
      }

      case "comment": {
        const commentText = node.data?.text || "";
        if (!commentText) return { success: true };
        await supabase.from("lead_history").insert({
          lead_id: lead.id,
          action: "note",
          metadata: { note: commentText, source: "SalesBot" },
          performed_by: "SalesBot",
          workspace_id: workspaceId,
        });
        await logExecution(supabase, botId, lead.id, node.id, "success", commentText.substring(0, 200), workspaceId);
        return { success: true };
      }

      case "action": {
        const actionType = node.data?.action_type || "";
        if (actionType === "change_responsible") {
          const userId = node.data?.user_id;
          if (userId) {
            await supabase.from("leads").update({ responsible_user: userId }).eq("id", lead.id);
            await logExecution(supabase, botId, lead.id, node.id, "success", `Responsible: ${userId}`, workspaceId);
          }
        } else if (actionType === "add_note") {
          const note = node.data?.note || "";
          await supabase.from("lead_history").insert({
            lead_id: lead.id,
            action: "note",
            metadata: { note, source: "SalesBot" },
            performed_by: "SalesBot",
            workspace_id: workspaceId,
          });
          await logExecution(supabase, botId, lead.id, node.id, "success", note.substring(0, 200), workspaceId);
        } else if (actionType === "webhook") {
          const webhookUrl = node.data?.url || node.data?.webhook_url || "";
          if (webhookUrl && webhookUrl.startsWith("https://")) {
            try {
              await fetch(webhookUrl, {
                method: node.data?.method || "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  lead_id: lead.id,
                  lead_name: lead.name,
                  lead_phone: lead.phone,
                  instance_name: instanceName,
                  bot_id: botId,
                }),
              });
            } catch (e) {
              console.error("[whatsapp-webhook] Webhook call error:", e);
            }
            await logExecution(supabase, botId, lead.id, node.id, "success", `Webhook: ${webhookUrl}`, workspaceId);
          }
        }
        return { success: true };
      }

      default: {
        console.warn(`[whatsapp-webhook] Unknown node type: ${nodeType}`);
        await logExecution(supabase, botId, lead.id, node.id, "skipped", `Unknown type: ${nodeType}`, workspaceId);
        return { success: true };
      }
    }
  } catch (err) {
    console.error(`[whatsapp-webhook] Node ${node.id} error:`, err);
    await logExecution(supabase, botId, lead.id, node.id, "error", String(err), workspaceId);
    return { success: false };
  }
}

// --- Execute full bot flow ---
async function executeFlow(
  supabase: ReturnType<typeof createClient>,
  botId: string,
  lead: any,
  instanceName: string,
  messageId: string,
  workspaceId: string
) {
  const { data: bot } = await supabase.from("salesbots").select("flow_data").eq("id", botId).single();
  if (!bot?.flow_data) return;

  const flowData = bot.flow_data as any;
  const nodes = flowData.nodes || [];
  const edges = flowData.edges || [];

  if (nodes.length === 0) return;

  let currentNode = findStartNode(nodes, edges);
  let executed = 0;
  const maxNodes = 50;

  // Log anti-loop marker
  await supabase.from("bot_execution_logs").insert({
    bot_id: botId,
    lead_id: lead.id,
    node_id: "flow_start",
    status: "success",
    message: `jid:${lead.whatsapp_jid || ""}`,
    workspace_id: workspaceId,
  });

  while (currentNode && executed < maxNodes) {
    executed++;
    const result = await executeNode(supabase, currentNode, lead, instanceName, messageId, botId, workspaceId);

    if (!result.success) break;

    if (currentNode.type === "condition" || (currentNode.data?.type === "condition")) {
      const label = result.conditionResult ? "true" : "false";
      currentNode = getNextNode(currentNode.id, nodes, edges, label);
    } else {
      currentNode = getNextNode(currentNode.id, nodes, edges);
    }
  }

  // Increment executions count
  await supabase.rpc("increment_bot_executions_count", { bot_id_param: botId }).catch(() => {
    supabase.from("salesbots").update({ executions_count: (bot as any).executions_count + 1 }).eq("id", botId).then(() => {});
  });
}

// --- CORS ---
app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// --- Main webhook endpoint ---
app.post("/", async (c) => {
  try {
    // Validate apikey from header OR query parameter (Evolution API sends via query param)
    const apiKey = c.req.header("apikey") || c.req.query("apikey");
    if (!apiKey || apiKey !== EVOLUTION_API_KEY) {
      console.warn("[whatsapp-webhook] ❌ Invalid apikey - header:", !!c.req.header("apikey"), "query:", !!c.req.query("apikey"));
      return c.json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const payload = await c.req.json();
    console.log("[whatsapp-webhook] 📩 Webhook received from instance:", payload.instance, "event:", payload.event);
    const event = (payload.event || "").toUpperCase().replace(/\./g, "_");

    // Only process MESSAGES_UPSERT (Evolution API v2 sends "messages.upsert")
    if (event !== "MESSAGES_UPSERT") {
      console.log("[whatsapp-webhook] ⏭️ Skipping event:", payload.event, "→ normalized:", event);
      return c.json({ received: true, skipped: true }, 200, corsHeaders);
    }

    const data = payload.data;
    const instanceName = payload.instance;

    if (!data || !instanceName) {
      return c.json({ received: true, skipped: true }, 200, corsHeaders);
    }

    const key = data.key || {};
    const remoteJid: string = key.remoteJid || "";
    const fromMe: boolean = key.fromMe || false;
    const msgId: string = key.id || "";

    // Skip own messages
    if (fromMe) {
      return c.json({ received: true, skipped: "fromMe" }, 200, corsHeaders);
    }

    // Skip groups
    if (remoteJid.endsWith("@g.us")) {
      return c.json({ received: true, skipped: "group" }, 200, corsHeaders);
    }

    // Extract message text
    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    const pushName = data.pushName || "";

    // FIX: For @lid contacts, try to resolve real phone from message metadata
    let resolvedRemoteJid = remoteJid;
    let phoneNumber = "";
    
    if (remoteJid.endsWith("@lid")) {
      // Try to get the real number from participant or other metadata
      const participant = data.participant || data.key?.participant || "";
      if (participant && !participant.endsWith("@lid")) {
        resolvedRemoteJid = participant;
        phoneNumber = jidToNumber(participant);
        console.log(`[whatsapp-webhook] 🔄 @lid resolved: ${remoteJid} → ${participant}`);
      } else {
        // Use the lid as identifier — don't skip anymore
        phoneNumber = jidToNumber(remoteJid);
        console.log(`[whatsapp-webhook] ⚠️ @lid contact, using as-is: ${remoteJid}`);
      }
    } else {
      phoneNumber = jidToNumber(remoteJid);
    }

    console.log(`[whatsapp-webhook] 📩 MSG from ${pushName} (${remoteJid}) on instance "${instanceName}": "${messageText?.substring(0, 100)}"`);

    const supabase = getSupabase();

    // Find workspace for this instance
    const { data: instanceRecord } = await supabase
      .from("whatsapp_instances")
      .select("workspace_id")
      .eq("instance_name", instanceName)
      .limit(1)
      .single();

    if (!instanceRecord) {
      console.warn(`[whatsapp-webhook] ❌ Instance "${instanceName}" not found in DB`);
      return c.json({ received: true, skipped: "no_workspace" }, 200, corsHeaders);
    }

    const workspaceId = instanceRecord.workspace_id;
    console.log(`[whatsapp-webhook] ✅ Workspace found: ${workspaceId}`);

    // --- STEP 1: Check for active AI Agent ---
    // FIX: Select instance_name from ai_agents directly (not trigger_config)
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("id, instance_name, respond_to, respond_to_stages")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    console.log(`[whatsapp-webhook] 🤖 Active agents found: ${agents?.length || 0}`);

    if (agents && agents.length > 0) {
      // FIX: Match using agent.instance_name column (not trigger_config)
      const matchingAgent = agents.find((a: any) => {
        // Empty or null instance_name means "all instances"
        return !a.instance_name || a.instance_name === "" || a.instance_name === instanceName;
      });

      if (matchingAgent) {
        console.log(`[whatsapp-webhook] 🎯 Agent matched: ${matchingAgent.id} (instance filter: "${matchingAgent.instance_name || 'all'}")`);
      } else {
        console.log(`[whatsapp-webhook] ⚠️ No agent matched for instance "${instanceName}". Agent instances: ${agents.map((a: any) => a.instance_name || 'all').join(', ')}`);
      }

      if (matchingAgent && messageText) {
        // Check respond_to filter
        let shouldRespond = true;
        
        // Find or create lead for agent context
        let leadId: string | null = null;
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, stage_id")
          .eq("workspace_id", workspaceId)
          .or(`whatsapp_jid.eq.${remoteJid}${resolvedRemoteJid !== remoteJid ? `,whatsapp_jid.eq.${resolvedRemoteJid}` : ''}`)
          .limit(1)
          .single();
        leadId = existingLead?.id || null;

        // Check respond_to rules
        if (matchingAgent.respond_to === "specific_stages" && existingLead) {
          const stages = matchingAgent.respond_to_stages || [];
          if (stages.length > 0 && !stages.includes(existingLead.stage_id)) {
            shouldRespond = false;
            console.log(`[whatsapp-webhook] ⏭️ Agent skipped: lead stage ${existingLead.stage_id} not in ${JSON.stringify(stages)}`);
          }
        }

        if (shouldRespond) {
          // Call ai-agent-chat internally
          try {
            const agentUrl = `${SUPABASE_URL}/functions/v1/ai-agent-chat`;
            console.log(`[whatsapp-webhook] 🚀 Calling ai-agent-chat for agent ${matchingAgent.id}, session ${remoteJid}, lead ${leadId}`);
            
            const agentRes = await fetch(agentUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                agent_id: matchingAgent.id,
                session_id: remoteJid,
                message: messageText,
                lead_id: leadId,
                _internal_webhook: true, // Flag to bypass auth in ai-agent-chat
              }),
            });

            const agentData = await agentRes.json();
            console.log(`[whatsapp-webhook] 📤 Agent response status: ${agentRes.status}, has chunks: ${!!agentData.chunks}, skipped: ${agentData.skipped || false}, error: ${agentData.error || 'none'}`);

            if (agentData.error) {
              console.error(`[whatsapp-webhook] ❌ Agent error: ${agentData.error}`);
            }

            // If agent responded, send the chunks via Evolution API
            if (agentData.chunks && Array.isArray(agentData.chunks)) {
              console.log(`[whatsapp-webhook] 💬 Sending ${agentData.chunks.length} chunks to ${phoneNumber}`);
              for (const chunk of agentData.chunks) {
                if (chunk && chunk.trim()) {
                  const sendResult = await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                    number: phoneNumber,
                    text: chunk,
                    delay: 0,
                    linkPreview: false,
                  });
                  if (!sendResult) {
                    console.error(`[whatsapp-webhook] ❌ Failed to send chunk to ${phoneNumber}`);
                  }
                  // Small delay between chunks
                  if (agentData.chunks.length > 1) {
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                }
              }
              console.log(`[whatsapp-webhook] ✅ Agent response sent successfully`);
            } else if (agentData.response) {
              const sendResult = await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                number: phoneNumber,
                text: agentData.response,
                delay: 0,
                linkPreview: false,
              });
              if (sendResult) {
                console.log(`[whatsapp-webhook] ✅ Agent single response sent`);
              } else {
                console.error(`[whatsapp-webhook] ❌ Failed to send agent response`);
              }
            } else if (agentData.skipped) {
              console.log(`[whatsapp-webhook] ⏭️ Agent skipped: ${agentData.reason || 'unknown reason'}`);
            } else if (agentData.paused) {
              console.log(`[whatsapp-webhook] ⏸️ Agent paused for this session`);
            }
          } catch (err) {
            console.error("[whatsapp-webhook] ❌ AI Agent call exception:", err);
          }

          // AI Agent handled it — don't continue to SalesBots
          return c.json({ received: true, handler: "ai_agent" }, 200, corsHeaders);
        }
      }
    }

    // --- STEP 2: Check for active SalesBots ---
    const { data: bots } = await supabase
      .from("salesbots")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!bots || bots.length === 0) {
      console.log(`[whatsapp-webhook] ℹ️ No active bots for workspace ${workspaceId}`);
      return c.json({ received: true, no_bots: true }, 200, corsHeaders);
    }

    // Check if lead exists for this jid
    let { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .or(`whatsapp_jid.eq.${remoteJid}${resolvedRemoteJid !== remoteJid ? `,whatsapp_jid.eq.${resolvedRemoteJid}` : ''}`)
      .limit(1)
      .single();

    const isNewLead = !existingLead;

    // Find matching bot
    let matchedBot: any = null;

    for (const bot of bots) {
      const triggerType = bot.trigger_type;
      const triggerConfig = (bot.trigger_config || {}) as Record<string, any>;

      // Check instance_name filter
      if (triggerConfig.instance_name && triggerConfig.instance_name !== instanceName) {
        continue;
      }

      if (triggerType === "message_received") {
        const recent = await wasRecentlyExecuted(supabase, bot.id, remoteJid, triggerType, workspaceId);
        if (!recent) {
          matchedBot = bot;
          break;
        }
      } else if (triggerType === "keyword") {
        const keyword = (triggerConfig.keyword || "").toLowerCase();
        if (keyword && messageText.toLowerCase().includes(keyword)) {
          const recent = await wasRecentlyExecuted(supabase, bot.id, remoteJid, triggerType, workspaceId);
          if (!recent) {
            matchedBot = bot;
            break;
          }
        }
      } else if (triggerType === "new_lead") {
        if (isNewLead) {
          const recent = await wasRecentlyExecuted(supabase, bot.id, remoteJid, triggerType, workspaceId);
          if (!recent) {
            matchedBot = bot;
            break;
          }
        }
      }
    }

    if (!matchedBot) {
      return c.json({ received: true, no_match: true }, 200, corsHeaders);
    }

    // --- STEP 3: Ensure lead exists ---
    if (!existingLead) {
      const { data: defaultFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_default", true)
        .limit(1)
        .single();

      let stageId: string | null = null;
      if (defaultFunnel) {
        const { data: firstStage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("funnel_id", defaultFunnel.id)
          .order("position", { ascending: true })
          .limit(1)
          .single();
        stageId = firstStage?.id || null;
      }

      if (!stageId) {
        const { data: anyStage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("workspace_id", workspaceId)
          .order("position", { ascending: true })
          .limit(1)
          .single();
        stageId = anyStage?.id || null;
      }

      if (!stageId) {
        console.error("[whatsapp-webhook] No funnel stage found");
        return c.json({ received: true, error: "no_stage" }, 200, corsHeaders);
      }

      const leadName = pushName || `+${phoneNumber}`;
      const validPhone = phoneNumber.length <= 13 ? phoneNumber : "";

      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: leadName,
          phone: validPhone,
          whatsapp_jid: remoteJid,
          instance_name: instanceName,
          source: "whatsapp",
          stage_id: stageId,
          workspace_id: workspaceId,
        })
        .select("*")
        .single();

      if (leadError) {
        console.error("[whatsapp-webhook] Lead creation error:", leadError);
        return c.json({ received: true, error: "lead_creation_failed" }, 200, corsHeaders);
      }

      existingLead = newLead;
    }

    // --- STEP 4: Execute bot flow ---
    await executeFlow(supabase, matchedBot.id, existingLead, instanceName, msgId, workspaceId);

    return c.json({ received: true, bot_executed: matchedBot.id }, 200, corsHeaders);
  } catch (err) {
    console.error("[whatsapp-webhook] ❌ Unhandled error:", err);
    return c.json({ received: true, error: "internal" }, 200, corsHeaders);
  }
});

Deno.serve(app.fetch);
