import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Argos X — API Gateway v1 (Phase 1)
// Scopes · Pepper hash · Timing-safe · Postgres rate limit (fail-open)
// ══════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
};

// ── Valid scopes ──
const VALID_SCOPES = [
  "leads:read", "leads:write",
  "agents:read", "agents:write", "agents:execute",
  "messages:read", "messages:write",
  "campaigns:read",
  "calendar:read", "calendar:write",
  "tags:read", "tags:write",
  "funnels:read", "funnels:write",
  "webhooks:read", "webhooks:write",
  "clients:read",
] as const;
type Scope = typeof VALID_SCOPES[number];

// ── Rate limit config ──
const RATE_LIMIT_PER_MIN = 60; // default per key
const RATE_WINDOW_MS = 60_000;

// ══════════════════════════════════════════════════════════
// ── CRYPTO HELPERS ──
// ══════════════════════════════════════════════════════════

async function hashWithPepper(rawKey: string): Promise<string> {
  const pepper = Deno.env.get("API_KEY_PEPPER") || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(pepper + rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const encA = new TextEncoder().encode(a);
  const encB = new TextEncoder().encode(b);
  if (encA.length !== encB.length) return false;
  let result = 0;
  for (let i = 0; i < encA.length; i++) {
    result |= encA[i] ^ encB[i];
  }
  return result === 0;
}

function maskKey(raw: string): string {
  if (raw.length < 16) return "argx_***";
  return raw.substring(0, 12) + "..." + raw.substring(raw.length - 4);
}

// ── Extract prefix from token format argx_<prefix>_<random> ──
function extractPrefix(apiKey: string): string | null {
  const parts = apiKey.split("_");
  // argx_PREFIX_RANDOM → parts = ["argx", "PREFIX", "RANDOM..."]
  if (parts.length < 3 || parts[0] !== "argx") return null;
  return parts[1];
}

// ══════════════════════════════════════════════════════════
// ── POSTGRES RATE LIMITING (fail-open) ──
// ══════════════════════════════════════════════════════════

interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

async function checkRateLimit(supabase: any, keyId: string, maxReqs = RATE_LIMIT_PER_MIN): Promise<RateLimitInfo> {
  const now = Date.now();
  const resetAt = now + RATE_WINDOW_MS;
  try {
    const windowStart = new Date(now - RATE_WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from("api_key_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyId)
      .gte("created_at", windowStart);

    if (error) {
      console.error("[gateway] rate-limit query error (fail-open):", error.message);
      return { allowed: true, limit: maxReqs, remaining: maxReqs, resetAt };
    }

    const used = count || 0;
    const allowed = used < maxReqs;
    return {
      allowed,
      limit: maxReqs,
      remaining: Math.max(0, maxReqs - used),
      resetAt,
    };
  } catch (err) {
    console.error("[gateway] rate-limit exception (fail-open):", (err as Error).message);
    return { allowed: true, limit: maxReqs, remaining: maxReqs, resetAt };
  }
}

// ══════════════════════════════════════════════════════════
// ── RESPONSE HELPERS ──
// ══════════════════════════════════════════════════════════

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "X-API-Version": "v1", ...extra },
  });
}

function rlHeaders(rl: RateLimitInfo): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rl.limit),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
  };
}

// ══════════════════════════════════════════════════════════
// ── AUDIT LOG ──
// ══════════════════════════════════════════════════════════

async function logUsage(supabase: any, opts: {
  api_key_id: string; workspace_id: string; endpoint: string;
  method: string; status_code: number; ip_address?: string;
  user_agent?: string; latency_ms?: number; rate_limited?: boolean;
  idempotency_key?: string; payload_size?: number;
}) {
  await supabase.from("api_key_usage_log").insert({
    api_key_id: opts.api_key_id, workspace_id: opts.workspace_id,
    endpoint: opts.endpoint, method: opts.method, status_code: opts.status_code,
    ip_address: opts.ip_address || null, user_agent: opts.user_agent || null,
    latency_ms: opts.latency_ms || null, rate_limited: opts.rate_limited || false,
    idempotency_key: opts.idempotency_key || null, payload_size: opts.payload_size || null,
  });
}

// ══════════════════════════════════════════════════════════
// ── URL PARSING ──
// ══════════════════════════════════════════════════════════

