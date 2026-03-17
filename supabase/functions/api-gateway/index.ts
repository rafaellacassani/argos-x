import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

type PermissionLevel = "denied" | "read" | "write";

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function getRequiredPermission(method: string): PermissionLevel {
  if (method === "GET") return "read";
  return "write";
}

function extractResource(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  if (v1Index >= 0 && parts[v1Index + 1]) {
    return parts[v1Index + 1];
  }
  return null;
}

function extractSubpath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  if (v1Index >= 0 && parts[v1Index + 2]) {
    return parts[v1Index + 2];
  }
  return null;
}

// Parse cursor pagination params from URL
function getPaginationParams(url: URL) {
  const cursor = url.searchParams.get("cursor") || null;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);
  const updatedAfter = url.searchParams.get("updated_after") || null;
  return { cursor, limit, updatedAfter };
}

// Phone validation for messages
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-API-Version": "v1" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

  if (!apiKey || !apiKey.startsWith("argx_")) {
    return jsonResponse({ error: "Missing or invalid API key" }, 401);
  }

  try {
    const keyHash = await hashKey(apiKey);

    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, workspace_id, permissions, is_active, expires_at, rate_limit_per_hour")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyRecord) {
      return jsonResponse({ error: "Invalid API key" }, 401);
    }

    if (!keyRecord.is_active) {
      return jsonResponse({ error: "API key is disabled" }, 403);
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return jsonResponse({ error: "API key expired" }, 403);
    }

    // ── Rate Limiting ──
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count: usageCount } = await supabase
      .from("api_key_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyRecord.id)
      .gte("created_at", oneHourAgo);

    if ((usageCount || 0) >= keyRecord.rate_limit_per_hour) {
      const retryAfter = 60; // seconds
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded", limit: keyRecord.rate_limit_per_hour, window: "1h" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(keyRecord.rate_limit_per_hour),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Update last_used_at (fire and forget)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id).then(() => {});

    const url = new URL(req.url);
    const resource = extractResource(url.pathname);
    const subpath = extractSubpath(url.pathname);

    if (!resource) {
      const docs = {
        version: "v1",
        base_url: `${supabaseUrl}/functions/v1/api-gateway/v1`,
        rate_limit: { requests_per_hour: keyRecord.rate_limit_per_hour, remaining: keyRecord.rate_limit_per_hour - (usageCount || 0) },
        pagination: { params: "?cursor=<uuid>&limit=50&updated_after=<ISO8601>", max_limit: 100 },
        resources: {
          leads: { read: "GET /leads", write: "POST /leads, PATCH /leads/:id" },
          contacts: { read: "GET /contacts" },
          messages: { read: "GET /messages", write: "POST /messages (text only, validates phone)" },
          agents: { read: "GET /agents", write: "POST /agents/:id/execute (rate limited: 60/h)" },
          campaigns: { read: "GET /campaigns" },
          calendar: { read: "GET /calendar", write: "POST /calendar" },
          tags: { read: "GET /tags", write: "POST /tags, POST /tags/assign" },
          funnels: { read: "GET /funnels", write: "PATCH /funnels/move-lead" },
          webhooks: { read: "GET /webhooks", write: "POST /webhooks, DELETE /webhooks/:id" },
        },
      };
      return jsonResponse(docs);
    }

    const permissions = keyRecord.permissions as Record<string, PermissionLevel>;
    const resourcePermission = permissions[resource] || "denied";
    const requiredPermission = getRequiredPermission(req.method);
    const hasPermission = resourcePermission === "write" || (resourcePermission === "read" && requiredPermission === "read");

    // Log usage
    await supabase.from("api_key_usage_log").insert({
      api_key_id: keyRecord.id,
      workspace_id: keyRecord.workspace_id,
      endpoint: `/${resource}${subpath ? `/${subpath}` : ""}`,
      method: req.method,
      status_code: hasPermission ? 200 : 403,
    });

    if (!hasPermission) {
      return jsonResponse({ error: "Insufficient permissions", resource, required: requiredPermission, current: resourcePermission }, 403);
    }

    const workspaceId = keyRecord.workspace_id;
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const { cursor, limit, updatedAfter } = getPaginationParams(url);

    // ── Helper for paginated queries ──
    async function paginatedQuery(table: string, selectCols: string, orderCol = "created_at") {
      let query = supabase
        .from(table)
        .select(selectCols)
        .eq("workspace_id", workspaceId)
        .order(orderCol, { ascending: false })
        .limit(limit + 1); // fetch one extra to determine has_more

      if (cursor) {
        // cursor is the ID of the last item; we need to get its order value
        const { data: cursorRow } = await supabase.from(table).select(`id, ${orderCol}`).eq("id", cursor).single();
        if (cursorRow) {
          query = query.lt(orderCol, cursorRow[orderCol]);
        }
      }

      if (updatedAfter && table !== "whatsapp_messages") {
        query = query.gte("updated_at", updatedAfter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const hasMore = (data?.length || 0) > limit;
      const items = hasMore ? data!.slice(0, limit) : (data || []);
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      return { items, has_more: hasMore, next_cursor: nextCursor, count: items.length };
    }

    let result: unknown;

    switch (resource) {
      // ── LEADS ──
      case "leads": {
        if (req.method === "GET") {
          result = await paginatedQuery(
            "leads",
            "id, name, phone, email, company, source, stage_id, responsible_user, value, status, created_at, updated_at"
          );
        } else if (req.method === "POST") {
          // Validate required fields
          if (!body.name || !body.phone || !body.stage_id) {
            return jsonResponse({ error: "name, phone, and stage_id are required" }, 400);
          }
          const { data, error } = await supabase
            .from("leads")
            .insert({
              name: body.name,
              phone: body.phone,
              email: body.email || null,
              company: body.company || null,
              source: body.source || "api",
              stage_id: body.stage_id,
              responsible_user: body.responsible_user || null,
              value: body.value || 0,
              workspace_id: workspaceId,
            })
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else if (req.method === "PATCH") {
          if (!subpath) return jsonResponse({ error: "Lead ID required: PATCH /leads/:id" }, 400);
          // Don't allow changing workspace_id
          delete body.workspace_id;
          delete body.id;
          const { data, error } = await supabase
            .from("leads")
            .update(body)
            .eq("id", subpath)
            .eq("workspace_id", workspaceId)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ── CONTACTS ──
      case "contacts": {
        result = await paginatedQuery("leads", "id, name, phone, email, company, created_at, updated_at");
        break;
      }

      // ── MESSAGES (with guardrails) ──
      case "messages": {
        if (req.method === "GET") {
          result = await paginatedQuery(
            "whatsapp_messages",
            "id, remote_jid, direction, content, message_type, timestamp, from_me, push_name",
            "timestamp"
          );
        } else if (req.method === "POST") {
          // ── GUARDRAILS: messages.write ──
          const phone = body.phone as string;
          const message = body.message as string;
          const instanceName = body.instance_name as string;

          if (!phone || !message) {
            return jsonResponse({ error: "phone and message are required" }, 400);
          }

          if (!isValidPhone(phone)) {
            return jsonResponse({ error: "Invalid phone number format" }, 400);
          }

          // V1: text only
          if (body.type && body.type !== "text") {
            return jsonResponse({ error: "v1 API supports text messages only" }, 400);
          }

          // Max message length
          if (message.length > 4096) {
            return jsonResponse({ error: "Message exceeds 4096 character limit" }, 400);
          }

          // Check workspace is active
          const { data: workspace } = await supabase
            .from("workspaces")
            .select("id, status")
            .eq("id", workspaceId)
            .single();

          if (workspace?.status === "blocked" || workspace?.status === "expired") {
            return jsonResponse({ error: "Workspace is inactive. Cannot send messages." }, 403);
          }

          // Rate limit per recipient: max 10 msg/min
          const oneMinAgo = new Date(Date.now() - 60000).toISOString();
          const cleanedPhone = phone.replace(/\D/g, "");
          const { count: recentMsgCount } = await supabase
            .from("whatsapp_messages")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .like("remote_jid", `%${cleanedPhone}%`)
            .eq("from_me", true)
            .gte("timestamp", oneMinAgo);

          if ((recentMsgCount || 0) >= 10) {
            return jsonResponse({ error: "Rate limit: max 10 messages per minute per recipient" }, 429);
          }

          // Get instance for sending
          let sendInstance = instanceName;
          if (!sendInstance) {
            const { data: instances } = await supabase
              .from("whatsapp_instances")
              .select("instance_name")
              .eq("workspace_id", workspaceId)
              .eq("is_connected", true)
              .limit(1);
            sendInstance = instances?.[0]?.instance_name;
          }

          if (!sendInstance) {
            return jsonResponse({ error: "No connected WhatsApp instance found" }, 400);
          }

          // Send via Evolution API
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

          if (!evolutionUrl || !evolutionKey) {
            return jsonResponse({ error: "WhatsApp integration not configured" }, 500);
          }

          const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${sendInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evolutionKey,
            },
            body: JSON.stringify({
              number: cleanedPhone,
              text: message,
            }),
          });

          if (!sendResponse.ok) {
            const errBody = await sendResponse.text();
            console.error("Evolution API error:", errBody);
            return jsonResponse({ error: "Failed to send message", details: errBody }, 502);
          }

          const sendResult = await sendResponse.json();
          result = { sent: true, message_id: sendResult?.key?.id || null, phone: cleanedPhone };
        }
        break;
      }

      // ── AGENTS (with guardrails) ──
      case "agents": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("ai_agents")
            .select("id, name, description, type, model, is_active, created_at")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST" && subpath === "execute") {
          // POST /agents/execute — but we need agent_id from URL: /agents/:id/execute
          // Re-parse: /v1/agents/:agent_id/execute
          const parts = url.pathname.split("/").filter(Boolean);
          const v1Idx = parts.indexOf("v1");
          const agentId = parts[v1Idx + 2];
          const action = parts[v1Idx + 3];

          if (action !== "execute" || !agentId) {
            return jsonResponse({ error: "Use POST /agents/:agent_id/execute" }, 400);
          }

          // ── GUARDRAIL: agent execute rate limit (60/h) ──
          const agentRateKey = `agent_execute_${keyRecord.id}`;
          const { count: agentExecCount } = await supabase
            .from("api_key_usage_log")
            .select("id", { count: "exact", head: true })
            .eq("api_key_id", keyRecord.id)
            .eq("endpoint", `/agents/${agentId}/execute`)
            .gte("created_at", oneHourAgo);

          if ((agentExecCount || 0) >= 60) {
            return jsonResponse({ error: "Agent execution rate limit: 60 per hour", limit: 60 }, 429);
          }

          // Verify agent exists, belongs to workspace, is active
          const { data: agent, error: agentErr } = await supabase
            .from("ai_agents")
            .select("id, name, is_active, system_prompt, model")
            .eq("id", agentId)
            .eq("workspace_id", workspaceId)
            .single();

          if (agentErr || !agent) {
            return jsonResponse({ error: "Agent not found" }, 404);
          }

          if (!agent.is_active) {
            return jsonResponse({ error: "Agent is disabled" }, 403);
          }

          const inputMessage = body.message as string;
          const leadId = body.lead_id as string | undefined;

          if (!inputMessage) {
            return jsonResponse({ error: "message is required" }, 400);
          }

          if (inputMessage.length > 10000) {
            return jsonResponse({ error: "Message exceeds 10000 character limit" }, 400);
          }

          // Log the execution start
          const sessionId = `api_${keyRecord.id}_${Date.now()}`;
          const execStart = Date.now();

          // Call the ai-agent-chat function internally
          const agentResponse = await fetch(`${supabaseUrl}/functions/v1/ai-agent-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              agent_id: agentId,
              workspace_id: workspaceId,
              message: inputMessage,
              session_id: sessionId,
              lead_id: leadId || null,
              source: "api",
            }),
          });

          const latencyMs = Date.now() - execStart;

          if (!agentResponse.ok) {
            const errText = await agentResponse.text();
            // Log failed execution
            await supabase.from("agent_executions").insert({
              agent_id: agentId,
              workspace_id: workspaceId,
              session_id: sessionId,
              input_message: inputMessage,
              status: "error",
              error_message: errText,
              latency_ms: latencyMs,
              lead_id: leadId || null,
            });
            return jsonResponse({ error: "Agent execution failed", details: errText }, 502);
          }

          const agentResult = await agentResponse.json();

          // Log successful execution
          await supabase.from("agent_executions").insert({
            agent_id: agentId,
            workspace_id: workspaceId,
            session_id: sessionId,
            input_message: inputMessage,
            output_message: agentResult?.response || agentResult?.reply || JSON.stringify(agentResult),
            status: "success",
            latency_ms: latencyMs,
            lead_id: leadId || null,
          });

          // Update endpoint log with actual path
          await supabase.from("api_key_usage_log").insert({
            api_key_id: keyRecord.id,
            workspace_id: workspaceId,
            endpoint: `/agents/${agentId}/execute`,
            method: "POST",
            status_code: 200,
          });

          result = {
            agent_id: agentId,
            agent_name: agent.name,
            response: agentResult?.response || agentResult?.reply || agentResult,
            session_id: sessionId,
            latency_ms: latencyMs,
          };
        }
        break;
      }

      // ── CAMPAIGNS ──
      case "campaigns": {
        result = await paginatedQuery(
          "campaigns",
          "id, name, status, total_recipients, sent_count, delivered_count, failed_count, created_at, updated_at"
        );
        break;
      }

      // ── CALENDAR ──
      case "calendar": {
        if (req.method === "GET") {
          result = await paginatedQuery(
            "calendar_events",
            "id, title, description, start_at, end_at, type, color, location, created_at, updated_at"
          );
        } else if (req.method === "POST") {
          if (!body.title || !body.start_at || !body.end_at) {
            return jsonResponse({ error: "title, start_at, and end_at are required" }, 400);
          }
          const { data, error } = await supabase
            .from("calendar_events")
            .insert({
              title: body.title,
              description: body.description || null,
              start_at: body.start_at,
              end_at: body.end_at,
              type: body.type || "meeting",
              color: body.color || "#3B82F6",
              location: body.location || null,
              lead_id: body.lead_id || null,
              user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
              workspace_id: workspaceId,
            })
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ── TAGS ──
      case "tags": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("lead_tags")
            .select("id, name, color, created_at")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST") {
          // POST /tags/assign — assign tag to lead
          if (subpath === "assign") {
            if (!body.lead_id || !body.tag_id) {
              return jsonResponse({ error: "lead_id and tag_id are required" }, 400);
            }
            const { data, error } = await supabase
              .from("lead_tag_assignments")
              .insert({ lead_id: body.lead_id, tag_id: body.tag_id, workspace_id: workspaceId })
              .select()
              .single();
            if (error) throw error;
            result = data;
          } else {
            // POST /tags — create tag
            if (!body.name) {
              return jsonResponse({ error: "name is required" }, 400);
            }
            const { data, error } = await supabase
              .from("lead_tags")
              .insert({ name: body.name, color: body.color || "#6B7280", workspace_id: workspaceId })
              .select()
              .single();
            if (error) throw error;
            result = data;
          }
        }
        break;
      }

      // ── FUNNELS ──
      case "funnels": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("funnels")
            .select("id, name, description, funnel_stages(id, name, color, position)")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "PATCH" && subpath === "move-lead") {
          if (!body.lead_id || !body.stage_id) {
            return jsonResponse({ error: "lead_id and stage_id are required" }, 400);
          }
          // Verify stage belongs to workspace
          const { data: stage } = await supabase
            .from("funnel_stages")
            .select("id")
            .eq("id", body.stage_id)
            .eq("workspace_id", workspaceId)
            .single();
          if (!stage) {
            return jsonResponse({ error: "Stage not found in workspace" }, 404);
          }
          const { data, error } = await supabase
            .from("leads")
            .update({ stage_id: body.stage_id })
            .eq("id", body.lead_id)
            .eq("workspace_id", workspaceId)
            .select("id, name, stage_id")
            .single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ── WEBHOOKS ──
      case "webhooks": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("webhooks")
            .select("id, url, events, is_active, created_at, updated_at")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST") {
          if (!body.url || !body.events) {
            return jsonResponse({ error: "url and events[] are required" }, 400);
          }
          // Validate URL
          try { new URL(body.url as string); } catch {
            return jsonResponse({ error: "Invalid webhook URL" }, 400);
          }
          // Generate webhook secret
          const secretRaw = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
          const secretH = await hashKey(secretRaw);

          const { data: profile } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("user_id", keyRecord.workspace_id) // placeholder - will use API key creator
            .limit(1)
            .maybeSingle();

          const { data, error } = await supabase
            .from("webhooks")
            .insert({
              workspace_id: workspaceId,
              url: body.url,
              events: body.events,
              secret_hash: secretH,
              secret_prefix: secretRaw.substring(0, 12),
              created_by: profile?.id || null,
            })
            .select("id, url, events, is_active, created_at")
            .single();
          if (error) throw error;
          result = { webhook: data, secret: secretRaw, warning: "Save this secret now. It won't be shown again." };
        } else if (req.method === "DELETE") {
          if (!subpath) return jsonResponse({ error: "Webhook ID required: DELETE /webhooks/:id" }, 400);
          const { error } = await supabase
            .from("webhooks")
            .delete()
            .eq("id", subpath)
            .eq("workspace_id", workspaceId);
          if (error) throw error;
          result = { deleted: true };
        }
        break;
      }

      default:
        return jsonResponse({ error: `Unknown resource: ${resource}` }, 404);
    }

    return jsonResponse({ data: result });
  } catch (err) {
    console.error("api-gateway error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
