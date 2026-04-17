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

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '$2');
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
                    .update({ is_paused: true, updated_at: new Date().toISOString() })
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
                    .update({ is_paused: false, updated_at: new Date().toISOString() })
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

    if (remoteJid === "status@broadcast") {
      console.log("[whatsapp-webhook] ⏭️ Skipped: status broadcast for", instanceName);
      return c.json({ received: true, skipped: "status_broadcast" }, 200, corsHeaders);
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
    } else if (data.message?.contactMessage || data.message?.contactsArrayMessage) {
      mediaType = "contact";
      // Parse vCard contact(s)
      const contacts: { displayName: string; vcard: string }[] = [];
      if (data.message?.contactMessage) {
        const c = data.message.contactMessage;
        contacts.push({
          displayName: c.displayName || "Contato",
          vcard: c.vcard || "",
        });
      } else if (data.message?.contactsArrayMessage?.contacts) {
        for (const c of data.message.contactsArrayMessage.contacts) {
          contacts.push({
            displayName: c.displayName || "Contato",
            vcard: c.vcard || "",
          });
        }
      }
      // Extract phone numbers from vCards
      const contactEntries = contacts.map((c) => {
        const telMatch = c.vcard.match(/TEL[^:]*:([\d+\s-]+)/i);
        const phone = telMatch ? telMatch[1].replace(/[\s-]/g, "") : "";
        return { name: c.displayName, phone };
      });
      // Store as structured text for the UI
      messageText = contactEntries
        .map((c) => `📇 ${c.name}${c.phone ? `\n📱 ${c.phone}` : ""}`)
        .join("\n\n");
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

    // ============ WORKSPACE ASSISTANT VIA WHATSAPP ============
    const ASSISTANT_INSTANCE = Deno.env.get("ASSISTANT_INSTANCE_NAME") || "";
    if (ASSISTANT_INSTANCE && instanceName === ASSISTANT_INSTANCE) {
      console.log(`[whatsapp-webhook] 🤖 Assistant instance detected! Routing to workspace assistant for phone: ${phoneNumber}`);
      const questionText = messageText?.trim();
      if (!questionText) {
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber,
          text: "👋 Olá! Sou o Assistente de Workspace do Argos X. Me faça uma pergunta sobre seu workspace!\n\nExemplos:\n• Quantos leads entraram essa semana?\n• Tem alguém sem resposta?\n• Como estão minhas campanhas?",
          delay: 0, linkPreview: false,
        });
        return c.json({ received: true, handler: "assistant_greeting" }, 200, corsHeaders);
      }

      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const phoneSuffix = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

      // Find ALL profiles matching this phone number
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, phone, personal_whatsapp, full_name")
        .or(`phone.like.%${phoneSuffix},personal_whatsapp.like.%${phoneSuffix}`);

      if (!profiles || profiles.length === 0) {
        console.warn(`[whatsapp-webhook] ❌ Assistant: no user found for phone ${phoneNumber}`);
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber,
          text: "❌ Não encontrei seu cadastro no sistema. Certifique-se de que seu telefone está cadastrado no seu perfil do Argos X.",
          delay: 0, linkPreview: false,
        });
        return c.json({ received: true, handler: "assistant_no_user" }, 200, corsHeaders);
      }

      // Collect ALL unique user_ids from matching profiles
      const matchedUserIds = [...new Set(profiles.map((p: any) => p.user_id))];

      // Find ALL workspaces for ALL matched users
      const { data: wsMembers } = await supabase
        .from("workspace_members")
        .select("workspace_id, user_id")
        .in("user_id", matchedUserIds)
        .not("accepted_at", "is", null);

      if (!wsMembers || wsMembers.length === 0) {
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber,
          text: "❌ Não encontrei um workspace ativo associado à sua conta.",
          delay: 0, linkPreview: false,
        });
        return c.json({ received: true, handler: "assistant_no_ws" }, 200, corsHeaders);
      }

      // Get all unique workspace names
      const wsIds = [...new Set(wsMembers.map((m: any) => m.workspace_id))];
      const { data: allWorkspaces } = await supabase
        .from("workspaces")
        .select("id, name")
        .in("id", wsIds);

      const wsList = allWorkspaces || [];
      let assistantWsId: string;
      let assistantUserId: string;

      if (wsList.length === 1) {
        assistantWsId = wsList[0].id;
        assistantUserId = wsMembers.find((m: any) => m.workspace_id === assistantWsId)!.user_id;
      } else {
        // Multiple workspaces — check if user mentioned a workspace name in the question
        const qLower = questionText!.toLowerCase();
        const matchedWs = wsList.find((ws: any) => {
          const wsNameLower = ws.name.toLowerCase().trim();
          if (qLower.includes(wsNameLower)) return true;
          // Also match significant words (>3 chars) from workspace name
          return wsNameLower.split(/\s+/).some((word: string) => word.length > 3 && qLower.includes(word.toLowerCase()));
        });

        if (matchedWs) {
          assistantWsId = matchedWs.id;
          assistantUserId = wsMembers.find((m: any) => m.workspace_id === assistantWsId)!.user_id;
        } else {
          // No workspace mentioned — ask user to specify
          const wsNames = wsList.map((ws: any, i: number) => `${i + 1}. *${ws.name}*`).join("\n");
          await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
            number: phoneNumber,
            text: `Você tem acesso a ${wsList.length} workspaces:\n\n${wsNames}\n\n📝 Inclua o nome do workspace na sua pergunta.\n\nEx: _"Quantos leads entraram essa semana no Argos X?"_`,
            delay: 0, linkPreview: false,
          });
          return c.json({ received: true, handler: "assistant_multi_ws" }, 200, corsHeaders);
        }
      }

      console.log(`[whatsapp-webhook] 🤖 Assistant: user=${assistantUserId}, ws=${assistantWsId}, workspaces=${wsList.length}`);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const hours24Ago = new Date(now.getTime() - 24 * 3600000).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const week7 = new Date(now.getTime() + 7 * 86400000).toISOString();

      const [aLeads, aWeek, aToday, aRecent, aAgents, aStages, aCampaigns, aWs, aMembers, aQueue, aExecs, aCalToday, aCalUpcoming, aFollowupCampaigns, aFollowupPending, aFollowupSent] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", assistantWsId),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", assistantWsId).gte("created_at", weekAgo),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", assistantWsId).gte("created_at", todayStart),
        supabase.from("leads").select("id, name, phone, source, created_at, stage_id, value, ai_score_label").eq("workspace_id", assistantWsId).order("created_at", { ascending: false }).limit(30),
        supabase.from("ai_agents").select("id, name, is_active, type").eq("workspace_id", assistantWsId),
        supabase.from("funnel_stages").select("id, name, position").eq("workspace_id", assistantWsId).order("position"),
        supabase.from("campaigns").select("id, name, status, sent_count, total_recipients, failed_count").eq("workspace_id", assistantWsId).order("created_at", { ascending: false }).limit(5),
        supabase.from("workspaces").select("name, plan_name, status, lead_limit, subscription_status").eq("id", assistantWsId).single(),
        supabase.from("workspace_members").select("role, user_profile:user_profiles(full_name)").eq("workspace_id", assistantWsId),
        supabase.from("human_support_queue").select("id").eq("workspace_id", assistantWsId).eq("status", "pending"),
        supabase.from("agent_executions").select("agent_id, status, tokens_used, latency_ms, error_message").eq("workspace_id", assistantWsId).gte("executed_at", hours24Ago),
        supabase.from("calendar_events").select("title, start_at, end_at, type, lead:leads(name)").eq("workspace_id", assistantWsId).gte("start_at", todayStart).lt("start_at", todayEnd).order("start_at"),
        supabase.from("calendar_events").select("title, start_at, type").eq("workspace_id", assistantWsId).gte("start_at", todayEnd).lt("start_at", week7).order("start_at").limit(10),
        supabase.from("followup_campaigns").select("id, status, total_contacts, sent_count, failed_count, created_at, agent:ai_agents(name)").eq("workspace_id", assistantWsId).order("created_at", { ascending: false }).limit(5),
        supabase.from("agent_followup_queue").select("id", { count: "exact", head: true }).eq("workspace_id", assistantWsId).eq("status", "pending"),
        supabase.from("agent_followup_queue").select("id", { count: "exact", head: true }).eq("workspace_id", assistantWsId).eq("status", "sent").gte("executed_at", hours24Ago),
      ]);

      const stageMapA: Record<string, string> = {};
      (aStages.data || []).forEach((s: any) => { stageMapA[s.id] = s.name; });
      const enriched = (aRecent.data || []).map((l: any) => ({ ...l, stage_name: l.stage_id ? stageMapA[l.stage_id] || "?" : "sem etapa" }));
      const byStage: Record<string, number> = {};
      enriched.forEach((l: any) => { const s = l.stage_name; byStage[s] = (byStage[s] || 0) + 1; });

      const agentNameMap: Record<string, string> = {};
      (aAgents.data || []).forEach((a: any) => { agentNameMap[a.id] = a.name; });
      const execsByAgent: Record<string, { total: number; success: number; errors: number; tokens: number; latency_sum: number }> = {};
      (aExecs.data || []).forEach((e: any) => {
        if (!execsByAgent[e.agent_id]) execsByAgent[e.agent_id] = { total: 0, success: 0, errors: 0, tokens: 0, latency_sum: 0 };
        const a = execsByAgent[e.agent_id];
        a.total++; if (e.status === "success") a.success++; else a.errors++;
        a.tokens += e.tokens_used || 0; a.latency_sum += e.latency_ms || 0;
      });
      const aiPerformance = Object.entries(execsByAgent).map(([id, d]) => ({
        agent_name: agentNameMap[id] || id, total: d.total, success: d.success, errors: d.errors,
        success_rate: d.total > 0 ? Math.round((d.success / d.total) * 100) : 0,
        avg_latency_ms: d.total > 0 ? Math.round(d.latency_sum / d.total) : 0, tokens: d.tokens,
      }));

      const ctx = {
        workspace: aWs.data,
        stats: { total: aLeads.count || 0, semana: aWeek.count || 0, hoje: aToday.count || 0, suporte_pendente: (aQueue.data || []).length },
        leads_por_etapa: byStage,
        leads_recentes: enriched.slice(0, 15),
        agentes: aAgents.data || [],
        campanhas: aCampaigns.data || [],
        equipe: (aMembers.data || []).map((m: any) => ({ nome: (m as any).user_profile?.full_name || "?", role: m.role })),
        ai_performance_24h: aiPerformance,
        calendar_hoje: (aCalToday.data || []).map((e: any) => ({ title: e.title, start: e.start_at, end: e.end_at, type: e.type, lead: e.lead?.name })),
        calendar_proximos_7_dias: (aCalUpcoming.data || []).map((e: any) => ({ title: e.title, start: e.start_at, type: e.type })),
        followup_campaigns: (aFollowupCampaigns.data || []).map((c: any) => ({ agent: c.agent?.name, status: c.status, total: c.total_contacts, sent: c.sent_count, failed: c.failed_count })),
        followup_automaticos: { pendentes: aFollowupPending.count || 0, enviados_24h: aFollowupSent.count || 0 },
      };

      const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_KEY) {
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber, text: "⚠️ Erro interno. Contate o suporte.", delay: 0, linkPreview: false,
        });
        return c.json({ received: true, handler: "assistant_error" }, 200, corsHeaders);
      }

      const sysPrompt = `Você é o Assistente de Workspace do Argos X via WhatsApp. Responda CONCISO — máximo 2 parágrafos curtos.
DADOS (${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}):
${JSON.stringify(ctx)}
REGRAS: Português BR. Conciso (é WhatsApp). Emojis moderados. NÃO invente dados. Formate para WhatsApp (*negrito*, _itálico_). Quando mencionar leads, inclua nome e telefone.
NOVAS CAPACIDADES:
- "ai_performance_24h" mostra execuções dos agentes de IA nas últimas 24h (total, sucesso, erros, latência média, tokens). Use para responder sobre desempenho das IAs.
- "calendar_hoje" e "calendar_proximos_7_dias" mostram reuniões e eventos. Use para responder sobre agenda.
- "followup_campaigns" mostra campanhas de follow-up inteligente recentes. "followup_automaticos" mostra follow-ups de agentes (pendentes e enviados 24h).
- Se perguntarem "como foi o dia", dê resumo completo: leads, performance das IAs, reuniões, follow-ups.
- Se taxa de erro de IA > 10%, destaque como ⚠️ alerta.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "system", content: sysPrompt }, { role: "user", content: questionText }],
          }),
        });
        if (!aiResp.ok) throw new Error(`AI error: ${aiResp.status}`);
        const aiData = await aiResp.json();
        const answer = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber, text: answer, delay: 0, linkPreview: false,
        });
        console.log(`[whatsapp-webhook] ✅ Assistant replied to ${phoneNumber} in ws ${assistantWsId}`);
      } catch (aiErr) {
        console.error("[whatsapp-webhook] Assistant AI error:", aiErr);
        await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
          number: phoneNumber, text: "⚠️ Erro ao processar sua pergunta. Tente novamente.", delay: 0, linkPreview: false,
        });
      }
      return c.json({ received: true, handler: "assistant" }, 200, corsHeaders);
    }
    // ============ END WORKSPACE ASSISTANT ============

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

        // --- Process on_reply automations ---
        try {
          const leadOrFilters = [`whatsapp_jid.eq.${canonicalSessionJid}`];
          if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
            leadOrFilters.push(`phone.like.%${phoneNumber.slice(-10)}`);
          }
          const { data: replyLead } = await supabase
            .from("leads")
            .select("id, stage_id, workspace_id")
            .eq("workspace_id", workspaceId)
            .or(leadOrFilters.join(','))
            .limit(1)
            .single();

          if (replyLead?.stage_id) {
            const { data: replyAutos } = await supabase
              .from("stage_automations")
              .select("id, action_type, action_config")
              .eq("stage_id", replyLead.stage_id)
              .eq("trigger", "on_reply")
              .eq("is_active", true);

            if (replyAutos && replyAutos.length > 0) {
              for (const auto of replyAutos) {
                if (auto.action_type === "move_stage" && (auto.action_config as any)?.target_stage_id) {
                  const targetStageId = (auto.action_config as any).target_stage_id;
                  await supabase.from("leads").update({ stage_id: targetStageId }).eq("id", replyLead.id);
                  await supabase.from("lead_history").insert({
                    lead_id: replyLead.id,
                    action: "stage_changed",
                    from_stage_id: replyLead.stage_id,
                    to_stage_id: targetStageId,
                    performed_by: "Automação (resposta)",
                    workspace_id: workspaceId,
                  });
                  console.log(`[whatsapp-webhook] ➡️ on_reply: moved lead ${replyLead.id} to stage ${targetStageId}`);
                }
              }
            }
          }
        } catch (replyAutoErr) {
          console.warn(`[whatsapp-webhook] ⚠️ on_reply automation error (non-blocking):`, replyAutoErr);
        }
      } catch (persistErr) {
        // Don't block processing if persist fails (e.g. duplicate message_id)
        console.warn(`[whatsapp-webhook] ⚠️ Inbound persist failed (non-blocking):`, persistErr);
      }
    }

    // ============ CHURN SURVEY INTERCEPT ============
    // Check if this is a numeric reply (1-6) from an expired/blocked trial workspace
    const trimmedMsg = (messageText || "").trim();
    if (["1", "2", "3", "4", "5", "6"].includes(trimmedMsg)) {
      try {
        // Find workspace for this instance
        const { data: surveyInstance } = await supabase
          .from("whatsapp_instances")
          .select("workspace_id")
          .eq("instance_name", instanceName)
          .limit(1)
          .single();

        if (surveyInstance) {
          // Check if this workspace is blocked/expired trial
          const { data: surveyWs } = await supabase
            .from("workspaces")
            .select("id, subscription_status, blocked_at, name")
            .eq("id", surveyInstance.workspace_id)
            .single();

          const isExpiredTrial = surveyWs && (
            surveyWs.blocked_at ||
            surveyWs.subscription_status === "canceled" ||
            surveyWs.subscription_status === "expired"
          );

          if (isExpiredTrial) {
            // Verify they received a cadence day 8 message
            const { data: cadenceLogs } = await supabase
              .from("reactivation_log")
              .select("id")
              .eq("workspace_id", surveyWs.id)
              .eq("cadence_day", 8)
              .eq("status", "sent")
              .limit(1);

            if (cadenceLogs && cadenceLogs.length > 0) {
              // Check if already responded
              const { data: existingResponse } = await supabase
                .from("churn_survey_responses")
                .select("id")
                .eq("workspace_id", surveyWs.id)
                .eq("phone", phoneNumber)
                .limit(1);

              if (!existingResponse || existingResponse.length === 0) {
                const CHURN_REASONS: Record<string, string> = {
                  "1": "Não cheguei a usar",
                  "2": "Não consegui conectar o WhatsApp",
                  "3": "Achei difícil de configurar",
                  "4": "Não recebi suporte/demonstração",
                  "5": "O preço não cabe no momento",
                  "6": "Já uso outra ferramenta",
                };

                await supabase.from("churn_survey_responses").insert({
                  workspace_id: surveyWs.id,
                  phone: phoneNumber,
                  response_number: parseInt(trimmedMsg),
                  response_text: CHURN_REASONS[trimmedMsg],
                  raw_message: trimmedMsg,
                });

                // Send thank you reply
                await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                  number: phoneNumber,
                  text: `Obrigado pelo feedback! 🙏 Anotamos sua resposta. Se mudar de ideia, estamos aqui: argosx.com.br/planos 💙`,
                  delay: 0,
                  linkPreview: true,
                });

                console.log(`[whatsapp-webhook] 📊 Churn survey response saved: ws=${surveyWs.id}, phone=${phoneNumber}, answer=${trimmedMsg}`);
                return c.json({ received: true, handler: "churn_survey" }, 200, corsHeaders);
              }
            }
          }
        }
      } catch (surveyErr) {
        console.warn("[whatsapp-webhook] ⚠️ Churn survey check error (non-blocking):", surveyErr);
      }
    }
    // ============ END CHURN SURVEY ============

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
      .select("id, instance_name, respond_to, respond_to_stages, department_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    console.log(`[whatsapp-webhook] 🤖 Active agents found: ${agents?.length || 0}`);

    if (agents && agents.length > 0) {
      // 🔒 STEP 1a: If there is already an active_agent_id locked on the lead, USE IT (department transfer in progress)
      let lockedAgentId: string | null = null;
      try {
        const lockOrFilters = [`whatsapp_jid.eq.${remoteJid}`];
        if (resolvedRemoteJid !== remoteJid) lockOrFilters.push(`whatsapp_jid.eq.${resolvedRemoteJid}`);
        if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
          lockOrFilters.push(`phone.like.%${phoneNumber.slice(-10)}`);
        }
        const { data: lockedLead } = await supabase
          .from("leads")
          .select("active_agent_id, active_agent_set_at")
          .eq("workspace_id", workspaceId)
          .or(lockOrFilters.join(","))
          .limit(1)
          .single();
        if (lockedLead?.active_agent_id) {
          // Expire lock if older than 24h
          const setAt = lockedLead.active_agent_set_at ? new Date(lockedLead.active_agent_set_at).getTime() : 0;
          if (Date.now() - setAt < 24 * 60 * 60 * 1000) {
            lockedAgentId = lockedLead.active_agent_id;
          }
        }
      } catch { /* no lead yet, that's fine */ }

      // 🏢 STEP 1b: Department-aware matching with priority:
      //    1) Locked agent (already in conversation)
      //    2) Reception department agent for this instance
      //    3) Any agent matching this instance (legacy)
      let matchingAgent = null as any;
      if (lockedAgentId) {
        matchingAgent = agents.find((a: any) => a.id === lockedAgentId) || null;
        if (matchingAgent) console.log(`[whatsapp-webhook] 🔒 Using locked agent ${lockedAgentId}`);
      }
      if (!matchingAgent) {
        // Try reception department first
        const candidates = agents.filter((a: any) => !a.instance_name || a.instance_name === "" || a.instance_name === instanceName);
        if (candidates.length > 1) {
          const deptIds = candidates.map((a: any) => a.department_id).filter(Boolean);
          if (deptIds.length > 0) {
            const { data: receptionDepts } = await supabase
              .from("ai_departments")
              .select("id")
              .eq("workspace_id", workspaceId)
              .eq("is_reception", true)
              .in("id", deptIds);
            const receptionId = receptionDepts?.[0]?.id;
            if (receptionId) {
              matchingAgent = candidates.find((a: any) => a.department_id === receptionId) || null;
              if (matchingAgent) console.log(`[whatsapp-webhook] 🌟 Using reception department agent ${matchingAgent.id}`);
            }
          }
        }
        if (!matchingAgent) matchingAgent = candidates[0] || null;
      }

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

        // Skip AI if lead has opted out
        if (existingLead?.is_opted_out) {
          console.log(`[whatsapp-webhook] 🚫 Lead ${leadId} has opted out, skipping AI agent`);
          return new Response(JSON.stringify({ handler: "ai_agent", action: "skipped_opted_out" }), { status: 200, headers: { "Content-Type": "application/json" } });
        }

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

        if (matchingAgent.respond_to === "new_leads" && existingLead) {
          shouldRespond = false;
          console.log("[whatsapp-webhook] ⏭️ Agent skipped: respond_to=new_leads but lead already exists");
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
                    const sanitizedText = stripMarkdownLinks(cleanText);
                    const sendResult = await sendWithFallback("sendText", {
                      number: sendToNumber,
                      text: sanitizedText,
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
                const sanitizedSingleText = stripMarkdownLinks(singleCleanText);
                const sendResult = await sendWithFallback("sendText", {
                  number: sendToNumber,
                  text: sanitizedSingleText,
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