function parsePath(pathname: string): { segments: string[] } {
  const parts = pathname.split("/").filter(Boolean);
  const v1Index = parts.indexOf("v1");
  const segments = v1Index >= 0 ? parts.slice(v1Index + 1) : [];
  return { segments };
}

// ══════════════════════════════════════════════════════════
// ── PAGINATION ──
// ══════════════════════════════════════════════════════════

function getPaginationParams(url: URL) {
  const cursor = url.searchParams.get("cursor") || null;
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);
  const updatedAfter = url.searchParams.get("updated_after") || null;
  const createdAfter = url.searchParams.get("created_after") || null;
  return { cursor, limit, updatedAfter, createdAfter };
}

// ══════════════════════════════════════════════════════════
// ── OPENAPI 3.1 SPEC ──
// ══════════════════════════════════════════════════════════

function buildOpenApiSpec(baseUrl: string): object {
  return {
    openapi: "3.1.0",
    info: {
      title: "Argos X API",
      version: "1.0.0",
      description: "API pública do Argos X para integração com sistemas externos (n8n, Make, scripts).",
      contact: { email: "suporte@argosx.com.br" },
    },
    servers: [{ url: baseUrl, description: "Production" }],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Chave de API no formato argx_<prefix>_<token>. Gerada em Configurações → API Keys.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
          required: ["error"],
        },
        WhoAmI: {
          type: "object",
          properties: {
            api_key_id: { type: "string", format: "uuid" },
            workspace_id: { type: "string", format: "uuid" },
            scopes: { type: "array", items: { type: "string" } },
          },
        },
        Lead: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string", nullable: true },
            company: { type: "string", nullable: true },
            source: { type: "string", nullable: true },
            stage_id: { type: "string", format: "uuid" },
            status: { type: "string" },
            value: { type: "number", nullable: true },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        Agent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            type: { type: "string" },
            model: { type: "string" },
            is_active: { type: "boolean" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                items: { type: "array" },
                has_more: { type: "boolean" },
                next_cursor: { type: "string", nullable: true },
                count: { type: "integer" },
              },
            },
          },
        },
      },
      parameters: {
        cursor: { name: "cursor", in: "query", schema: { type: "string" }, description: "Pagination cursor" },
        limit: { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
      },
    },
    paths: {
      "/v1/whoami": {
        get: {
          summary: "Verifica autenticação e retorna info da chave",
          operationId: "whoami",
          tags: ["Auth"],
          responses: {
            200: {
              description: "Chave válida",
              content: { "application/json": { schema: { $ref: "#/components/schemas/WhoAmI" } } },
            },
            401: { description: "Chave inválida ou ausente" },
          },
        },
      },
      "/v1/leads": {
        get: {
          summary: "Listar leads",
          operationId: "listLeads",
          tags: ["Leads"],
          parameters: [
            { $ref: "#/components/parameters/cursor" },
            { $ref: "#/components/parameters/limit" },
          ],
          responses: {
            200: { description: "Lista paginada de leads" },
            403: { description: "Scope leads:read necessário" },
          },
        },
        post: {
          summary: "Criar lead",
          operationId: "createLead",
          tags: ["Leads"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "phone", "stage_id"],
                  properties: {
                    name: { type: "string" },
                    phone: { type: "string" },
                    email: { type: "string" },
                    company: { type: "string" },
                    source: { type: "string" },
                    stage_id: { type: "string", format: "uuid" },
                    value: { type: "number" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Lead criado" },
            403: { description: "Scope leads:write necessário" },
          },
        },
      },
      "/v1/agents": {
        get: {
          summary: "Listar agentes IA",
          operationId: "listAgents",
          tags: ["Agents"],
          responses: {
            200: { description: "Lista de agentes" },
            403: { description: "Scope agents:read necessário" },
          },
        },
        post: {
          summary: "Criar agente IA",
          operationId: "createAgent",
          tags: ["Agents"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "system_prompt"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    type: { type: "string", default: "sdr" },
                    system_prompt: { type: "string" },
                    model: { type: "string", default: "google/gemini-3-flash-preview" },
                  },
                },
              },
            },
          },
          responses: { 200: { description: "Agente criado" }, 403: { description: "Scope agents:write necessário" } },
        },
      },
      "/v1/agents/{id}": {
        patch: {
          summary: "Atualizar agente IA",
          operationId: "updateAgent",
          tags: ["Agents"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Agente atualizado" }, 403: { description: "Scope agents:write necessário" } },
        },
      },
      "/v1/agents/{id}/execute": {
        post: {
          summary: "Executar agente IA",
          operationId: "executeAgent",
          tags: ["Agents"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["message"],
                  properties: {
                    message: { type: "string", maxLength: 10000 },
                    lead_id: { type: "string", format: "uuid" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Resposta do agente" },
            403: { description: "Scope agents:execute necessário" },
            504: { description: "Timeout (30s)" },
          },
        },
      },
      "/v1/webhooks": {
        get: {
          summary: "Listar webhooks registrados",
          operationId: "listWebhooks",
          tags: ["Webhooks"],
          responses: {
            200: { description: "Lista de webhooks" },
            403: { description: "Scope webhooks:read necessário" },
          },
        },
        post: {
          summary: "Registrar novo webhook",
          operationId: "createWebhook",
          tags: ["Webhooks"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url", "events"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    events: {
                      type: "array",
                      items: { type: "string", enum: ["lead.created", "message.received", "deal.stage_changed"] },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Webhook criado. O campo 'secret' é exibido uma única vez." },
            403: { description: "Scope webhooks:write necessário" },
          },
        },
      },
      "/v1/webhooks/{id}": {
        patch: {
          summary: "Atualizar webhook",
          operationId: "updateWebhook",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Webhook atualizado" }, 403: { description: "Scope webhooks:write necessário" } },
        },
        delete: {
          summary: "Remover webhook",
          operationId: "deleteWebhook",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Webhook removido" }, 403: { description: "Scope webhooks:write necessário" } },
        },
      },
      "/v1/webhooks/{id}/test": {
        post: {
          summary: "Enviar evento de teste",
          operationId: "testWebhook",
          tags: ["Webhooks"],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Evento de teste enviado" }, 403: { description: "Scope webhooks:write necessário" } },
        },
      },
      "/v1/clients": {
        get: {
          summary: "Listar clientes do workspace",
          operationId: "listClients",
          tags: ["Clients"],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000, default: 200 } },
            { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          ],
          responses: {
            200: { description: "Lista de clientes com total" },
            403: { description: "Scope clients:read necessário" },
          },
        },
      },
    },
  };
}

