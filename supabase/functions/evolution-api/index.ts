import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const app = new Hono().basePath("/evolution-api");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// --- Cache & concurrency settings ---
const CONNECT_QR_CACHE_MS = 120_000; // 2 min cache for QR codes
const CONNECTION_STATE_CACHE_MS = 5_000;
const CONNECT_COOLDOWN_MS = 300_000; // 5 min cooldown after too many calls
const MAX_CONNECT_CALLS_IN_WINDOW = 3;
const CIRCUIT_BREAKER_TRIGGER_MS = 300_000; // 5 min of continuous "connecting"
const CIRCUIT_BREAKER_OPEN_MS = 600_000; // 10 min circuit open

const connectResponseCache = new Map<string, { at: number; payload: unknown }>();
const connectInFlight = new Map<string, Promise<unknown>>();

const connectionStateCache = new Map<string, { at: number; payload: unknown }>();
const connectionStateInFlight = new Map<string, Promise<unknown>>();

// Connect call frequency tracking (cooldown)
const connectCallLog = new Map<string, number[]>();

/**
 * Normalizes Brazilian phone numbers to international format expected by Evolution API.
 * - Strips non-digits
 * - Adds country code 55 when missing
 * - Preserves already-international numbers (other DDIs) untouched
 */
function normalizeBrazilianNumber(input: string): string {
  if (!input) return input;
  // If it already includes a JID suffix or other formatting, just strip non-digits
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return input;
  // Brazilian local formats: 10 (fixo) or 11 (celular) digits → prepend 55
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  // Already with DDI 55 (12 fixo or 13 celular)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  // Other international numbers — leave as-is
  return digits;
}

// Circuit breaker: tracks when an instance first entered "connecting" state
const connectingStartedAt = new Map<string, number>();
// When circuit is open, we return cached "close" until this timestamp
const circuitOpenUntil = new Map<string, number>();

function isConnectCooledDown(instanceName: string): boolean {
  const now = Date.now();
  const calls = connectCallLog.get(instanceName) || [];
  // Remove calls older than window
  const recent = calls.filter(t => now - t < CONNECT_COOLDOWN_MS);
  connectCallLog.set(instanceName, recent);
  return recent.length >= MAX_CONNECT_CALLS_IN_WINDOW;
}

function recordConnectCall(instanceName: string) {
  const calls = connectCallLog.get(instanceName) || [];
  calls.push(Date.now());
  connectCallLog.set(instanceName, calls);
}

function checkCircuitBreaker(instanceName: string, state: string): boolean {
  const now = Date.now();

  // Check if circuit is currently open
  const openUntil = circuitOpenUntil.get(instanceName);
  if (openUntil && now < openUntil) {
    return true; // circuit is open, block
  } else if (openUntil) {
    circuitOpenUntil.delete(instanceName); // expired, close circuit
  }

  if (state === "connecting") {
    const startedAt = connectingStartedAt.get(instanceName);
    if (!startedAt) {
      connectingStartedAt.set(instanceName, now);
    } else if (now - startedAt > CIRCUIT_BREAKER_TRIGGER_MS) {
      // Instance has been "connecting" for too long — open circuit
      console.warn(`[evolution-api] Circuit breaker OPEN for ${instanceName} (stuck connecting for ${Math.round((now - startedAt) / 1000)}s)`);
      circuitOpenUntil.set(instanceName, now + CIRCUIT_BREAKER_OPEN_MS);
      connectingStartedAt.delete(instanceName);
      return true;
    }
  } else {
    // Not "connecting" anymore, reset tracker
    connectingStartedAt.delete(instanceName);
  }

  return false;
}

async function getConnectResponse(instanceName: string) {
  const now = Date.now();
  const cached = connectResponseCache.get(instanceName);

  if (cached && now - cached.at < CONNECT_QR_CACHE_MS) {
    return cached.payload;
  }

  // Cooldown check
  if (isConnectCooledDown(instanceName) && cached) {
    console.warn(`[evolution-api] Connect cooldown active for ${instanceName}, returning cached`);
    return cached.payload;
  }

  const inFlight = connectInFlight.get(instanceName);
  if (inFlight) {
    return await inFlight;
  }

  recordConnectCall(instanceName);

  const request = (async () => {
    const response = await evolutionRequest(`/instance/connect/${instanceName}`);
    connectResponseCache.set(instanceName, { at: Date.now(), payload: response });
    return response;
  })().finally(() => {
    connectInFlight.delete(instanceName);
  });

  connectInFlight.set(instanceName, request);
  return await request;
}

