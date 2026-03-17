import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── CORS ──
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
};

type PermissionLevel = "denied" | "read" | "write";

// ── Deno KV for rate limiting ──
let kv: Deno.Kv;
async function getKv() {
  if (!kv) kv = await Deno.openKv();
  return kv;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const store = await getKv();
  const now = Date.now();
  const windowStart = now - windowMs;
  const kvKey = ["rate_limit", key];

  // Get current window data
  const entry = await store.get<{ timestamps: number[] }>(kvKey);
  let timestamps = entry.value?.timestamps || [];

  // Remove expired timestamps
  timestamps = timestamps.filter((t) => t > windowStart);

  const allowed = timestamps.length < maxRequests;

  if (allowed) {
    timestamps.push(now);
    await store.set(kvKey, { timestamps }, { expireIn: windowMs });
  }

  const resetAt = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - timestamps.length),
    limit: maxRequests,
    resetAt,
  };
}

// ── Crypto helpers ──
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── URL parsing ──
function parsePath(pathname: string): { resource: string | null; subpath: string | null; segments: string[] } {
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  const resource = v1Index >= 0 && parts[v1Index + 1] ? parts[v1Index + 1] : null;
  const subpath = v1Index >= 0 && parts[v1Index + 2] ? parts[v1Index + 2] : null;
  const segments = v1Index >= 0 ? parts.slice(v1Index + 1) : [];
  return { resource, subpath, segments };
}

// ── Pagination ──
function getPaginationParams(url: URL) {
  const cursor = url.searchParams.get("cursor") || null;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);
  const updatedAfter = url.searchParams.get("updated_after") || null;
  const createdAfter = url.searchParams.get("created_after") || null;
  return { cursor, limit, updatedAfter, createdAfter };
}

// ── Validation ──
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

// ── Response helpers ──
function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-API-Version": "v1",
      ...extraHeaders,
    },
  });
}

function rateLimitResponse(rl: RateLimitResult, scope: string) {
  const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
  return jsonResponse(
    { error: "Rate limit exceeded", scope, limit: rl.limit, retry_after_seconds: retryAfter },
    429,
    {
      "Retry-After": String(Math.max(1, retryAfter)),
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
    }
  );
}

// ── Audit log helper ──
async function logUsage(
  supabase: any,
  opts: {
    api_key_id: string;
    workspace_id: string;
    endpoint: string;
    method: string;
    status_code: number;
    ip_address?: string;
    user_agent?: string;
    latency_ms?: number;
    rate_limited?: boolean;
    idempotency_key?: string;
    payload_size?: number;
  }
) {
  await supabase.from("api_key_usage_log").insert({
    api_key_id: opts.api_key_id,
    workspace_id: opts.workspace_id,
    endpoint: opts.endpoint,
    method: opts.method,
    status_code: opts.status_code,
    ip_address: opts.ip_address || null,
    user_agent: opts.user_agent || null,
    latency_ms: opts.latency_ms || null,
    rate_limited: opts.rate_limited || false,
    idempotency_key: opts.idempotency_key || null,
    payload_size: opts.payload_size || null,
  });
}