// ══════════════════════════════════════════════════════════
// ── SCOPE MIDDLEWARE ──
// ══════════════════════════════════════════════════════════

function requireScope(scopes: string[], required: Scope): Response | null {
  if (!scopes.includes(required)) {
    return json({ error: `Missing required scope: ${required}` }, 403);
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// ── PAGINATED QUERY ──
// ══════════════════════════════════════════════════════════

async function paginatedQuery(
  supabase: any,
  table: string,
  selectCols: string,
  workspaceId: string,
  params: { cursor: string | null; limit: number; updatedAfter: string | null; createdAfter: string | null },
  orderCol = "created_at"
) {
  let query = supabase
    .from(table)
    .select(selectCols)
    .eq("workspace_id", workspaceId)
    .order(orderCol, { ascending: false })
    .limit(params.limit + 1);

  if (params.cursor) {
    const { data: cursorRow } = await supabase.from(table).select(`id, ${orderCol}`).eq("id", params.cursor).single();
    if (cursorRow?.[orderCol]) {
      query = query.lt(orderCol, cursorRow[orderCol]);
    }
  }
  if (params.updatedAfter) {
    try { query = query.gte("updated_at", params.updatedAfter); } catch { /* col may not exist */ }
  }
  if (params.createdAfter) {
    query = query.gte("created_at", params.createdAfter);
  }

  const { data, error } = await query;
  if (error) throw error;

  const hasMore = (data?.length || 0) > params.limit;
  const items = hasMore ? data!.slice(0, params.limit) : (data || []);
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return { items, has_more: hasMore, next_cursor: nextCursor, count: items.length };
}

// ══════════════════════════════════════════════════════════
// ── WEBHOOK HELPERS (kept for existing handlers) ──
// ══════════════════════════════════════════════════════════

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

      deliverWebhook(supabase, wh, payload, workspaceId).catch((err) => {
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

  const encoder = new TextEncoder();
  const keyData = encoder.encode(webhook.secret_hash);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadStr));
  const signature = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const timestamp = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

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
      payload,
      response_status: response.status,
      response_body: responseBody.substring(0, 1000),
      attempt,
      delivered_at: response.ok ? new Date().toISOString() : null,
      status: response.ok ? "delivered" : "failed",
      payload_id: payloadId,
    });

    if (!response.ok && attempt < maxAttempts) {
      const backoffMs = [1000, 30000, 300000][attempt - 1] || 300000;
      await new Promise((r) => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: response.ok, status_code: response.status, attempts: attempt };
  } catch (err) {
    await supabase.from("webhook_deliveries").insert({
      webhook_id: webhook.id,
      workspace_id: workspaceId,
      event_type: (payload as any).event,
      payload,
      response_status: 0,
      response_body: (err as Error).message,
      attempt,
      status: "failed",
      payload_id: payloadId,
    });

    if (attempt < maxAttempts) {
      const backoffMs = [1000, 30000, 300000][attempt - 1] || 300000;
      await new Promise((r) => setTimeout(r, backoffMs));
      return deliverWebhook(supabase, webhook, payload, workspaceId, attempt + 1);
    }

    return { success: false, attempts: attempt };
  }
}