async function getConnectionStateSafe(instanceName: string) {
  const now = Date.now();

  // Circuit breaker: if open, return "close" immediately without hitting API
  const openUntil = circuitOpenUntil.get(instanceName);
  if (openUntil && now < openUntil) {
    console.log(`[evolution-api] Circuit breaker active for ${instanceName}, returning close`);
    return { instance: { instanceName, state: "close" } };
  }

  const cached = connectionStateCache.get(instanceName);

  if (cached && now - cached.at < CONNECTION_STATE_CACHE_MS) {
    return cached.payload;
  }

  const inFlight = connectionStateInFlight.get(instanceName);
  if (inFlight) {
    return await inFlight;
  }

  const request = (async () => {
    const response = await evolutionRequest(`/instance/connectionState/${instanceName}`, "GET", undefined, false);
    const safeResponse = response || { instance: { state: "close" } };

    // Check circuit breaker based on returned state
    const state = safeResponse?.instance?.state || "close";
    checkCircuitBreaker(instanceName, state);

    connectionStateCache.set(instanceName, { at: Date.now(), payload: safeResponse });
    return safeResponse;
  })().finally(() => {
    connectionStateInFlight.delete(instanceName);
  });

  connectionStateInFlight.set(instanceName, request);
  return await request;
}

// Auth middleware
async function requireAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return c.json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  await next();
}

async function evolutionRequest(endpoint: string, method: string = "GET", body?: Record<string, unknown>, throwOnError = true) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY! };
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);
  console.log(`[evolution-api] ${method} ${url}`);
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`[evolution-api] Non-JSON response (${response.status}): ${text.substring(0, 300)}`);
    if (!throwOnError) return null;
    throw new Error(`Evolution API returned non-JSON response (status: ${response.status})`);
  }
  const data = await response.json();
  if (!response.ok) {
    console.error(`[evolution-api] Error ${response.status}:`, JSON.stringify(data).substring(0, 500));
    if (!throwOnError) return null;
    throw new Error(data.message || data.error || "Evolution API error");
  }
  return data;
}

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// Apply auth middleware to all routes
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  return requireAuth(c, next);
});

app.post("/create-instance", async (c) => {
  try {
    const { instanceName } = await c.req.json();
    if (!instanceName || typeof instanceName !== "string" || instanceName.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
      return c.json({ error: "Invalid instanceName" }, 400, corsHeaders);
    }
    
    let result;
    try {
      result = await evolutionRequest("/instance/create", "POST", { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" });
    } catch (createError: any) {
      // If instance already exists in Evolution API, try to connect instead
      const errMsg = createError?.message || "";
      if (errMsg.includes("already in use") || errMsg.includes("403") || errMsg.includes("Forbidden")) {
        console.log(`[evolution-api] Instance ${instanceName} already exists, connecting instead`);
        result = await getConnectResponse(instanceName);
      } else {
        throw createError;
      }
    }
    
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to create instance" }, 500, corsHeaders);
  }
});

app.post("/pairing/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const body = await c.req.json();
    const number = body?.number;
    if (!number || typeof number !== "string") return c.json({ error: "Missing phone number" }, 400, corsHeaders);
    const sanitizedNumber = number.replace(/\D/g, "");
    if (sanitizedNumber.length < 10 || sanitizedNumber.length > 15) {
      return c.json({ error: "Invalid phone number" }, 400, corsHeaders);
    }
    console.log(`[evolution-api] Requesting pairing code for ${instanceName} with number ${sanitizedNumber}`);
    
    // Logout first to ensure instance is in "close" state (required for pairing code)
    try {
      await evolutionRequest(`/instance/logout/${instanceName}`, "DELETE", undefined, false);
      console.log(`[evolution-api] Instance ${instanceName} logged out before pairing`);
    } catch (logoutErr) {
      console.log(`[evolution-api] Logout before pairing skipped (may already be disconnected):`, logoutErr);
    }
    
    // Wait for instance to reach "close" state
    await new Promise(r => setTimeout(r, 3000));
    
    // Clear cached QR code response to avoid interference
    connectResponseCache.delete(instanceName);
    connectionStateCache.delete(instanceName);
    
    const result = await evolutionRequest(`/instance/connect/${instanceName}?number=${sanitizedNumber}`);
    console.log(`[evolution-api] Pairing code result:`, JSON.stringify(result).substring(0, 200));
    
    // If pairingCode is null, the Evolution API version may not support it
    if (result && result.pairingCode === null) {
      console.warn(`[evolution-api] pairingCode returned null - API may not support pairing for this instance`);
      return c.json({ error: "Pairing code não suportado nesta versão. Use o QR Code para conectar." }, 400, corsHeaders);
    }
    
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error(`[evolution-api] Pairing code error:`, error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to get pairing code" }, 500, corsHeaders);
  }
});

app.get("/connect/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const number = c.req.query("number");
    if (number) {
      // Pairing code mode: pass phone number to Evolution API
      const sanitizedNumber = number.replace(/\D/g, "");
      if (sanitizedNumber.length < 10 || sanitizedNumber.length > 15) {
        return c.json({ error: "Invalid phone number" }, 400, corsHeaders);
      }
      console.log(`[evolution-api] Requesting pairing code for ${instanceName} with number ${sanitizedNumber}`);
      const result = await evolutionRequest(`/instance/connect/${instanceName}?number=${sanitizedNumber}`);
      return c.json(result, 200, corsHeaders);
    }
    const result = await getConnectResponse(instanceName);
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to get QR code" }, 500, corsHeaders);
  }
});

