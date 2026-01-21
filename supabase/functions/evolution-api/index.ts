import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";

const app = new Hono().basePath("/evolution-api");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

// Normalize the API URL - remove trailing /manager if present
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

// Helper function to make requests to Evolution API
async function evolutionRequest(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>
) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  console.log(`[Evolution API] ${method} ${url}`);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": EVOLUTION_API_KEY!,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  // Check if response is JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error(`[Evolution API] Non-JSON response: ${text.substring(0, 200)}`);
    throw new Error(`Evolution API returned non-JSON response (status: ${response.status})`);
  }
  
  const data = await response.json();

  console.log(`[Evolution API] Response status: ${response.status}`);
  console.log(`[Evolution API] Response:`, JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(data.message || data.error || "Evolution API error");
  }

  return data;
}

// OPTIONS handler for CORS
app.options("*", (c) => {
  return new Response(null, { headers: corsHeaders });
});

// Create a new instance
app.post("/create-instance", async (c) => {
  try {
    const { instanceName } = await c.req.json();

    if (!instanceName) {
      return c.json({ error: "instanceName is required" }, 400, corsHeaders);
    }

    // Create instance with QR code enabled
    const result = await evolutionRequest("/instance/create", "POST", {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error creating instance:", error);
    const message = error instanceof Error ? error.message : "Failed to create instance";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Get QR Code for an instance
app.get("/connect/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(`/instance/connect/${instanceName}`);

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error getting QR code:", error);
    const message = error instanceof Error ? error.message : "Failed to get QR code";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Get connection state
app.get("/connection-state/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/connectionState/${instanceName}`
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error getting connection state:", error);
    const message = error instanceof Error ? error.message : "Failed to get connection state";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Fetch all instances
app.get("/fetch-instances", async (c) => {
  try {
    const result = await evolutionRequest("/instance/fetchInstances");

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error fetching instances:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch instances";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Delete an instance
app.delete("/delete/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/delete/${instanceName}`,
      "DELETE"
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error deleting instance:", error);
    const message = error instanceof Error ? error.message : "Failed to delete instance";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Logout from an instance
app.post("/logout/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/instance/logout/${instanceName}`,
      "DELETE"
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error logging out:", error);
    const message = error instanceof Error ? error.message : "Failed to logout";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Fetch all chats from an instance (filtered to today only)
app.post("/chats/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");

    const result = await evolutionRequest(
      `/chat/findChats/${instanceName}`,
      "POST",
      {}
    );

    // Get today's date at midnight UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);
    const todayISO = today.toISOString().split('T')[0]; // "2026-01-21"

    console.log(`[Evolution API] Filtering chats from today: ${todayISO} (timestamp >= ${todayTimestamp})`);
    console.log(`[Evolution API] Total chats from API: ${Array.isArray(result) ? result.length : 0}`);

    const filteredChats = Array.isArray(result) 
      ? result.filter((chat: any) => {
          // Check multiple timestamp sources
          const lastMsgTimestamp = chat.lastMessage?.messageTimestamp;
          const updatedAtStr = chat.updatedAt;
          const windowStart = chat.windowStart;
          
          // Check ISO date format (updatedAt or windowStart)
          if (updatedAtStr) {
            const chatDate = updatedAtStr.split('T')[0];
            if (chatDate === todayISO) {
              console.log(`[Evolution API] ✓ Chat ${chat.remoteJid}: updatedAt=${chatDate} matches today`);
              return true;
            }
          }
          
          if (windowStart) {
            const windowDate = windowStart.split('T')[0];
            if (windowDate === todayISO) {
              console.log(`[Evolution API] ✓ Chat ${chat.remoteJid}: windowStart=${windowDate} matches today`);
              return true;
            }
          }
          
          // Check Unix timestamp (lastMessage.messageTimestamp)
          if (lastMsgTimestamp) {
            // Handle timestamp in seconds or milliseconds
            const timestamp = lastMsgTimestamp > 9999999999 
              ? Math.floor(lastMsgTimestamp / 1000) 
              : lastMsgTimestamp;

            if (timestamp >= todayTimestamp) {
              console.log(`[Evolution API] ✓ Chat ${chat.remoteJid}: timestamp=${timestamp} >= ${todayTimestamp}`);
              return true;
            }
          }
          
          console.log(`[Evolution API] ✗ Chat ${chat.remoteJid}: no valid today timestamp (updatedAt=${updatedAtStr}, windowStart=${windowStart}, msgTs=${lastMsgTimestamp})`);
          return false;
        })
      : [];

    console.log(`[Evolution API] Filtered ${filteredChats.length} chats from today`);

    return c.json(filteredChats, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error fetching chats:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch chats";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Fetch messages from a chat
app.post("/messages/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    const { remoteJid, limit = 50 } = await c.req.json();

    if (!remoteJid) {
      return c.json({ error: "remoteJid is required" }, 400, corsHeaders);
    }

    const result = await evolutionRequest(
      `/chat/findMessages/${instanceName}`,
      "POST",
      {
        where: {
          key: {
            remoteJid,
          },
        },
        limit,
      }
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error fetching messages:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch messages";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Get media as base64 (download and decrypt)
app.post("/media/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    const { messageId, convertToMp4 = false } = await c.req.json();

    if (!messageId) {
      return c.json({ error: "messageId is required" }, 400, corsHeaders);
    }

    console.log(`[Evolution API] Downloading media for message: ${messageId}`);

    const result = await evolutionRequest(
      `/chat/getBase64FromMediaMessage/${instanceName}`,
      "POST",
      {
        message: {
          key: {
            id: messageId
          }
        },
        convertToMp4
      }
    );

    console.log(`[Evolution API] Media downloaded, base64 length: ${result?.base64?.length || 0}`);

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error downloading media:", error);
    const message = error instanceof Error ? error.message : "Failed to download media";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Send text message
app.post("/send-text/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    const { number, text } = await c.req.json();

    if (!number || !text) {
      return c.json({ error: "number and text are required" }, 400, corsHeaders);
    }

    console.log(`[Evolution API] Sending text to ${number}`);

    const result = await evolutionRequest(
      `/message/sendText/${instanceName}`,
      "POST",
      {
        number,
        text,
        delay: 0,
        linkPreview: true
      }
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error sending text:", error);
    const message = error instanceof Error ? error.message : "Failed to send message";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Send media message (image, video, document)
app.post("/send-media/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    const { number, mediatype, media, caption, fileName } = await c.req.json();

    if (!number || !media || !mediatype) {
      return c.json({ error: "number, mediatype, and media are required" }, 400, corsHeaders);
    }

    console.log(`[Evolution API] Sending ${mediatype} to ${number}`);

    const result = await evolutionRequest(
      `/message/sendMedia/${instanceName}`,
      "POST",
      {
        number,
        mediaMessage: {
          mediatype,
          caption: caption || "",
          media,
          fileName: fileName || undefined
        }
      }
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error sending media:", error);
    const message = error instanceof Error ? error.message : "Failed to send media";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

// Send audio message (PTT - Push to Talk)
app.post("/send-audio/:instanceName", async (c) => {
  try {
    const instanceName = c.req.param("instanceName");
    const { number, audio } = await c.req.json();

    if (!number || !audio) {
      return c.json({ error: "number and audio are required" }, 400, corsHeaders);
    }

    console.log(`[Evolution API] Sending audio to ${number}`);

    const result = await evolutionRequest(
      `/message/sendWhatsAppAudio/${instanceName}`,
      "POST",
      {
        number,
        audioMessage: {
          audio
        },
        options: {
          delay: 0,
          presence: "recording",
          encoding: true
        }
      }
    );

    return c.json(result, 200, corsHeaders);
  } catch (error) {
    console.error("[Evolution API] Error sending audio:", error);
    const message = error instanceof Error ? error.message : "Failed to send audio";
    return c.json(
      { error: message },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
