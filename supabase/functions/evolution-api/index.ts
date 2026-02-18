import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const app = new Hono().basePath("/evolution-api");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

async function evolutionRequest(endpoint: string, method: string = "GET", body?: Record<string, unknown>) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY! };
  const options: RequestInit = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(`Evolution API returned non-JSON response (status: ${response.status})`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Evolution API error");
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
    const result = await evolutionRequest("/instance/create", "POST", { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to create instance" }, 500, corsHeaders);
  }
});

app.get("/connect/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/instance/connect/${instanceName}`);
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to get QR code" }, 500, corsHeaders);
  }
});

app.get("/connection-state/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const result = await evolutionRequest(`/instance/connectionState/${instanceName}`);
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to get connection state" }, 500, corsHeaders);
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
    const result = await evolutionRequest(`/chat/findChats/${instanceName}`, "POST", {});
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);
    const todayISO = today.toISOString().split('T')[0];
    const filteredChats = Array.isArray(result) ? result.filter((chat: any) => {
      const updatedAtStr = chat.updatedAt;
      const windowStart = chat.windowStart;
      const lastMsgTimestamp = chat.lastMessage?.messageTimestamp;
      if (updatedAtStr && updatedAtStr.split('T')[0] === todayISO) return true;
      if (windowStart && windowStart.split('T')[0] === todayISO) return true;
      if (lastMsgTimestamp) {
        const ts = lastMsgTimestamp > 9999999999 ? Math.floor(lastMsgTimestamp / 1000) : lastMsgTimestamp;
        if (ts >= todayTimestamp) return true;
      }
      return false;
    }) : [];
    return c.json(filteredChats, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch chats" }, 500, corsHeaders);
  }
});

app.post("/messages/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    if (!/^[a-zA-Z0-9_-]+$/.test(instanceName)) return c.json({ error: "Invalid instance name" }, 400, corsHeaders);
    const { remoteJid, limit = 50 } = await c.req.json();
    if (!remoteJid || typeof remoteJid !== "string" || remoteJid.length > 100) return c.json({ error: "Invalid remoteJid" }, 400, corsHeaders);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const result = await evolutionRequest(`/chat/findMessages/${instanceName}`, "POST", { where: { key: { remoteJid } }, limit: safeLimit });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch messages" }, 500, corsHeaders);
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
    const result = await evolutionRequest(`/message/sendText/${instanceName}`, "POST", { number, text, delay: 0, linkPreview: true });
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
    const result = await evolutionRequest(`/message/sendMedia/${instanceName}`, "POST", { number, mediatype, media, caption: caption || "", fileName: fileName || undefined });
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
    const result = await evolutionRequest(`/message/sendWhatsAppAudio/${instanceName}`, "POST", { number, audio, delay: 0, encoding: true });
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
    if (!number || typeof number !== "string" || number.length > 30) return c.json({ error: "Invalid number" }, 400, corsHeaders);
    const result = await evolutionRequest(`/chat/fetchProfile/${instanceName}`, "POST", { number });
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to fetch profile" }, 500, corsHeaders);
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
        // Add small delay between requests to respect rate limits
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

Deno.serve(app.fetch);