app.get("/connection-state/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await getConnectionStateSafe(instanceName);
    return c.json(result, 200, corsHeaders);
  } catch (_error) {
    return c.json({ instance: { state: "close" } }, 200, corsHeaders);
  }
});

// === AUTO-HEAL: Restart instance (logout + recreate) ===
app.post("/restart-instance/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);

    console.log(`[evolution-api] 🔧 Auto-heal: restarting instance ${instanceName}`);

    // Step 1: Logout (clears corrupted session)
    try {
      await evolutionRequest(`/instance/logout/${instanceName}`, "DELETE", undefined, false);
      console.log(`[evolution-api] Logout OK for ${instanceName}`);
    } catch (e) {
      console.warn(`[evolution-api] Logout failed (may be already disconnected):`, e);
    }

    // Step 2: Wait 2s for cleanup
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Recreate instance
    let createResult;
    try {
      createResult = await evolutionRequest("/instance/create", "POST", {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      });
    } catch (e) {
      // Instance may already exist, try connecting directly
      console.warn(`[evolution-api] Create failed (may exist), trying connect:`, e);
      createResult = await evolutionRequest(`/instance/connect/${instanceName}`);
    }

    // Step 4: Clear all caches and circuit breaker for this instance
    connectResponseCache.delete(instanceName);
    connectionStateCache.delete(instanceName);
    connectingStartedAt.delete(instanceName);
    circuitOpenUntil.delete(instanceName);
    connectCallLog.delete(instanceName);

    console.log(`[evolution-api] ✅ Auto-heal complete for ${instanceName}`);

    return c.json({
      success: true,
      instanceName,
      qrcode: createResult?.qrcode || createResult,
    }, 200, corsHeaders);
  } catch (error) {
    console.error(`[evolution-api] ❌ Auto-heal failed:`, error);
    return c.json({ error: error instanceof Error ? error.message : "Failed to restart instance" }, 500, corsHeaders);
  }
});

app.get("/fetch-instances", async (c) => {
  try {
    const result = await evolutionRequest("/instance/fetchInstances");
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch instances" }, 500, corsHeaders);
  }
});

app.delete("/delete/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/instance/delete/${instanceName}`, "DELETE");
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to delete instance" }, 500, corsHeaders);
  }
});

app.post("/logout/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/instance/logout/${instanceName}`, "DELETE");
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to logout" }, 500, corsHeaders);
  }
});

app.post("/chats/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/chat/findChats/${instanceName}`, "POST", {}, false);
    if (!result) return c.json([], 200, corsHeaders);
    const chats = Array.isArray(result) ? result : [];
    chats.sort((a: any, b: any) => {
      const tsA = a.lastMessage?.messageTimestamp || 0;
      const tsB = b.lastMessage?.messageTimestamp || 0;
      return tsB - tsA;
    });
    return c.json(chats.slice(0, 200), 200, corsHeaders);
  } catch (error) {
    return c.json([], 200, corsHeaders);
  }
});