// ═══════════════════════════════════════════
// ── MAIN HANDLER ──
// ═══════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Extract request metadata for audit
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const clientUa = req.headers.get("user-agent") || "unknown";
  const idempotencyKey = req.headers.get("idempotency-key") || null;

  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

  if (!apiKey || !apiKey.startsWith("argx_")) {
    return jsonResponse({ error: "Missing or invalid API key. Use header: X-API-Key: argx_..." }, 401);
  }

  try {
    const keyHash = await hashKey(apiKey);

    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("id, workspace_id, permissions, is_active, expires_at, rate_limit_per_hour, rate_limit_messages_per_min, rate_limit_executions_per_hour, allowed_agent_ids")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyRecord) {
      return jsonResponse({ error: "Invalid API key" }, 401);
    }

    if (!keyRecord.is_active) {
      return jsonResponse({ error: "API key is disabled" }, 403);
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return jsonResponse({ error: "API key has expired" }, 403);
    }

    // ── GLOBAL RATE LIMIT (Deno KV) ──
    const globalRl = await checkRateLimit(
      `global:${keyRecord.id}`,
      keyRecord.rate_limit_per_hour,
      3600_000 // 1 hour
    );

    if (!globalRl.allowed) {
      await logUsage(supabase, {
        api_key_id: keyRecord.id,
        workspace_id: keyRecord.workspace_id,
        endpoint: req.url,
        method: req.method,
        status_code: 429,
        ip_address: clientIp,
        user_agent: clientUa,
        rate_limited: true,
      });
      return rateLimitResponse(globalRl, "global");
    }

    // Update last_used_at (fire-and-forget)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id).then(() => {});

    const url = new URL(req.url);
    const { resource, subpath, segments } = parsePath(url.pathname);

    // ── DOCS (no resource) ──
    if (!resource) {
      return jsonResponse({
        version: "v1",
        base_url: `${supabaseUrl}/functions/v1/api-gateway/v1`,
        rate_limits: {
          global: `${keyRecord.rate_limit_per_hour} req/hour`,
          messages_write: `${keyRecord.rate_limit_messages_per_min} req/min`,
          agents_execute: `${keyRecord.rate_limit_executions_per_hour} req/hour`,
          remaining: globalRl.remaining,
        },
        pagination: {
          params: "?cursor=<opaque_id>&limit=50&updated_after=<ISO8601>&created_after=<ISO8601>",
          max_limit: 200,
          default_limit: 50,
          response_fields: "{ data: { items, has_more, next_cursor, count } }",
        },
        resources: {
          leads: { read: "GET /leads", write: "POST /leads, PATCH /leads/:id" },
          contacts: { read: "GET /contacts" },
          messages: { read: "GET /messages", write: "POST /messages (text only, idempotency supported)" },
          agents: { read: "GET /agents", write: "POST /agents/:id/execute (write = execute)" },
          campaigns: { read: "GET /campaigns" },
          calendar: { read: "GET /calendar", write: "POST /calendar" },
          tags: { read: "GET /tags", write: "POST /tags, POST /tags/assign" },
          funnels: { read: "GET /funnels", write: "PATCH /funnels/move-lead" },
          webhooks: { read: "GET /webhooks", write: "POST /webhooks, POST /webhooks/test, DELETE /webhooks/:id" },
        },
        webhook_events: ["lead.created", "message.received", "deal.stage_changed"],
        idempotency: "Send Idempotency-Key header to prevent duplicate writes",
      });
    }

    // ── PERMISSION CHECK ──
    const permissions = keyRecord.permissions as Record<string, PermissionLevel>;
    const resourcePermission = permissions[resource] || "denied";
    const requiredPermission: PermissionLevel = req.method === "GET" ? "read" : "write";
    const hasPermission = resourcePermission === "write" || (resourcePermission === "read" && requiredPermission === "read");

    if (!hasPermission) {
      const latency = Date.now() - requestStart;
      await logUsage(supabase, {
        api_key_id: keyRecord.id,
        workspace_id: keyRecord.workspace_id,
        endpoint: `/${resource}${subpath ? `/${subpath}` : ""}`,
        method: req.method,
        status_code: 403,
        ip_address: clientIp,
        user_agent: clientUa,
        latency_ms: latency,
      });
      return jsonResponse({
        error: "Insufficient permissions",
        resource,
        required: requiredPermission,
        current: resourcePermission,
        hint: resource === "agents" && requiredPermission === "write" ? "agents:write includes execute permission" : undefined,
      }, 403);
    }

    // ── PARSE BODY ──
    const workspaceId = keyRecord.workspace_id;
    let body: Record<string, unknown> = {};
    let bodyRaw = "";
    if (req.method !== "GET") {
      try {
        bodyRaw = await req.text();
        body = JSON.parse(bodyRaw);
      } catch {
        body = {};
      }
    }
    const payloadSize = bodyRaw.length;

    const { cursor, limit, updatedAfter, createdAfter } = getPaginationParams(url);

    // ── IDEMPOTENCY CHECK (for write operations) ──
    if (idempotencyKey && req.method !== "GET") {
      const { data: existing } = await supabase
        .from("api_key_usage_log")
        .select("status_code, created_at")
        .eq("idempotency_key", idempotencyKey)
        .eq("api_key_id", keyRecord.id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return jsonResponse({
          error: "Duplicate request",
          idempotency_key: idempotencyKey,
          original_status: existing.status_code,
          original_at: existing.created_at,
        }, 409);
      }
    }

    // ── PAGINATED QUERY HELPER ──
    async function paginatedQuery(table: string, selectCols: string, orderCol = "created_at") {
      let query = supabase
        .from(table)
        .select(selectCols)
        .eq("workspace_id", workspaceId)
        .order(orderCol, { ascending: false })
        .limit(limit + 1);

      if (cursor) {
        const { data: cursorRow } = await supabase.from(table).select(`id, ${orderCol}`).eq("id", cursor).single();
        if (cursorRow && cursorRow[orderCol]) {
          query = query.lt(orderCol, cursorRow[orderCol]);
        }
      }

      if (updatedAfter) {
        try {
          query = query.gte("updated_at", updatedAfter);
        } catch { /* column may not exist */ }
      }
      if (createdAfter) {
        query = query.gte("created_at", createdAfter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const hasMore = (data?.length || 0) > limit;
      const items = hasMore ? data!.slice(0, limit) : (data || []);
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

      return { items, has_more: hasMore, next_cursor: nextCursor, count: items.length };
    }

    // ═══════════════════════════════════════════
    // ── RESOURCE HANDLERS ──
    // ═══════════════════════════════════════════

    let result: unknown;
    let endpointPath = `/${resource}${subpath ? `/${subpath}` : ""}`;

    switch (resource) {
      // ────────── LEADS ──────────
      case "leads": {
        if (req.method === "GET") {
          result = await paginatedQuery(
            "leads",
            "id, name, phone, email, company, source, stage_id, responsible_user, value, status, created_at, updated_at"
          );
        } else if (req.method === "POST") {
          if (!body.name || !body.phone || !body.stage_id) {
            return jsonResponse({ error: "name, phone, and stage_id are required" }, 400);
          }
          const { data, error } = await supabase
            .from("leads")
            .insert({
              name: body.name, phone: body.phone, email: body.email || null,
              company: body.company || null, source: body.source || "api",
              stage_id: body.stage_id, responsible_user: body.responsible_user || null,
              value: body.value || 0, workspace_id: workspaceId,
            })
            .select().single();
          if (error) throw error;
          // Fire webhook: lead.created
          fireWebhookEvent(supabase, workspaceId, "lead.created", data);
          result = data;
        } else if (req.method === "PATCH") {
          if (!subpath) return jsonResponse({ error: "Lead ID required: PATCH /leads/:id" }, 400);
          delete body.workspace_id; delete body.id;
          const { data, error } = await supabase
            .from("leads").update(body).eq("id", subpath).eq("workspace_id", workspaceId).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ────────── CONTACTS ──────────
      case "contacts": {
        result = await paginatedQuery("leads", "id, name, phone, email, company, created_at, updated_at");
        break;
      }

      // ────────── MESSAGES (with guardrails) ──────────
      case "messages": {
        if (req.method === "GET") {
          result = await paginatedQuery(
            "whatsapp_messages",
            "id, remote_jid, direction, content, message_type, timestamp, from_me, push_name",
            "timestamp"
          );
        } else if (req.method === "POST") {
          // ── RESOURCE RATE LIMIT: messages.write ──
          const msgRl = await checkRateLimit(
            `msg_write:${keyRecord.id}`,
            keyRecord.rate_limit_messages_per_min,
            60_000 // 1 min
          );
          if (!msgRl.allowed) {
            await logUsage(supabase, {
              api_key_id: keyRecord.id, workspace_id: workspaceId,
              endpoint: "/messages", method: "POST", status_code: 429,
              ip_address: clientIp, user_agent: clientUa, rate_limited: true,
              payload_size: payloadSize,
            });
            return rateLimitResponse(msgRl, "messages.write");
          }

          const phone = body.phone as string;
          const message = body.message as string;
          const instanceName = body.instance_name as string;

          if (!phone || !message) return jsonResponse({ error: "phone and message are required" }, 400);
          if (!isValidPhone(phone)) return jsonResponse({ error: "Invalid phone number format" }, 400);
          if (body.type && body.type !== "text") return jsonResponse({ error: "v1 supports text messages only" }, 400);
          if (message.length > 4096) return jsonResponse({ error: "Message exceeds 4096 character limit" }, 400);

          // Block bulk sending (no array of recipients)
          if (Array.isArray(body.phones) || Array.isArray(body.recipients)) {
            return jsonResponse({ error: "Bulk sending is not allowed via API. Use campaigns." }, 400);
          }

          // Check workspace status
          const { data: workspace } = await supabase
            .from("workspaces").select("id, status").eq("id", workspaceId).single();
          if (workspace?.status === "blocked" || workspace?.status === "expired") {
            return jsonResponse({ error: "Workspace is inactive" }, 403);
          }

          // Per-recipient rate limit: 10 msg/min
          const cleanedPhone = phone.replace(/\D/g, "");
          const recipientRl = await checkRateLimit(
            `msg_recipient:${workspaceId}:${cleanedPhone}`,
            10,
            60_000
          );
          if (!recipientRl.allowed) {
            return jsonResponse({ error: "Rate limit: max 10 messages per minute per recipient", phone: cleanedPhone }, 429);
          }

          // Get instance
          let sendInstance = instanceName;
          if (!sendInstance) {
            const { data: instances } = await supabase
              .from("whatsapp_instances").select("instance_name")
              .eq("workspace_id", workspaceId).eq("is_connected", true).limit(1);
            sendInstance = instances?.[0]?.instance_name;
          }
          if (!sendInstance) return jsonResponse({ error: "No connected WhatsApp instance" }, 400);

          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
          const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
          if (!evolutionUrl || !evolutionKey) return jsonResponse({ error: "WhatsApp not configured" }, 500);

          const sendResponse = await fetch(`${evolutionUrl}/message/sendText/${sendInstance}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evolutionKey },
            body: JSON.stringify({ number: cleanedPhone, text: message }),
          });

          const sendLatency = Date.now() - requestStart;

          if (!sendResponse.ok) {
            const errBody = await sendResponse.text();
            await logUsage(supabase, {
              api_key_id: keyRecord.id, workspace_id: workspaceId,
              endpoint: "/messages", method: "POST", status_code: 502,
              ip_address: clientIp, user_agent: clientUa, latency_ms: sendLatency,
              idempotency_key: idempotencyKey || undefined, payload_size: payloadSize,
            });
            return jsonResponse({ error: "Failed to send message", details: errBody }, 502);
          }

          const sendResult = await sendResponse.json();

          // Fire webhook: message.received (outbound)
          fireWebhookEvent(supabase, workspaceId, "message.received", {
            direction: "outbound", phone: cleanedPhone, message, source: "api",
          });

          result = { sent: true, message_id: sendResult?.key?.id || null, phone: cleanedPhone, latency_ms: sendLatency };
        }
        break;
      }

      // ────────── AGENTS (with guardrails) ──────────
      case "agents": {
        if (req.method === "GET") {
          const { data } = await supabase
            .from("ai_agents")
            .select("id, name, description, type, model, is_active, created_at")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST") {
          // POST /agents/:agent_id/execute
          const agentId = segments[1]; // agents / <id> / execute
          const action = segments[2];

          if (action !== "execute" || !agentId) {
            return jsonResponse({ error: "Use POST /agents/:agent_id/execute" }, 400);
          }

          endpointPath = `/agents/${agentId}/execute`;

          // ── RESOURCE RATE LIMIT: agents.execute ──
          const execRl = await checkRateLimit(
            `agent_exec:${keyRecord.id}`,
            keyRecord.rate_limit_executions_per_hour,
            3600_000
          );
          if (!execRl.allowed) {
            await logUsage(supabase, {
              api_key_id: keyRecord.id, workspace_id: workspaceId,
              endpoint: endpointPath, method: "POST", status_code: 429,
              ip_address: clientIp, user_agent: clientUa, rate_limited: true,
              payload_size: payloadSize,
            });
            return rateLimitResponse(execRl, "agents.execute");
          }

          // ── ALLOWLIST CHECK ──
          if (keyRecord.allowed_agent_ids && Array.isArray(keyRecord.allowed_agent_ids)) {
            if (!keyRecord.allowed_agent_ids.includes(agentId)) {
              return jsonResponse({
                error: "Agent not in allowlist for this API key",
                agent_id: agentId,
                hint: "Configure allowed_agent_ids on the API key to permit this agent",
              }, 403);
            }
          }

          // Verify agent
          const { data: agent, error: agentErr } = await supabase
            .from("ai_agents")
            .select("id, name, is_active, model")
            .eq("id", agentId).eq("workspace_id", workspaceId).single();

          if (agentErr || !agent) return jsonResponse({ error: "Agent not found" }, 404);
          if (!agent.is_active) return jsonResponse({ error: "Agent is disabled" }, 403);

          const inputMessage = body.message as string;
          const leadId = body.lead_id as string | undefined;

          if (!inputMessage) return jsonResponse({ error: "message is required" }, 400);
          if (inputMessage.length > 10000) return jsonResponse({ error: "Message exceeds 10000 character limit" }, 400);

          const sessionId = `api_${keyRecord.id}_${Date.now()}`;
          const execStart = Date.now();

          // ── TIMEOUT: 30s ──
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30_000);

          try {
            const agentResponse = await fetch(`${supabaseUrl}/functions/v1/ai-agent-chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({
                agent_id: agentId, workspace_id: workspaceId,
                message: inputMessage, session_id: sessionId,
                lead_id: leadId || null, source: "api",
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const execLatency = Date.now() - execStart;

            if (!agentResponse.ok) {
              const errText = await agentResponse.text();
              await supabase.from("agent_executions").insert({
                agent_id: agentId, workspace_id: workspaceId, session_id: sessionId,
                input_message: inputMessage, status: "error", error_message: errText,
                latency_ms: execLatency, lead_id: leadId || null,
              });
              return jsonResponse({ error: "Agent execution failed", details: errText }, 502);
            }

            const agentResult = await agentResponse.json();
            const outputMsg = agentResult?.response || agentResult?.reply || JSON.stringify(agentResult);

            await supabase.from("agent_executions").insert({
              agent_id: agentId, workspace_id: workspaceId, session_id: sessionId,
              input_message: inputMessage, output_message: outputMsg,
              status: "success", latency_ms: execLatency, lead_id: leadId || null,
            });

            result = {
              agent_id: agentId, agent_name: agent.name,
              response: outputMsg, session_id: sessionId,
              latency_ms: execLatency, input_size: inputMessage.length,
            };
          } catch (abortErr) {
            clearTimeout(timeoutId);
            const execLatency = Date.now() - execStart;

            if (abortErr.name === "AbortError") {
              await supabase.from("agent_executions").insert({
                agent_id: agentId, workspace_id: workspaceId, session_id: sessionId,
                input_message: inputMessage, status: "timeout",
                error_message: "Execution exceeded 30s timeout",
                latency_ms: execLatency, lead_id: leadId || null,
              });
              await logUsage(supabase, {
                api_key_id: keyRecord.id, workspace_id: workspaceId,
                endpoint: endpointPath, method: "POST", status_code: 504,
                ip_address: clientIp, user_agent: clientUa, latency_ms: execLatency,
                payload_size: payloadSize,
              });
              return jsonResponse({ error: "Agent execution timed out (30s)", agent_id: agentId }, 504);
            }
            throw abortErr;
          }
        }
        break;
      }

      // ────────── CAMPAIGNS ──────────
      case "campaigns": {
        result = await paginatedQuery(
          "campaigns",
          "id, name, status, total_recipients, sent_count, delivered_count, failed_count, created_at, updated_at"
        );
        break;
      }

      // ────────── CALENDAR ──────────
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
          const { data, error } = await supabase.from("calendar_events").insert({
            title: body.title, description: body.description || null,
            start_at: body.start_at, end_at: body.end_at,
            type: body.type || "meeting", color: body.color || "#3B82F6",
            location: body.location || null, lead_id: body.lead_id || null,
            user_id: body.user_id || "00000000-0000-0000-0000-000000000000",
            workspace_id: workspaceId,
          }).select().single();
          if (error) throw error;
          result = data;
        }
        break;
      }

      // ────────── TAGS ──────────
      case "tags": {
        if (req.method === "GET") {
          const { data } = await supabase.from("lead_tags")
            .select("id, name, color, created_at").eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST") {
          if (subpath === "assign") {
            if (!body.lead_id || !body.tag_id) return jsonResponse({ error: "lead_id and tag_id required" }, 400);
            const { data, error } = await supabase.from("lead_tag_assignments")
              .insert({ lead_id: body.lead_id, tag_id: body.tag_id, workspace_id: workspaceId })
              .select().single();
            if (error) throw error;
            result = data;
          } else {
            if (!body.name) return jsonResponse({ error: "name is required" }, 400);
            const { data, error } = await supabase.from("lead_tags")
              .insert({ name: body.name, color: body.color || "#6B7280", workspace_id: workspaceId })
              .select().single();
            if (error) throw error;
            result = data;
          }
        }
        break;
      }

      // ────────── FUNNELS ──────────
      case "funnels": {
        if (req.method === "GET") {
          const { data } = await supabase.from("funnels")
            .select("id, name, description, funnel_stages(id, name, color, position)")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "PATCH" && subpath === "move-lead") {
          if (!body.lead_id || !body.stage_id) return jsonResponse({ error: "lead_id and stage_id required" }, 400);
          const { data: stage } = await supabase.from("funnel_stages")
            .select("id").eq("id", body.stage_id).eq("workspace_id", workspaceId).single();
          if (!stage) return jsonResponse({ error: "Stage not found in workspace" }, 404);

          // Get current stage for webhook
          const { data: currentLead } = await supabase.from("leads")
            .select("id, stage_id").eq("id", body.lead_id).eq("workspace_id", workspaceId).single();

          const { data, error } = await supabase.from("leads")
            .update({ stage_id: body.stage_id })
            .eq("id", body.lead_id).eq("workspace_id", workspaceId)
            .select("id, name, stage_id").single();
          if (error) throw error;

          // Fire webhook: deal.stage_changed
          fireWebhookEvent(supabase, workspaceId, "deal.stage_changed", {
            lead_id: body.lead_id,
            from_stage_id: currentLead?.stage_id,
            to_stage_id: body.stage_id,
          });

          result = data;
        }
        break;
      }

      // ────────── WEBHOOKS ──────────
      case "webhooks": {
        if (req.method === "GET") {
          const { data } = await supabase.from("webhooks")
            .select("id, url, events, is_active, created_at, updated_at, secret_prefix")
            .eq("workspace_id", workspaceId);
          result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
        } else if (req.method === "POST") {
          if (subpath === "test") {
            // POST /webhooks/test — send test event
            const webhookId = body.webhook_id as string;
            if (!webhookId) return jsonResponse({ error: "webhook_id required" }, 400);

            const { data: wh } = await supabase.from("webhooks")
              .select("id, url, secret_hash, is_active")
              .eq("id", webhookId).eq("workspace_id", workspaceId).single();

            if (!wh) return jsonResponse({ error: "Webhook not found" }, 404);

            const testPayload = {
              event: "test.ping",
              workspace_id: workspaceId,
              timestamp: new Date().toISOString(),
              data: { message: "This is a test event from Argos X API" },
            };

            const deliveryResult = await deliverWebhook(supabase, wh, testPayload, workspaceId);
            result = deliveryResult;
          } else {
            // POST /webhooks — register
            if (!body.url || !body.events) return jsonResponse({ error: "url and events[] required" }, 400);
            try { new URL(body.url as string); } catch { return jsonResponse({ error: "Invalid URL" }, 400); }

            const validEvents = ["lead.created", "message.received", "deal.stage_changed"];
            const events = (body.events as string[]).filter(e => validEvents.includes(e));
            if (events.length === 0) {
              return jsonResponse({ error: "No valid events. Available: " + validEvents.join(", ") }, 400);
            }

            const secretRaw = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
            const secretH = await hashKey(secretRaw);

            const { data, error } = await supabase.from("webhooks").insert({
              workspace_id: workspaceId, url: body.url, events,
              secret_hash: secretH, secret_prefix: secretRaw.substring(0, 12),
            }).select("id, url, events, is_active, created_at").single();
            if (error) throw error;

            result = {
              webhook: data, secret: secretRaw,
              warning: "Save this secret now. It will not be shown again.",
              signature_header: "X-Argos-Signature",
              verification: `HMAC-SHA256(secret, raw_body) → compare with X-Argos-Signature header value`,
            };
          }
        } else if (req.method === "DELETE") {
          if (!subpath) return jsonResponse({ error: "Webhook ID required: DELETE /webhooks/:id" }, 400);
          const { error } = await supabase.from("webhooks")
            .delete().eq("id", subpath).eq("workspace_id", workspaceId);
          if (error) throw error;
          result = { deleted: true };
        }
        break;
      }

      default:
        return jsonResponse({ error: `Unknown resource: ${resource}` }, 404);
    }

    // ── AUDIT LOG ──
    const latencyMs = Date.now() - requestStart;
    await logUsage(supabase, {
      api_key_id: keyRecord.id,
      workspace_id: workspaceId,
      endpoint: endpointPath,
      method: req.method,
      status_code: 200,
      ip_address: clientIp,
      user_agent: clientUa,
      latency_ms: latencyMs,
      idempotency_key: idempotencyKey || undefined,
      payload_size: payloadSize || undefined,
    });

    return jsonResponse({ data: result }, 200, {
      "X-RateLimit-Limit": String(keyRecord.rate_limit_per_hour),
      "X-RateLimit-Remaining": String(globalRl.remaining - 1),
    });
  } catch (err) {
    console.error("api-gateway error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});

// ═══════════════════════════════════════════
// ── WEBHOOK DELIVERY ──
// ═══════════════════════════════════════════

async function fireWebhookEvent(supabase: any, workspaceId: string, eventType: string, data: unknown) {
  try {
    const { data: webhooks } = await supabase
      .from("webhooks")
      .select("id, url, secret_hash, is_active, events")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (!webhooks?.length) return;

    for (const wh of webhooks) {
      const events = wh.events as string[];
      if (!events.includes(eventType)) continue;

      const payload = {
        event: eventType,
        workspace_id: workspaceId,
        timestamp: new Date().toISOString(),
        data,
      };

      // Fire-and-forget delivery with retries
      deliverWebhook(supabase, wh, payload, workspaceId).catch(err => {
        console.error(`Webhook delivery failed for ${wh.id}:`, err);
      });
    }
  } catch (err) {
    console.error("fireWebhookEvent error:", err);
  }
}

async function deliverWebhook(
  supabase: any,
  webhook: { id: string; url: string; secret_hash: string },
  payload: unknown,
  workspaceId: string,
  attempt = 1
): Promise<{ success: boolean; status_code?: number; attempts: number }> {
  const maxAttempts = 3;
  const payloadStr = JSON.stringify(payload);
  const payloadId = crypto.randomUUID();

  // Compute HMAC signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhook.secret_hash);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
  const signature = "sha256=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  const timestamp = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Argos-Signature": signature,
        "X-Argos-Event": (payload as any).event || "unknown",
        "X-Argos-Timestamp": timestamp,
        "X-Argos-Delivery-Id": payloadId,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseBody = await response.text();

    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      workspace_id: workspaceId,
      event_type: (payload as any).event,
      payload: payload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempt,
      delivered_at: response.ok ? new Date().toISOString() : null,
      status: response.ok ? "delivered" : "failed",
      payload_id: payloadId,
    });

    if (!response.ok && attempt < maxAttempts) {
      // Retry with exponential backoff
      const backoffMs = [1000, 30000, 300000][attempt - 1] || 300000;
      await new Promise(r => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: response.ok, status_code: response.status, attempts: attempt };
  } catch (err) {
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      workspace_id: workspaceId,
      event_type: (payload as any).event,
      payload: payload,
      response_status: 0,
      response_body: err.message,
      attempt,
      status: "failed",
      payload_id: payloadId,
    });

    if (attempt < maxAttempts) {
      const backoffMs = [1000, 30000, 300000][attempt - 1] || 300000;
      await new Promise(r => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: false, attempts: attempt };
  }
}
