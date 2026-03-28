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
  if (triggerType === "new_lead") minutesWindow = 1440;

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
    // Match by sourceHandle first, then by label text
    edge = matchingEdges.find((e: any) => {
      const handle = (e.sourceHandle || "").toLowerCase();
      const edgeLabel = (e.label || "").toLowerCase();
      const target = label.toLowerCase();
      return handle === target || edgeLabel === target;
    });
    // Fallback: also try "yes"/"no" mapping for "true"/"false"
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

// --- Get next node by sourceHandle (for wait conditions) ---
function getNextNodeByHandle(currentId: string, nodes: any[], edges: any[], handleId: string): any | null {
  const edge = edges.find((e: any) => e.source === currentId && e.sourceHandle === handleId);
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

// --- Migrate legacy wait data to conditions ---
function migrateWaitConditionsBackend(data: any): any[] {
  if (Array.isArray(data.conditions) && data.conditions.length > 0) {
    return data.conditions;
  }
  const waitMode = data.wait_mode || "timer";
  if (waitMode === "message" || data.wait_for === "message" || data.wait_mode === "wait_message") {
    return [{ id: "legacy_msg", type: "message_received", label: "Se responder", config: {}, order: 0 }];
  }
  if (waitMode === "business_hours" || data.wait_for === "business_hours") {
    return [{ id: "legacy_bh", type: "business_hours", label: "Horário comercial", config: { days: data.days || ["mon","tue","wed","thu","fri"], start: data.start || "09:00", end: data.end || "18:00" }, order: 0 }];
  }
  const seconds = Number(data.seconds || data.duration || 5);
  return [{ id: "legacy_timer", type: "timer", label: "Cronômetro", config: { seconds }, order: 0 }];
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
): Promise<{ success: boolean; conditionResult?: boolean; waitPaused?: boolean }> {
  const nodeType = node.type || node.data?.type || "";

  try {
    switch (nodeType) {
      case "send_message": {
        const rawText = node.data?.message || node.data?.text || "";
        const nodeMediaUrl = node.data?.mediaUrl as string || "";
        const nodeMediaType = node.data?.mediaType as string || "";
        const number = jidToNumber(lead.whatsapp_jid || lead.phone || "");
        if (!number) return { success: false };

        // Send media if configured
        if (nodeMediaUrl && nodeMediaType) {
          const text = rawText ? replaceVars(rawText, lead, instanceName) : "";
          
          if (nodeMediaType === "audio") {
            // Send as WhatsApp audio (PTT / voice note)
            await evolutionFetch(`/message/sendWhatsAppAudio/${instanceName}`, "POST", {
              number,
              audio: nodeMediaUrl,
              delay: 0,
            });
          } else {
            // Send image or video with optional caption
            await evolutionFetch(`/message/sendMedia/${instanceName}`, "POST", {
              number,
              mediatype: nodeMediaType,
              media: nodeMediaUrl,
              caption: text || undefined,
              delay: 0,
            });
          }
          await logExecution(supabase, botId, lead.id, node.id, "success", `[${nodeMediaType}] ${text?.substring(0, 150) || nodeMediaUrl}`, workspaceId);
          return { success: true };
        }

        // Text-only message
        if (!rawText) return { success: true };
        const text = replaceVars(rawText, lead, instanceName);
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
        // New multi-condition wait: enqueue conditions and pause
        const conditions = migrateWaitConditionsBackend(node.data || {});
        const edges_data = node._edges || []; // injected by executeFlow

        // If only a single legacy timer with no conditions structure, do inline wait (backward compat for <=30s)
        if (conditions.length === 1 && conditions[0].type === "timer" && !Array.isArray(node.data?.conditions)) {
          const seconds = Math.min(Number(conditions[0].config?.seconds || node.data?.seconds || node.data?.duration || 5), 30);
          await new Promise((r) => setTimeout(r, seconds * 1000));
          await logExecution(supabase, botId, lead.id, node.id, "success", `Waited ${seconds}s`, workspaceId);
          return { success: true };
        }

        // Enqueue each condition into salesbot_wait_queue
        for (const cond of conditions) {
          // Find target node for this condition
          const targetEdge = edges_data.find((e: any) => e.source === node.id && e.sourceHandle === cond.id);
          // Fallback: if only one condition and one edge, use that edge
          const fallbackEdge = conditions.length === 1 ? edges_data.find((e: any) => e.source === node.id) : null;
          const edge = targetEdge || fallbackEdge;
          if (!edge) continue;

          let executeAt: string | null = null;
          if (cond.type === "timer") {
            const delaySec = Number(cond.config?.seconds || 0);
            if (delaySec > 0) {
              executeAt = new Date(Date.now() + delaySec * 1000).toISOString();
            }
          } else if (cond.type === "business_hours") {
            // Calculate next business hour window
            const start = cond.config?.start || "09:00";
            const end = cond.config?.end || "18:00";
            const days = cond.config?.days || ["mon","tue","wed","thu","fri"];
            executeAt = calculateNextBusinessHour(start, end, days);
          }
          // message_received: no execute_at (triggered by incoming message)

          await supabase.from("salesbot_wait_queue").insert({
            workspace_id: workspaceId,
            bot_id: botId,
            lead_id: lead.id,
            wait_node_id: node.id,
            target_node_id: edge.target,
            condition_id: cond.id,
            condition_type: cond.type,
            session_id: lead.whatsapp_jid || "",
            execute_at: executeAt,
            status: "pending",
          });
        }

        await logExecution(supabase, botId, lead.id, node.id, "success", `Wait paused: ${conditions.length} conditions enqueued`, workspaceId);
        return { success: true, waitPaused: true };
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

// --- Calculate next business hour ---
function calculateNextBusinessHour(start: string, end: string, days: string[]): string {
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const activeDays = new Set(days.map(d => dayMap[d]).filter(d => d !== undefined));
  
  const now = new Date();
  const [startH, startM] = start.split(":").map(Number);
  
  // Check up to 7 days ahead
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now.getTime() + offset * 86400000);
    if (activeDays.has(candidate.getDay())) {
      candidate.setHours(startH, startM, 0, 0);
      if (candidate > now) return candidate.toISOString();
    }
  }
  
  // Fallback: 24h from now
  return new Date(Date.now() + 86400000).toISOString();
}

// --- Resume flow from a specific node ---
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
    // Inject edges into node for wait processing
    currentNode._edges = edges;
    const result = await executeNode(supabase, currentNode, lead, instanceName, "", botId, workspaceId);

    if (!result.success) break;
    if (result.waitPaused) break; // Flow paused at another wait node

    if (currentNode.type === "condition" || (currentNode.data?.type === "condition")) {
      const label = result.conditionResult ? "true" : "false";
      currentNode = getNextNode(currentNode.id, nodes, edges, label);
    } else {
      currentNode = getNextNode(currentNode.id, nodes, edges);
    }
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
    // Inject edges into node for wait processing
    currentNode._edges = edges;
    const result = await executeNode(supabase, currentNode, lead, instanceName, messageId, botId, workspaceId);

    if (!result.success) break;
    if (result.waitPaused) break; // Flow paused at wait node — will be resumed by webhook or cron

    if (currentNode.type === "condition" || (currentNode.data?.type === "condition")) {
      const label = result.conditionResult ? "true" : "false";
      currentNode = getNextNode(currentNode.id, nodes, edges, label);
    } else {
      currentNode = getNextNode(currentNode.id, nodes, edges);
    }
  }

  // Increment executions count
  try {
    const { error: rpcErr } = await supabase.rpc("increment_bot_executions_count", { bot_id_param: botId });
    if (rpcErr) {
      // Fallback: manual increment
      await supabase.from("salesbots").update({ executions_count: (bot as any).executions_count + 1 }).eq("id", botId);
    }
  } catch (_) {
    // ignore increment errors
  }
}

// --- Follow-up delay calculator ---
function getFollowupDelayMs(value: number, unit: string): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours": return value * 3600 * 1000;
    case "days": return value * 86400 * 1000;
    default: return value * 60 * 1000;
  }
}