// ══════════════════════════════════════════════════════════
// ── MAIN HANDLER ──
// ══════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const clientUa = req.headers.get("user-agent") || "unknown";
  const idempotencyKey = req.headers.get("idempotency-key") || null;

  const url = new URL(req.url);
  const { segments } = parsePath(url.pathname);

  // ── PUBLIC ENDPOINTS (no auth) ──

  // GET /v1/openapi.json
  if (segments.length === 1 && segments[0] === "openapi.json") {
    const baseUrl = `${supabaseUrl}/functions/v1/api-gateway`;
    return json(buildOpenApiSpec(baseUrl));
  }

  // ── AUTHENTICATE ──
  const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");

  if (!apiKey) {
    return json({ error: "Invalid API key" }, 401);
  }

  // Extract prefix for fast lookup
  const prefix = extractPrefix(apiKey);
  if (!prefix) {
    return json({ error: "Invalid API key" }, 401);
  }

  try {
    // ── LOOKUP BY PREFIX ──
    const { data: candidates, error: lookupErr } = await supabase
      .from("api_keys")
      .select("id, workspace_id, scopes, is_active, expires_at, revoked_at, key_hash, rate_limit_per_hour, allowed_agent_ids")
      .eq("key_prefix", `argx_${prefix}`)
      .eq("is_active", true)
      .is("revoked_at", null);

    if (lookupErr || !candidates || candidates.length === 0) {
      return json({ error: "Invalid API key" }, 401);
    }

    // ── HASH + TIMING-SAFE COMPARE ──
    const computedHash = await hashWithPepper(apiKey);

    let keyRecord: typeof candidates[0] | null = null;
    for (const candidate of candidates) {
      if (timingSafeEqual(computedHash, candidate.key_hash)) {
        keyRecord = candidate;
        break;
      }
    }

    if (!keyRecord) {
      return json({ error: "Invalid API key" }, 401);
    }

    // ── EXPIRY CHECK ──
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return json({ error: "Invalid API key" }, 401);
    }

    // ── RATE LIMIT (Postgres, fail-open) ──
    const rl = await checkRateLimit(supabase, keyRecord.id, keyRecord.rate_limit_per_hour ? Math.ceil(keyRecord.rate_limit_per_hour / 60) : RATE_LIMIT_PER_MIN);

    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      await logUsage(supabase, {
        api_key_id: keyRecord.id, workspace_id: keyRecord.workspace_id,
        endpoint: url.pathname, method: req.method, status_code: 429,
        ip_address: clientIp, user_agent: clientUa, rate_limited: true,
      });
      return json(
        { error: "Rate limit exceeded", retry_after_seconds: Math.max(1, retryAfter) },
        429,
        { ...rlHeaders(rl), "Retry-After": String(Math.max(1, retryAfter)) }
      );
    }

    // Update last_used_at (fire-and-forget)
    supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id).then(() => {});

    const workspaceId = keyRecord.workspace_id;
    const scopes: string[] = keyRecord.scopes || [];

    // ── LOG MASKED KEY ──
    console.log(`[gateway] ${req.method} ${url.pathname} key=${maskKey(apiKey)} scopes=${scopes.join(",")}`);

    // ── PARSE BODY ──
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
    const pagination = getPaginationParams(url);

    // ── IDEMPOTENCY CHECK ──
    if (idempotencyKey && req.method !== "GET") {
      const { data: existing } = await supabase
        .from("api_key_usage_log")
        .select("status_code, created_at")
        .eq("idempotency_key", idempotencyKey)
        .eq("api_key_id", keyRecord.id)
        .limit(1)
        .maybeSingle();

      if (existing) {
        return json({
          error: "Duplicate request",
          idempotency_key: idempotencyKey,
          original_status: existing.status_code,
          original_at: existing.created_at,
        }, 409);
      }
    }

    // ═══════════════════════════════════════════
    // ── ROUTE DISPATCH ──
    // ═══════════════════════════════════════════

    const resource = segments[0] || null;
    const subpath = segments[1] || null;
    const action = segments[2] || null;
    let result: unknown;
    let endpointPath = `/${segments.join("/")}`;

    // ── /v1 (root) — API info ──
    if (!resource) {
      result = {
        version: "v1",
        docs: `${supabaseUrl}/functions/v1/api-gateway/v1/openapi.json`,
        authenticated: true,
        api_key_id: keyRecord.id,
        scopes,
      };
    }

    // ── GET /v1/whoami ──
    else if (resource === "whoami" && req.method === "GET") {
      result = {
        api_key_id: keyRecord.id,
        workspace_id: workspaceId,
        scopes,
      };
    }

    // ── LEADS ──
    else if (resource === "leads") {
      if (req.method === "GET") {
        const denied = requireScope(scopes, "leads:read");
        if (denied) return denied;

        result = await paginatedQuery(
          supabase, "leads",
          "id, name, phone, email, company, source, stage_id, responsible_user, value, status, created_at, updated_at",
          workspaceId, pagination
        );
      } else if (req.method === "POST") {
        const denied = requireScope(scopes, "leads:write");
        if (denied) return denied;

        if (!body.name || !body.phone || !body.stage_id) {
          return json({ error: "name, phone, and stage_id are required" }, 400);
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

        // Save custom fields if provided
        const customFields = body.custom_fields as Record<string, string> | undefined;
        if (customFields && typeof customFields === "object" && Object.keys(customFields).length > 0) {
          const customKeys = Object.keys(customFields);
          const { data: fieldDefs } = await supabase
            .from("lead_custom_field_definitions")
            .select("id, field_key")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .in("field_key", customKeys);

          if (fieldDefs && fieldDefs.length > 0) {
            const rows = fieldDefs.map((def: any) => ({
              lead_id: data.id,
              field_definition_id: def.id,
              workspace_id: workspaceId,
              value: String(customFields[def.field_key] || ""),
              updated_at: new Date().toISOString(),
            }));
            await supabase
              .from("lead_custom_field_values")
              .upsert(rows, { onConflict: "lead_id,field_definition_id" });
          }
        }

        fireWebhookEvent(supabase, workspaceId, "lead.created", data);
        result = data;
      } else if (req.method === "PATCH") {
        const denied = requireScope(scopes, "leads:write");
        if (denied) return denied;

        if (!subpath) return json({ error: "Lead ID required: PATCH /v1/leads/:id" }, 400);
        const updates = { ...body };
        delete updates.workspace_id;
        delete updates.id;
        const { data, error } = await supabase
          .from("leads").update(updates).eq("id", subpath).eq("workspace_id", workspaceId).select().single();
        if (error) throw error;
        result = data;
      } else {
        return json({ error: "Method not allowed" }, 405);
      }
    }

    // ── AGENTS ──
    else if (resource === "agents") {
      if (req.method === "GET") {
        const denied = requireScope(scopes, "agents:read");
        if (denied) return denied;

        const { data } = await supabase
          .from("ai_agents")
          .select("id, name, description, type, model, is_active, created_at")
          .eq("workspace_id", workspaceId);
        result = { items: data, has_more: false, next_cursor: null, count: data?.length || 0 };
      } else if (req.method === "POST" && action === "execute" && subpath) {
        // POST /v1/agents/:id/execute
        const denied = requireScope(scopes, "agents:execute");
        if (denied) return denied;

        endpointPath = `/agents/${subpath}/execute`;
        const agentId = subpath;

        // Allowlist check
        if (keyRecord.allowed_agent_ids && Array.isArray(keyRecord.allowed_agent_ids)) {
          if (!keyRecord.allowed_agent_ids.includes(agentId)) {
            return json({ error: "Agent not in allowlist for this API key" }, 403);
          }
        }

        const { data: agent, error: agentErr } = await supabase
          .from("ai_agents")
          .select("id, name, is_active, model")
          .eq("id", agentId).eq("workspace_id", workspaceId).single();
        if (agentErr || !agent) return json({ error: "Agent not found" }, 404);
        if (!agent.is_active) return json({ error: "Agent is disabled" }, 403);

        const inputMessage = body.message as string;
        const leadId = body.lead_id as string | undefined;
        if (!inputMessage) return json({ error: "message is required" }, 400);
        if (inputMessage.length > 10000) return json({ error: "Message exceeds 10000 character limit" }, 400);

        const sessionId = `api_${keyRecord.id}_${Date.now()}`;
        const execStart = Date.now();
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 30_000);

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

          clearTimeout(timeoutHandle);
          const execLatency = Date.now() - execStart;

          if (!agentResponse.ok) {
            const errText = await agentResponse.text();
            await supabase.from("agent_executions").insert({
              agent_id: agentId, workspace_id: workspaceId, session_id: sessionId,
              input_message: inputMessage, status: "error", error_message: errText,
              latency_ms: execLatency, lead_id: leadId || null,
            });
            return json({ error: "Agent execution failed" }, 502);
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
            latency_ms: execLatency,
          };
        } catch (abortErr) {
          clearTimeout(timeoutHandle);
          if ((abortErr as Error).name === "AbortError") {
            const execLatency = Date.now() - execStart;
            await supabase.from("agent_executions").insert({
              agent_id: agentId, workspace_id: workspaceId, session_id: sessionId,
              input_message: inputMessage, status: "timeout",
              error_message: "Execution exceeded 30s timeout",
              latency_ms: execLatency, lead_id: leadId || null,
            });
            return json({ error: "Agent execution timed out (30s)" }, 504);
          }
          throw abortErr;
        }
      } else if (req.method === "POST" && !action) {
        // POST /v1/agents — create agent
        const denied = requireScope(scopes, "agents:write");
        if (denied) return denied;

        if (!body.name || !body.system_prompt) {
          return json({ error: "name and system_prompt are required" }, 400);
        }

        const { data, error } = await supabase
          .from("ai_agents")
          .insert({
            name: body.name,
            description: body.description || null,
            type: body.type || "sdr",
            system_prompt: body.system_prompt,
            model: body.model || "google/gemini-3-flash-preview",
            workspace_id: workspaceId,
          })
          .select("id, name, description, type, model, is_active, created_at")
          .single();
        if (error) throw error;
        result = data;
      } else if (req.method === "PATCH" && subpath && !action) {
        // PATCH /v1/agents/:id
        const denied = requireScope(scopes, "agents:write");
        if (denied) return denied;

        const updates = { ...body };
        delete updates.workspace_id;
        delete updates.id;
        const { data, error } = await supabase
          .from("ai_agents")
          .update(updates)
          .eq("id", subpath)
          .eq("workspace_id", workspaceId)
          .select("id, name, description, type, model, is_active, created_at")
          .single();
        if (error) throw error;
        result = data;
      } else {
        return json({ error: "Method not allowed" }, 405);
      }
    }

    // ── WEBHOOKS ──
    else if (resource === "webhooks") {
      if (req.method === "GET") {
        const denied = requireScope(scopes, "webhooks:read");
        if (denied) return denied;

        const { data, error } = await supabase
          .from("webhooks")
          .select("id, url, events, is_active, secret_prefix, created_at, updated_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = { items: data || [], has_more: false, next_cursor: null, count: data?.length || 0 };
      } else if (req.method === "POST" && subpath && action === "test") {
        // POST /v1/webhooks/:id/test
        const denied = requireScope(scopes, "webhooks:write");
        if (denied) return denied;

        endpointPath = `/webhooks/${subpath}/test`;
        const { data: wh, error: whErr } = await supabase
          .from("webhooks")
          .select("id, url, secret_hash, is_active, events")
          .eq("id", subpath)
          .eq("workspace_id", workspaceId)
          .single();
        if (whErr || !wh) return json({ error: "Webhook not found" }, 404);

        const testPayload = {
          event: "test",
          workspace_id: workspaceId,
          timestamp: new Date().toISOString(),
          data: { message: "This is a test event from Argos X" },
        };

        const delivery = await deliverWebhook(supabase, wh, testPayload, workspaceId);
        result = { webhook_id: wh.id, delivery };
      } else if (req.method === "POST" && !subpath) {
        // POST /v1/webhooks — register new webhook
        const denied = requireScope(scopes, "webhooks:write");
        if (denied) return denied;

        if (!body.url || !body.events || !Array.isArray(body.events) || body.events.length === 0) {
          return json({ error: "url and events[] are required" }, 400);
        }

        const validEvents = ["lead.created", "message.received", "deal.stage_changed"];
        const invalidEvents = (body.events as string[]).filter(e => !validEvents.includes(e));
        if (invalidEvents.length > 0) {
          return json({ error: `Invalid events: ${invalidEvents.join(", ")}. Valid: ${validEvents.join(", ")}` }, 400);
        }

        // Generate whsec_ secret
        const rawBytes = new Uint8Array(32);
        crypto.getRandomValues(rawBytes);
        const rawSecret = "whsec_" + Array.from(rawBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        const secretPrefix = rawSecret.substring(0, 12);

        // Hash the secret for storage
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawSecret));
        const secretHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const { data: webhook, error: insertErr } = await supabase
          .from("webhooks")
          .insert({
            workspace_id: workspaceId,
            url: body.url,
            events: body.events,
            secret_hash: secretHash,
            secret_prefix: secretPrefix,
            is_active: true,
            created_by: null,
          })
          .select("id, url, events, is_active, secret_prefix, created_at")
          .single();
        if (insertErr) throw insertErr;

        result = {
          webhook,
          secret: rawSecret,
          warning: "Salve o secret agora! Ele não será exibido novamente.",
        };
      } else if (req.method === "PATCH" && subpath && !action) {
        // PATCH /v1/webhooks/:id — toggle active
        const denied = requireScope(scopes, "webhooks:write");
        if (denied) return denied;

        const updates: Record<string, unknown> = {};
        if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
        if (body.url) updates.url = body.url;
        if (body.events && Array.isArray(body.events)) updates.events = body.events;

        const { data, error } = await supabase
          .from("webhooks")
          .update(updates)
          .eq("id", subpath)
          .eq("workspace_id", workspaceId)
          .select("id, url, events, is_active, secret_prefix, created_at, updated_at")
          .single();
        if (error) throw error;
        result = data;
      } else if (req.method === "DELETE" && subpath) {
        // DELETE /v1/webhooks/:id
        const denied = requireScope(scopes, "webhooks:write");
        if (denied) return denied;

        const { error } = await supabase
          .from("webhooks")
          .delete()
          .eq("id", subpath)
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        result = { deleted: true, id: subpath };
      } else {
        return json({ error: "Method not allowed" }, 405);
      }
    }

    // ── CLIENTS ──
    else if (resource === "clients") {
      if (req.method === "GET") {
        const denied = requireScope(scopes, "clients:read");
        if (denied) return denied;

        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");
        const limit = Math.min(Math.max(parseInt(limitParam || "200", 10) || 200, 1), 1000);
        const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);

        // Get total count
        const { count: totalCount, error: countErr } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        if (countErr) throw countErr;

        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) throw error;

        result = { clients: data || [], total: totalCount || 0, limit, offset };
      } else {
        return json({ error: "Method not allowed" }, 405);
      }
    }

    // ── UNKNOWN RESOURCE ──
    else {
      return json({ error: `Unknown resource: ${resource}` }, 404);
    }

    // ── AUDIT LOG + RESPONSE ──
    const latencyMs = Date.now() - requestStart;
    await logUsage(supabase, {
      api_key_id: keyRecord.id, workspace_id: workspaceId,
      endpoint: endpointPath, method: req.method, status_code: 200,
      ip_address: clientIp, user_agent: clientUa, latency_ms: latencyMs,
      idempotency_key: idempotencyKey || undefined, payload_size: payloadSize || undefined,
    });

    return json({ data: result }, 200, rlHeaders(rl));
  } catch (err) {
    console.error("[gateway] error:", (err as Error).message);
    return json({ error: "Internal server error" }, 500);
  }
});