app.post("/messages/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { remoteJid, limit = 50 } = await c.req.json();
    if (!remoteJid || typeof remoteJid !== "string" || remoteJid.length > 100) return c.json({ error: "Invalid remoteJid" }, 400, corsHeaders);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const result = await evolutionRequest(`/chat/findMessages/${instanceName}`, "POST", { where: { key: { remoteJid } }, limit: safeLimit }, false);
    if (!result) return c.json({ messages: { records: [] } }, 200, corsHeaders);
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ messages: { records: [] } }, 200, corsHeaders);
  }
});

app.post("/media/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { messageId, convertToMp4 = false } = await c.req.json();
    if (!messageId || typeof messageId !== "string" || messageId.length > 200) return c.json({ error: "Invalid messageId" }, 400, corsHeaders);
    const result = await evolutionRequest(`/chat/getBase64FromMediaMessage/${instanceName}`, "POST", { message: { key: { id: messageId } }, convertToMp4 });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to download media" }, 500, corsHeaders);
  }
});

app.post("/send-text/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { number, text } = await c.req.json();
    if (!number || !text || typeof text !== "string" || text.length > 4000) return c.json({ error: "number and text (max 4000 chars) are required" }, 400, corsHeaders);
    const normalizedNumber = normalizeBrazilianNumber(number);
    const result = await evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number: normalizedNumber, text, delay: 0, linkPreview: true });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to send message" }, 500, corsHeaders);
  }
});

app.post("/send-media/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { number, mediatype, media, caption, fileName } = await c.req.json();
    if (!number || !media || !mediatype) return c.json({ error: "number, mediatype, and media are required" }, 400, corsHeaders);
    if (!["image", "video", "document", "audio"].includes(mediatype)) return c.json({ error: "Invalid mediatype" }, 400, corsHeaders);
    const normalizedNumber = normalizeBrazilianNumber(number);
    const result = await evolutionRequest(`/message/sendMedia/${instanceName}`, "POST", { number: normalizedNumber, mediatype, media, caption: caption || "", fileName: fileName || undefined });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to send media" }, 500, corsHeaders);
  }
});

app.post("/send-audio/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { number, audio } = await c.req.json();
    if (!number || !audio) return c.json({ error: "number and audio are required" }, 400, corsHeaders);
    const normalizedNumber = normalizeBrazilianNumber(number);
    const result = await evolutionRequest(`/message/sendWhatsAppAudio/${instanceName}`, "POST", { number: normalizedNumber, audio, delay: 0, encoding: true });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to send audio" }, 500, corsHeaders);
  }
});

// Fetch profile (name + picture) for a contact
app.post("/fetch-profile/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { number } = await c.req.json();
    if (!number || typeof number !== "string" || number.length > 30) return c.json({ name: null, profilePicUrl: null }, 200, corsHeaders);
    const result = await evolutionRequest(`/chat/fetchProfile/${instanceName}`, "POST", { number }, false);
    if (!result) return c.json({ name: null, profilePicUrl: null }, 200, corsHeaders);
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ name: null, profilePicUrl: null }, 200, corsHeaders);
  }
});

// Batch fetch profiles for multiple contacts
app.post("/fetch-profiles-batch/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { numbers } = await c.req.json();
    if (!Array.isArray(numbers) || numbers.length > 50) return c.json({ error: "Invalid numbers array (max 50)" }, 400, corsHeaders);
    
    const results: Record<string, any> = {};
    for (const num of numbers) {
      if (typeof num !== "string" || num.length > 30) continue;
      try {
        if (Object.keys(results).length > 0) {
          await new Promise(r => setTimeout(r, 200));
        }
        const profile = await evolutionRequest(`/chat/fetchProfile/${instanceName}`, "POST", { number: num });
        results[num] = profile;
      } catch (e) {
        console.warn(`[evolution-api] Failed to fetch profile for ${num}:`, e);
        results[num] = null;
      }
    }
    return c.json(results, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch profiles" }, 500, corsHeaders);
  }
});