// --- CORS ---
app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// --- Main webhook endpoint ---
app.post("/", async (c) => {
  try {
    // Validate apikey from header OR query parameter
    const apiKey = c.req.header("apikey") || c.req.query("apikey");
    if (!apiKey || apiKey !== EVOLUTION_API_KEY) {
      console.warn("[whatsapp-webhook] ❌ Invalid apikey - header:", !!c.req.header("apikey"), "query:", !!c.req.query("apikey"));
      return c.json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const payload = await c.req.json();
    console.log("[whatsapp-webhook] 📩 Webhook received from instance:", payload.instance, "event:", payload.event);
    const event = (payload.event || "").toUpperCase().replace(/\./g, "_");

    if (event !== "MESSAGES_UPSERT") {
      console.log("[whatsapp-webhook] ⏭️ Skipping event:", payload.event, "→ normalized:", event);
      return c.json({ received: true, skipped: true }, 200, corsHeaders);
    }

    const data = payload.data;
    const instanceName = payload.instance;

    if (!data || !instanceName) {
      console.log("[whatsapp-webhook] ⚠️ Missing data or instanceName. data:", !!data, "instanceName:", instanceName);
      return c.json({ received: true, skipped: true }, 200, corsHeaders);
    }

    const key = data.key || {};
    const remoteJid: string = key.remoteJid || "";
    const fromMe: boolean = key.fromMe || false;
    const msgId: string = key.id || "";

    console.log("[whatsapp-webhook] 📨 MSG details:", { instanceName, remoteJid, fromMe, msgId: msgId.substring(0, 20) });

    const supabase = getSupabase();

    if (fromMe) {
      // --- Pause/Resume code detection for AI agents ---
      const fromMeText = data.message?.conversation || data.message?.extendedTextMessage?.text || "";
      if (fromMeText.trim()) {
        try {
          // Find workspace for this instance
          const { data: instRow } = await supabase
            .from("whatsapp_instances")
            .select("workspace_id")
            .eq("instance_name", instanceName)
            .maybeSingle();

          if (instRow?.workspace_id) {
            // Find active agents that match this instance (or all instances)
            const { data: agents } = await supabase
              .from("ai_agents")
              .select("id, pause_code, resume_keyword, instance_name")
              .eq("workspace_id", instRow.workspace_id)
              .eq("is_active", true);

            if (agents && agents.length > 0) {
              const trimmedText = fromMeText.trim();
              // Find agent matching this instance (or with no instance filter)
              const matchingAgent = agents.find(a =>
                !a.instance_name || a.instance_name === instanceName
              );

              if (matchingAgent) {
                const contactJid = remoteJid;

                if (matchingAgent.pause_code && trimmedText === matchingAgent.pause_code.trim()) {
                  console.log("[whatsapp-webhook] ⏸️ Pause code detected for agent", matchingAgent.id, "contact:", contactJid);
                  // Set is_paused on matching memory
                  await supabase
                    .from("agent_memories")
                    .update({ is_paused: true })
                    .eq("agent_id", matchingAgent.id)
                    .eq("session_id", contactJid);

                  // Cancel pending follow-ups
                  await supabase
                    .from("agent_followup_queue")
                    .update({ status: "canceled", canceled_reason: "pause_code" })
                    .eq("agent_id", matchingAgent.id)
                    .eq("session_id", contactJid)
                    .eq("status", "pending");

                  console.log("[whatsapp-webhook] ✅ Agent paused for contact:", contactJid);
                } else if (matchingAgent.resume_keyword && trimmedText === matchingAgent.resume_keyword.trim()) {
                  console.log("[whatsapp-webhook] ▶️ Resume keyword detected for agent", matchingAgent.id, "contact:", contactJid);
                  await supabase
                    .from("agent_memories")
                    .update({ is_paused: false })
                    .eq("agent_id", matchingAgent.id)
                    .eq("session_id", contactJid);

                  console.log("[whatsapp-webhook] ✅ Agent resumed for contact:", contactJid);
                }
              }
            }
          }
        } catch (e) {
          console.error("[whatsapp-webhook] Error checking pause/resume code:", e);
        }
      }
      // --- End pause/resume ---
      console.log("[whatsapp-webhook] ⏭️ Skipped: fromMe=true for", instanceName, "jid:", remoteJid);
      return c.json({ received: true, skipped: "fromMe" }, 200, corsHeaders);
    }

    if (remoteJid.endsWith("@g.us")) {
      console.log("[whatsapp-webhook] ⏭️ Skipped: group message for", instanceName);
      return c.json({ received: true, skipped: "group" }, 200, corsHeaders);
    }

    // Extract text from all known message types
    let messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      "";

    // Template messages — extract hydrated content
    if (!messageText && data.message?.templateMessage) {
      const tpl = data.message.templateMessage;
      messageText =
        tpl.hydratedTemplate?.hydratedContentText ||
        tpl.hydratedFourRowTemplate?.hydratedContentText ||
        tpl.hydratedTemplate?.hydratedTitleText ||
        tpl.hydratedFourRowTemplate?.hydratedTitleText ||
        "";
      if (!messageText) messageText = "📋 Mensagem de template";
    }

    // Button reply (user pressed a button on a template/interactive message)
    if (!messageText && data.message?.buttonsResponseMessage) {
      messageText = data.message.buttonsResponseMessage.selectedDisplayText || "✅ Resposta de botão";
    }

    // Template button reply (e.g. quick reply buttons on templates)
    if (!messageText && data.message?.templateButtonReplyMessage) {
      messageText = data.message.templateButtonReplyMessage.selectedDisplayText || "✅ Resposta de botão";
    }

    // List response
    if (!messageText && data.message?.listResponseMessage) {
      messageText = data.message.listResponseMessage.title || data.message.listResponseMessage.description || "✅ Resposta de lista";
    }

    // Interactive message body (buttons sent by business)
    if (!messageText && data.message?.interactiveMessage?.body?.text) {
      messageText = data.message.interactiveMessage.body.text;
      const footer = data.message.interactiveMessage.footer?.text;
      if (footer) messageText += `\n\n${footer}`;
    }

    // Interactive response (nativeFlowResponseMessage, etc.)
    if (!messageText && data.message?.interactiveResponseMessage) {
      const body = data.message.interactiveResponseMessage.body;
      messageText = typeof body === "string" ? body : body?.text || "✅ Resposta interativa";
    }

    let mediaType: string | null = null;
    let mediaCaption: string | null = null;

    if (data.message?.imageMessage) {
      mediaType = "image";
      mediaCaption = data.message.imageMessage.caption || null;
    } else if (data.message?.audioMessage) {
      mediaType = "audio";
    } else if (data.message?.videoMessage) {
      mediaType = "video";
      mediaCaption = data.message.videoMessage.caption || null;
    } else if (data.message?.documentMessage) {
      mediaType = "document";
      mediaCaption = data.message.documentMessage.caption || null;
    }

    if (mediaType) {
      console.log(`[whatsapp-webhook] 🖼️ Media detected: type=${mediaType}, caption="${mediaCaption?.substring(0, 50) || 'none'}"`);
    }

    const pushName = data.pushName || "";

    let resolvedRemoteJid = remoteJid;
    let phoneNumber = "";
    
    if (remoteJid.endsWith("@lid")) {
      // Multiple fallback strategies to resolve @lid to real phone number
      const participant = data.participant || data.key?.participant || "";
      const remoteJidAlt = data.key?.remoteJidAlt || data.remoteJidAlt || "";
      
      if (participant && !participant.endsWith("@lid")) {
        resolvedRemoteJid = participant;
        phoneNumber = jidToNumber(participant);
        console.log(`[whatsapp-webhook] 🔄 @lid resolved via participant: ${remoteJid} → ${participant}`);
      } else if (remoteJidAlt && !remoteJidAlt.endsWith("@lid")) {
        resolvedRemoteJid = remoteJidAlt;
        phoneNumber = jidToNumber(remoteJidAlt);
        console.log(`[whatsapp-webhook] 🔄 @lid resolved via remoteJidAlt: ${remoteJid} → ${remoteJidAlt}`);
      } else {
        // Attempt to resolve via Evolution API fetchProfile
        console.log(`[whatsapp-webhook] 🔍 @lid not resolved locally, trying Evolution API fetchProfile for ${remoteJid}...`);
        try {
          const profileData = await evolutionFetch(`/chat/fetchProfile/${instanceName}`, "POST", {
            number: jidToNumber(remoteJid),
          });
          const resolvedNumber = profileData?.number || profileData?.wuid || profileData?.jid || "";
          const cleanNumber = resolvedNumber ? jidToNumber(String(resolvedNumber)) : "";
          if (cleanNumber && cleanNumber.length >= 10 && cleanNumber.length <= 15 && /^\d+$/.test(cleanNumber)) {
            resolvedRemoteJid = `${cleanNumber}@s.whatsapp.net`;
            phoneNumber = cleanNumber;
            console.log(`[whatsapp-webhook] 🔄 @lid resolved via fetchProfile: ${remoteJid} → ${cleanNumber}`);
          } else {
            // Last resort: use LID as-is for session tracking, but flag it
            phoneNumber = jidToNumber(remoteJid);
            console.warn(`[whatsapp-webhook] ⚠️ @lid could NOT be resolved for ${remoteJid}. fetchProfile returned: ${JSON.stringify(profileData)}`);
            console.warn(`[whatsapp-webhook] ⚠️ AI agent will use LID as session_id but may fail to send reply. pushName: ${pushName}`);
          }
        } catch (fetchErr) {
          phoneNumber = jidToNumber(remoteJid);
          console.error(`[whatsapp-webhook] ❌ @lid fetchProfile error:`, fetchErr);
        }
      }
    } else {
      phoneNumber = jidToNumber(remoteJid);
    }

    const canonicalSessionJid = (!resolvedRemoteJid.endsWith("@lid") ? resolvedRemoteJid : remoteJid) || remoteJid;

    console.log(`[whatsapp-webhook] 📩 MSG from ${pushName} (${remoteJid}) on instance "${instanceName}": "${messageText?.substring(0, 100)}"`);

    // ============ CHECK SALESBOT WAIT QUEUE FOR INBOUND MESSAGE ============
    try {
      const waitSessionIds = Array.from(new Set([remoteJid, canonicalSessionJid]));
      const { data: pendingWaits } = await supabase
        .from("salesbot_wait_queue")
        .select("*")
        .in("session_id", waitSessionIds)
        .eq("status", "pending")
        .eq("condition_type", "message_received");

      if (pendingWaits && pendingWaits.length > 0) {
        console.log(`[whatsapp-webhook] 🔄 Found ${pendingWaits.length} pending wait(s) for session ${remoteJid}`);
        
        // Group by wait_node_id to cancel siblings
        const byWaitNode = new Map<string, any[]>();
        for (const pw of pendingWaits) {
          const arr = byWaitNode.get(pw.wait_node_id) || [];
          arr.push(pw);
          byWaitNode.set(pw.wait_node_id, arr);
        }

        for (const [waitNodeId, items] of byWaitNode) {
          const msgItem = items[0]; // The message_received condition

          // Cancel ALL siblings (same wait_node_id, same lead)
          await supabase
            .from("salesbot_wait_queue")
            .update({ status: "canceled", canceled_reason: "sibling_triggered", executed_at: new Date().toISOString() })
            .eq("wait_node_id", waitNodeId)
            .eq("lead_id", msgItem.lead_id)
            .eq("status", "pending")
            .neq("id", msgItem.id);

          // Mark this one as executed
          await supabase
            .from("salesbot_wait_queue")
            .update({ status: "executed", executed_at: new Date().toISOString() })
            .eq("id", msgItem.id);

          // Resume flow from target node
          const { data: lead } = await supabase
            .from("leads")
            .select("*")
            .eq("id", msgItem.lead_id)
            .single();

          if (lead) {
            const leadInstanceName = lead.instance_name || instanceName;
            await resumeFlowFromNode(supabase, msgItem.bot_id, lead, msgItem.target_node_id, leadInstanceName, msgItem.workspace_id);
            console.log(`[whatsapp-webhook] ✅ Resumed flow for lead ${lead.name} from node ${msgItem.target_node_id}`);
          }
        }

        // Message was handled by wait queue — return
        return c.json({ received: true, handler: "salesbot_wait_resume" }, 200, corsHeaders);
      }
    } catch (waitErr) {
      console.error("[whatsapp-webhook] Wait queue check error:", waitErr);
    }

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

    // ═══ PERSIST INBOUND MESSAGE IMMEDIATELY ═══
    // This ensures all received messages appear in the Chat UI in real-time
    const agentMessage = messageText || mediaCaption || (mediaType ? `[${mediaType === "image" ? "Imagem" : mediaType === "audio" ? "Áudio" : mediaType === "video" ? "Vídeo" : "Documento"} recebido]` : "");
    if (agentMessage || mediaType) {
      try {
        await supabase.from("whatsapp_messages").insert({
          workspace_id: workspaceId,
          instance_name: instanceName,
          remote_jid: canonicalSessionJid,
          from_me: false,
          direction: "inbound",
          content: agentMessage,
          message_type: mediaType || "text",
          message_id: msgId || `in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          push_name: pushName || null,
          timestamp: new Date().toISOString(),
        });
        console.log(`[whatsapp-webhook] 💾 Inbound message persisted for ${canonicalSessionJid}`);
      } catch (persistErr) {
        // Don't block processing if persist fails (e.g. duplicate message_id)
        console.warn(`[whatsapp-webhook] ⚠️ Inbound persist failed (non-blocking):`, persistErr);
      }
    }

    // Global webhook dedup + canonical session mapping (applies to AI and SalesBots)
    if (msgId) {
      const { error: dedupError } = await supabase
        .from("webhook_message_log")
        .insert({ message_id: msgId, session_id: canonicalSessionJid, workspace_id: workspaceId });

      if (dedupError) {
        console.log(`[whatsapp-webhook] ⚠️ Duplicate webhook event ignored: ${msgId}`);
        return c.json({ received: true, skipped: "duplicate_message" }, 200, corsHeaders);
      }
      console.log(`[whatsapp-webhook] ✅ Message logged for dedup: ${msgId} -> ${canonicalSessionJid}`);
    }

    // --- STEP 1: Check for active AI Agent ---
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("id, instance_name, respond_to, respond_to_stages")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    console.log(`[whatsapp-webhook] 🤖 Active agents found: ${agents?.length || 0}`);

    if (agents && agents.length > 0) {
      const matchingAgent = agents.find((a: any) => {
        return !a.instance_name || a.instance_name === "" || a.instance_name === instanceName;
      });

      if (matchingAgent) {
        console.log(`[whatsapp-webhook] 🎯 Agent matched: ${matchingAgent.id} (instance filter: "${matchingAgent.instance_name || 'all'}")`);
      } else {
        console.log(`[whatsapp-webhook] ⚠️ No agent matched for instance "${instanceName}". Agent instances: ${agents.map((a: any) => a.instance_name || 'all').join(', ')}`);
      }

      if (matchingAgent && (messageText || mediaType)) {
        // Deduplication already handled globally above

        // Check respond_to filter
        let shouldRespond = true;
        
        let leadId: string | null = null;
        // Search by JID + phone suffix to avoid missing leads with different JID format
        const agentLeadOrFilters = [`whatsapp_jid.eq.${remoteJid}`];
        if (resolvedRemoteJid !== remoteJid) agentLeadOrFilters.push(`whatsapp_jid.eq.${resolvedRemoteJid}`);
        if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
          agentLeadOrFilters.push(`phone.like.%${phoneNumber.slice(-10)}`);
        }
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, stage_id")
          .eq("workspace_id", workspaceId)
          .or(agentLeadOrFilters.join(','))
          .limit(1)
          .single();
        leadId = existingLead?.id || null;

        // Auto-create lead if none exists (so AI-handled chats get a funnel card)
        if (!leadId && phoneNumber.length >= 10 && phoneNumber.length <= 15) {
          try {
            const { data: defaultFunnel } = await supabase
              .from("funnels").select("id")
              .eq("workspace_id", workspaceId).eq("is_default", true)
              .limit(1).single();

            let stageId: string | null = null;
            if (defaultFunnel) {
              const { data: firstStage } = await supabase
                .from("funnel_stages").select("id")
                .eq("funnel_id", defaultFunnel.id)
                .order("position", { ascending: true }).limit(1).single();
              stageId = firstStage?.id || null;
            }
            if (!stageId) {
              const { data: anyStage } = await supabase
                .from("funnel_stages").select("id")
                .eq("workspace_id", workspaceId)
                .order("position", { ascending: true }).limit(1).single();
              stageId = anyStage?.id || null;
            }

            if (stageId) {
              const preferredJid = (!resolvedRemoteJid.endsWith("@lid") ? resolvedRemoteJid : remoteJid) || remoteJid;
              const { data: newLead } = await supabase
                .from("leads").insert({
                  name: pushName || `+${phoneNumber}`,
                  phone: phoneNumber,
                  whatsapp_jid: preferredJid,
                  instance_name: instanceName,
                  source: "whatsapp",
                  stage_id: stageId,
                  workspace_id: workspaceId,
                }).select("id").single();

              if (newLead) {
                leadId = newLead.id;
                console.log(`[whatsapp-webhook] ✅ Auto-created lead for AI agent: ${leadId}`);
              }
            }
          } catch (autoLeadErr) {
            console.error("[whatsapp-webhook] Auto-create lead error:", autoLeadErr);
          }
        }

        if (matchingAgent.respond_to === "specific_stages" && existingLead) {
          const stages = matchingAgent.respond_to_stages || [];
          if (stages.length > 0 && !stages.includes(existingLead.stage_id)) {
            shouldRespond = false;
            console.log(`[whatsapp-webhook] ⏭️ Agent skipped: lead stage ${existingLead.stage_id} not in ${JSON.stringify(stages)}`);
          }
        }

        if (shouldRespond) {
          // --- Cancel any pending follow-ups for this session ---
          try {
            const followupSessionIds = Array.from(new Set([remoteJid, canonicalSessionJid]));
            await supabase.from("agent_followup_queue")
              .update({ status: "canceled", canceled_reason: "lead_responded" })
              .in("session_id", followupSessionIds)
              .eq("status", "pending");
            console.log(`[whatsapp-webhook] 📅 Canceled pending follow-ups for session ${canonicalSessionJid}`);
          } catch (fErr) {
            console.error("[whatsapp-webhook] Follow-up cancel error:", fErr);
          }

          // Call ai-agent-chat internally
          try {
            const agentUrl = `${SUPABASE_URL}/functions/v1/ai-agent-chat`;

            let mediaBase64: string | null = null;
            let mediaMimetype: string | null = null;

            if (mediaType && (mediaType === "image" || mediaType === "audio") && msgId) {
              console.log(`[whatsapp-webhook] 📥 Downloading ${mediaType} base64 via Evolution API...`);
              try {
                const mediaController = new AbortController();
                const mediaTimeout = setTimeout(() => mediaController.abort(), 25000);

                const mediaRes = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
                  body: JSON.stringify({ message: { key: data.key }, convertToMp4: false }),
                  signal: mediaController.signal,
                });
                clearTimeout(mediaTimeout);

                if (mediaRes.ok) {
                  const mediaData = await mediaRes.json();
                  const b64 = mediaData.base64 || mediaData.data?.base64 || "";
                  const mime = mediaData.mimetype || mediaData.data?.mimetype || "";

                  const sizeBytes = (b64.length * 3) / 4;
                  if (sizeBytes > 5 * 1024 * 1024) {
                    console.warn(`[whatsapp-webhook] ⚠️ Media too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB), skipping`);
                    mediaBase64 = null;
                  } else {
                    mediaBase64 = b64;
                    mediaMimetype = mime;
                    console.log(`[whatsapp-webhook] ✅ Media downloaded: ${mime}, ${(sizeBytes / 1024).toFixed(0)}KB`);
                  }
                } else {
                  const errBody = await mediaRes.text().catch(() => "");
                  console.error(`[whatsapp-webhook] ❌ Media download failed: ${mediaRes.status} - ${errBody.substring(0, 200)}`);
                }
              } catch (mediaErr: any) {
                if (mediaErr.name === "AbortError") {
                  console.error("[whatsapp-webhook] ❌ Media download timeout (25s)");
                } else {
                  console.error("[whatsapp-webhook] ❌ Media download error:", mediaErr.message || mediaErr);
                }
              }
            }

            const agentMessage = messageText || mediaCaption || (mediaType ? `[${mediaType === "image" ? "Imagem" : mediaType === "audio" ? "Áudio" : "Mídia"} enviada pelo lead]` : "");

            console.log(`[whatsapp-webhook] 🚀 Calling ai-agent-chat for agent ${matchingAgent.id}, session ${canonicalSessionJid}, lead ${leadId}, msgId ${msgId}, media=${mediaType || 'none'}`);
            
            const agentRes = await fetch(agentUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                agent_id: matchingAgent.id,
                session_id: canonicalSessionJid,
                message: agentMessage,
                lead_id: leadId,
                message_id: msgId,
                phone_number: phoneNumber,
                instance_name: instanceName,
                _internal_webhook: true,
                media_type: mediaType,
                media_base64: mediaBase64,
                media_mimetype: mediaMimetype,
              }),
            });

            const agentData = await agentRes.json();
            console.log(`[whatsapp-webhook] 📤 Agent response status: ${agentRes.status}, has chunks: ${!!agentData.chunks}, skipped: ${agentData.skipped || false}, error: ${agentData.error || 'none'}`);

            if (agentData.error) {
              console.error(`[whatsapp-webhook] ❌ Agent error: ${agentData.error}`);
            }

            // Determine the best number to send to
            // For @lid contacts that couldn't be resolved, try sending to the original JID
            const sendToNumber = (phoneNumber.length >= 10 && phoneNumber.length <= 15 && /^\d+$/.test(phoneNumber))
              ? phoneNumber
              : remoteJid; // Use full JID (Evolution API may handle @lid internally)

            // Helper: extract media references from AI text like [Vídeo anexo: URL], [Imagem anexa: URL], [PDF anexo: URL]
            const mediaPattern = /\[(Vídeo anexo|Imagem anexa|PDF anexo|Anexo|Video anexo|Imagen anexa):\s*(https?:\/\/[^\]\s]+)\]/gi;

            const extractMediaFromChunk = (text: string) => {
              const medias: Array<{ url: string; type: string }> = [];
              let match;
              const regex = new RegExp(mediaPattern.source, "gi");
              while ((match = regex.exec(text)) !== null) {
                const label = match[1].toLowerCase();
                let mediatype = "document";
                if (label.includes("vídeo") || label.includes("video")) mediatype = "video";
                else if (label.includes("imagem") || label.includes("imagen")) mediatype = "image";
                else if (label.includes("pdf")) mediatype = "document";
                medias.push({ url: match[2], type: mediatype });
              }
              const cleanText = text.replace(new RegExp(mediaPattern.source, "gi"), "").replace(/\n{3,}/g, "\n\n").trim();
              return { medias, cleanText };
            };

            const sendWithFallback = async (endpoint: string, payload: any) => {
              let result = await evolutionFetch(`/message/${endpoint}/${instanceName}`, "POST", payload);
              if (!result && payload.number !== remoteJid) {
                console.log(`[whatsapp-webhook] 🔄 Retrying ${endpoint} with original JID: ${remoteJid}`);
                result = await evolutionFetch(`/message/${endpoint}/${instanceName}`, "POST", { ...payload, number: remoteJid });
              }
              return result;
            };

            if (agentData.chunks && Array.isArray(agentData.chunks)) {
              console.log(`[whatsapp-webhook] 💬 Sending ${agentData.chunks.length} chunks to ${sendToNumber}`);
              for (const chunk of agentData.chunks) {
                if (chunk && chunk.trim()) {
                  const { medias, cleanText } = extractMediaFromChunk(chunk);

                  // Send clean text first (if any)
                  if (cleanText) {
                    const sendResult = await sendWithFallback("sendText", {
                      number: sendToNumber,
                      text: cleanText,
                      delay: 0,
                      linkPreview: false,
                    });
                    if (sendResult) {
                      await supabase.from("whatsapp_messages").insert({
                        workspace_id: workspaceId,
                        instance_name: instanceName,
                        remote_jid: canonicalSessionJid,
                        from_me: true,
                        direction: "outbound",
                        content: cleanText,
                        message_type: "text",
                        push_name: "IA",
                        message_id: `out-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        timestamp: new Date().toISOString(),
                      });
                    } else {
                      console.error(`[whatsapp-webhook] ❌ Failed to send text chunk`);
                    }
                  }

                  // Send each extracted media
                  for (const media of medias) {
                    console.log(`[whatsapp-webhook] 📎 Sending FAQ media: ${media.type} → ${media.url}`);
                    await new Promise((r) => setTimeout(r, 500));
                    const mediaResult = await sendWithFallback("sendMedia", {
                      number: sendToNumber,
                      mediatype: media.type,
                      media: media.url,
                      delay: 0,
                    });
                    if (mediaResult) {
                      await supabase.from("whatsapp_messages").insert({
                        workspace_id: workspaceId,
                        instance_name: instanceName,
                        remote_jid: canonicalSessionJid,
                        from_me: true,
                        direction: "outbound",
                        content: media.url,
                        message_type: media.type === "image" ? "image" : media.type === "video" ? "video" : "document",
                        push_name: "IA",
                        message_id: `out-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        timestamp: new Date().toISOString(),
                      });
                    } else {
                      console.error(`[whatsapp-webhook] ❌ Failed to send FAQ media: ${media.url}`);
                    }
                  }

                  if (agentData.chunks.length > 1) {
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                }
              }
              console.log(`[whatsapp-webhook] ✅ Agent response sent successfully`);
            } else if (agentData.response) {
              const { medias: singleMedias, cleanText: singleCleanText } = extractMediaFromChunk(agentData.response);

              if (singleCleanText) {
                const sendResult = await sendWithFallback("sendText", {
                  number: sendToNumber,
                  text: singleCleanText,
                  delay: 0,
                  linkPreview: false,
                });
                if (sendResult) {
                  console.log(`[whatsapp-webhook] ✅ Agent single response sent`);
                  await supabase.from("whatsapp_messages").insert({
                    workspace_id: workspaceId,
                    instance_name: instanceName,
                    remote_jid: canonicalSessionJid,
                    from_me: true,
                    direction: "outbound",
                    content: singleCleanText,
                    message_type: "text",
                    push_name: "IA",
                    message_id: `out-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                  });
                } else {
                  console.error(`[whatsapp-webhook] ❌ Failed to send agent response`);
                }
              }

              for (const media of singleMedias) {
                console.log(`[whatsapp-webhook] 📎 Sending FAQ media (single): ${media.type} → ${media.url}`);
                await new Promise((r) => setTimeout(r, 500));
                const mediaResult = await sendWithFallback("sendMedia", {
                  number: sendToNumber,
                  mediatype: media.type,
                  media: media.url,
                  delay: 0,
                });
                if (mediaResult) {
                  await supabase.from("whatsapp_messages").insert({
                    workspace_id: workspaceId,
                    instance_name: instanceName,
                    remote_jid: canonicalSessionJid,
                    from_me: true,
                    direction: "outbound",
                    content: media.url,
                    message_type: media.type === "image" ? "image" : media.type === "video" ? "video" : "document",
                    push_name: "IA",
                    message_id: `out-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            } else if (agentData.skipped) {
              console.log(`[whatsapp-webhook] ⏭️ Agent skipped: ${agentData.reason || 'unknown reason'}`);
            } else if (agentData.paused) {
              console.log(`[whatsapp-webhook] ⏸️ Agent paused for this session`);
            }

            // --- Schedule follow-up if agent has followup_enabled ---
            if (!agentData.paused && !agentData.skipped && leadId) {
              try {
                const { data: agentFull } = await supabase
                  .from("ai_agents")
                  .select("followup_enabled, followup_sequence")
                  .eq("id", matchingAgent.id)
                  .single();

                if (agentFull?.followup_enabled && agentFull.followup_sequence?.length > 0) {
                  const firstStep = agentFull.followup_sequence[0];
                  const delayMs = getFollowupDelayMs(firstStep.delay_value, firstStep.delay_unit);
                  const executeAt = new Date(Date.now() + delayMs).toISOString();

                  await supabase.from("agent_followup_queue").insert({
                    agent_id: matchingAgent.id,
                    lead_id: leadId,
                    session_id: canonicalSessionJid,
                    workspace_id: workspaceId,
                    step_index: 0,
                    execute_at: executeAt,
                    status: "pending",
                  });
                  console.log(`[whatsapp-webhook] 📅 Follow-up scheduled: step 0, execute_at ${executeAt}`);
                }
              } catch (fErr) {
                console.error("[whatsapp-webhook] Follow-up schedule error:", fErr);
              }
            }
          } catch (err) {
            console.error("[whatsapp-webhook] ❌ AI Agent call exception:", err);
          }

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

    // Search for existing lead by JID OR normalized phone (last 10 digits)
    const leadOrFilters = [`whatsapp_jid.eq.${remoteJid}`];
    if (resolvedRemoteJid !== remoteJid) leadOrFilters.push(`whatsapp_jid.eq.${resolvedRemoteJid}`);
    if (phoneNumber.length >= 10 && phoneNumber.length <= 13) {
      leadOrFilters.push(`phone.like.%${phoneNumber.slice(-10)}`);
    }
    let { data: existingLead } = await supabase
      .from("leads")
      .select("*")
      .eq("workspace_id", workspaceId)
      .or(leadOrFilters.join(','))
      .limit(1)
      .single();

    const isNewLead = !existingLead;

    // Keep lead linked to canonical JID (prefer real phone JID over @lid)
    const preferredLeadJid = (!resolvedRemoteJid.endsWith("@lid") ? resolvedRemoteJid : remoteJid) || remoteJid;
    if (existingLead && preferredLeadJid) {
      const needsJidUpdate = !existingLead.whatsapp_jid || existingLead.whatsapp_jid !== preferredLeadJid;
      const needsInstanceUpdate = !existingLead.instance_name && instanceName;
      if (needsJidUpdate || needsInstanceUpdate) {
        const updatePayload: Record<string, string> = {};
        if (needsJidUpdate) updatePayload.whatsapp_jid = preferredLeadJid;
        if (needsInstanceUpdate) updatePayload.instance_name = instanceName;
        await supabase.from("leads").update(updatePayload).eq("id", existingLead.id);
        existingLead.whatsapp_jid = preferredLeadJid;
        if (needsInstanceUpdate) existingLead.instance_name = instanceName;
        console.log(`[whatsapp-webhook] 📝 Updated lead ${existingLead.name} JID: ${preferredLeadJid}`);
      }
    }

    let matchedBot: any = null;

    for (const bot of bots) {
      const triggerType = bot.trigger_type;
      const triggerConfig = (bot.trigger_config || {}) as Record<string, any>;

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
          whatsapp_jid: preferredLeadJid,
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