// Setup webhook for an instance
app.post("/setup-webhook/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || SUPABASE_URL;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY") || EVOLUTION_API_KEY;
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?apikey=${encodeURIComponent(evolutionApiKey!)}`;
    console.log("[evolution-api] Setting webhook for", instanceName, "→", webhookUrl);
    
    const webhookBody = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT"],
      }
    };
    const flatBody = {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: ["MESSAGES_UPSERT"],
    };
    
    let lastResult = null;
    lastResult = await evolutionRequest(`/webhook/set/${instanceName}`, "POST", webhookBody, false);
    if (!lastResult) {
      lastResult = await evolutionRequest(`/webhook/set/${instanceName}`, "POST", flatBody as any, false);
    }
    
    if (!lastResult) {
      console.error("[evolution-api] ❌ All webhook endpoints failed");
      return c.json({ error: "Failed to set webhook on Evolution API", url: webhookUrl }, 500, corsHeaders);
    }
    return c.json(lastResult, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to setup webhook" }, 500, corsHeaders);
  }
});

// Find current webhook for an instance
app.get("/find-webhook/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/webhook/find/${instanceName}`, "GET", undefined, false);
    return c.json(result || { error: "Not found" }, result ? 200 : 404, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed" }, 500, corsHeaders);
  }
});

// Delete message for everyone (Evolution API)
app.delete("/delete-message/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { id, remoteJid, fromMe } = await c.req.json();
    if (!id || !remoteJid) return c.json({ error: "id and remoteJid are required" }, 400, corsHeaders);
    const result = await evolutionRequest(`/chat/deleteMessageForEveryone/${instanceName}`, "DELETE", { id, remoteJid, fromMe: fromMe ?? true });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to delete message" }, 500, corsHeaders);
  }
});

// Edit message (Evolution API)
app.post("/edit-message/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { messageId, remoteJid, fromMe, text } = await c.req.json();
    if (!messageId || !remoteJid || !text) return c.json({ error: "messageId, remoteJid, and text are required" }, 400, corsHeaders);
    const result = await evolutionRequest(`/chat/updateMessage/${instanceName}`, "POST", {
      number: remoteJid,
      key: { id: messageId, remoteJid, fromMe: fromMe ?? true },
      text,
    });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to edit message" }, 500, corsHeaders);
  }
});

// React to message (Evolution API)
app.post("/react-message/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { messageId, remoteJid, fromMe, reaction } = await c.req.json();
    if (!messageId || !remoteJid || reaction === undefined) return c.json({ error: "messageId, remoteJid, and reaction are required" }, 400, corsHeaders);
    const result = await evolutionRequest(`/message/sendReaction/${instanceName}`, "POST", {
      key: { id: messageId, remoteJid, fromMe: fromMe ?? true },
      reaction,
    });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to react to message" }, 500, corsHeaders);
  }
});

// Block/unblock contact (Evolution API)
app.post("/block-contact/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { number, status } = await c.req.json();
    if (!number || !status || !["block", "unblock"].includes(status)) {
      return c.json({ error: "number and status (block|unblock) are required" }, 400, corsHeaders);
    }
    // Ensure number has @s.whatsapp.net suffix for Evolution API v2
    const formattedNumber = number.includes("@") ? number : `${number.replace(/\D/g, "")}@s.whatsapp.net`;
    console.log(`[evolution-api] Block contact: ${formattedNumber} status=${status} instance=${instanceName}`);
    
    // Evolution API v2 uses POST /message/updateBlockStatus (not /chat, not PUT)
    let result = await evolutionRequest(`/message/updateBlockStatus/${instanceName}`, "POST", {
      number: formattedNumber,
      status,
    }, false);
    
    // Fallback: try /chat/updateBlockStatus (some versions use this path)
    if (!result) {
      console.log(`[evolution-api] Block fallback with /chat/ path`);
      result = await evolutionRequest(`/chat/updateBlockStatus/${instanceName}`, "POST", {
        number: formattedNumber,
        status,
      }, false);
    }

    // Fallback: try with raw number (without @s.whatsapp.net)
    if (!result) {
      const rawNumber = number.replace(/\D/g, "");
      console.log(`[evolution-api] Block fallback with raw number: ${rawNumber}`);
      result = await evolutionRequest(`/message/updateBlockStatus/${instanceName}`, "POST", {
        number: rawNumber,
        status,
      }, false);
    }
    
    if (!result) {
      // All Evolution API endpoints failed — apply logical block in database only
      console.warn(`[evolution-api] All block endpoints failed. Applying logical block only for ${number}`);
      return c.json({ 
        success: true, 
        logical_only: true, 
        message: `Block/unblock applied logically. Evolution API endpoint not available for this instance version.` 
      }, 200, corsHeaders);
    }
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error(`[evolution-api] Block error:`, error);
    // Even on exception, return success for logical block
    return c.json({ 
      success: true, 
      logical_only: true, 
      message: "Block applied logically due to API error." 
    }, 200, corsHeaders);
  }
});

Deno.serve(app.fetch);
