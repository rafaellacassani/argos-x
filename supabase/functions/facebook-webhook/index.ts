import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const app = new Hono().basePath("/facebook-webhook");

const VERIFY_TOKEN = "inboxia-verification";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - Meta webhook verification (challenge)
app.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  console.log("[Facebook Webhook] Verification request:", { mode, token, challenge });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Facebook Webhook] ✅ Verification successful");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  console.log("[Facebook Webhook] ❌ Verification failed");
  return new Response("Forbidden", { status: 403 });
});

// Helper: find meta_page by page_id
async function findMetaPage(pageId: string) {
  const { data, error } = await supabase
    .from("meta_pages")
    .select("id, page_access_token, platform")
    .eq("page_id", pageId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) {
    console.error("[Facebook Webhook] Error finding meta_page for", pageId, error);
    return null;
  }
  return data;
}

// Helper: save a message to meta_conversations (with dedup)
async function saveMessage(msg: {
  meta_page_id: string;
  platform: string;
  sender_id: string;
  sender_name?: string;
  message_id: string;
  content?: string;
  message_type: string;
  media_url?: string;
  direction: string;
  timestamp: string;
  raw_payload: any;
}) {
  const { error } = await supabase
    .from("meta_conversations")
    .upsert(msg, { onConflict: "message_id", ignoreDuplicates: true });

  if (error) {
    console.error("[Facebook Webhook] Error saving message:", error);
  } else {
    console.log(`[Facebook Webhook] ✅ Saved ${msg.direction} message ${msg.message_id} from ${msg.platform}`);
  }
}

// Helper: get sender profile name via Graph API
async function getSenderName(senderId: string, pageAccessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=name&access_token=${pageAccessToken}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.name;
    }
  } catch (e) {
    console.warn("[Facebook Webhook] Could not fetch sender name:", e);
  }
  return undefined;
}

// Process Facebook Messenger messages
async function processMessengerEvent(pageId: string, event: any) {
  const metaPage = await findMetaPage(pageId);
  if (!metaPage) {
    console.warn("[Facebook Webhook] No active meta_page for page_id:", pageId);
    return;
  }

  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  if (!senderId) return;

  // Determine direction
  const direction = senderId === pageId ? "outbound" : "inbound";
  const contactId = direction === "inbound" ? senderId : recipientId;

  // Get sender name for inbound messages
  let senderName: string | undefined;
  if (direction === "inbound") {
    senderName = await getSenderName(senderId, metaPage.page_access_token);
  }

  const messageData = event.message;
  if (!messageData) return; // skip delivery/read events

  const messageId = messageData.mid;
  let content = messageData.text || "";
  let messageType = "text";
  let mediaUrl: string | undefined;

  // Handle attachments
  if (messageData.attachments && messageData.attachments.length > 0) {
    const attachment = messageData.attachments[0];
    const aType = attachment.type;
    if (aType === "image") { messageType = "image"; mediaUrl = attachment.payload?.url; }
    else if (aType === "video") { messageType = "video"; mediaUrl = attachment.payload?.url; }
    else if (aType === "audio") { messageType = "audio"; mediaUrl = attachment.payload?.url; }
    else if (aType === "file") { messageType = "document"; mediaUrl = attachment.payload?.url; }
    else if (aType === "sticker") { messageType = "sticker"; mediaUrl = attachment.payload?.url; }
    if (!content && attachment.payload?.url) content = "";
  }

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toISOString()
    : new Date().toISOString();

  await saveMessage({
    meta_page_id: metaPage.id,
    platform: "facebook",
    sender_id: contactId || senderId,
    sender_name: senderName,
    message_id: messageId,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    direction,
    timestamp,
    raw_payload: event,
  });
}

// Process Instagram messaging events
async function processInstagramEvent(igUserId: string, event: any) {
  // For Instagram, the page_id in meta_pages corresponds to the Facebook Page linked to the IG account
  // We need to find by instagram_account_id
  const { data: metaPage, error } = await supabase
    .from("meta_pages")
    .select("id, page_access_token, platform, page_id")
    .or(`instagram_account_id.eq.${igUserId},page_id.eq.${igUserId}`)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !metaPage) {
    console.warn("[Facebook Webhook] No active meta_page for IG user:", igUserId);
    return;
  }

  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  if (!senderId) return;

  const direction = senderId === igUserId ? "outbound" : "inbound";
  const contactId = direction === "inbound" ? senderId : recipientId;

  const messageData = event.message;
  if (!messageData) return;

  const messageId = messageData.mid;
  let content = messageData.text || "";
  let messageType = "text";
  let mediaUrl: string | undefined;

  if (messageData.attachments && messageData.attachments.length > 0) {
    const attachment = messageData.attachments[0];
    const aType = attachment.type;
    if (aType === "image") { messageType = "image"; mediaUrl = attachment.payload?.url; }
    else if (aType === "video") { messageType = "video"; mediaUrl = attachment.payload?.url; }
    else if (aType === "audio") { messageType = "audio"; mediaUrl = attachment.payload?.url; }
    else if (aType === "share") { messageType = "text"; content = attachment.payload?.url || "Shared content"; }
  }

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toISOString()
    : new Date().toISOString();

  await saveMessage({
    meta_page_id: metaPage.id,
    platform: "instagram",
    sender_id: contactId || senderId,
    sender_name: undefined, // IG doesn't easily expose names via webhook
    message_id: messageId,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    direction,
    timestamp,
    raw_payload: event,
  });
}

// Process WhatsApp Business API messages
async function processWhatsAppBusinessEvent(entry: any) {
  const changes = entry.changes || [];
  for (const change of changes) {
    if (change.field !== "messages") continue;
    const value = change.value;
    if (!value) continue;

    const phoneNumberId = value.metadata?.phone_number_id;
    const displayPhone = value.metadata?.display_phone_number;

    // Find meta_page by phone_number_id stored in page_id field
    const { data: metaPage, error } = await supabase
      .from("meta_pages")
      .select("id, page_access_token")
      .eq("page_id", phoneNumberId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error || !metaPage) {
      console.warn("[Facebook Webhook] No meta_page for WABA phone_number_id:", phoneNumberId);
      continue;
    }

    // Process incoming messages
    const messages = value.messages || [];
    for (const msg of messages) {
      const senderId = msg.from; // phone number
      const messageId = msg.id;
      let content = "";
      let messageType = msg.type || "text";
      let mediaUrl: string | undefined;

      if (msg.type === "text") {
        content = msg.text?.body || "";
      } else if (["image", "video", "audio", "document", "sticker"].includes(msg.type)) {
        const mediaObj = msg[msg.type];
        if (mediaObj?.id) {
          // We could download media via Graph API, but for now store the media ID
          mediaUrl = `whatsapp-media://${mediaObj.id}`;
          content = mediaObj.caption || "";
        }
      }

      const senderName = value.contacts?.[0]?.profile?.name;
      const timestamp = msg.timestamp
        ? new Date(parseInt(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString();

      await saveMessage({
        meta_page_id: metaPage.id,
        platform: "whatsapp_business",
        sender_id: senderId,
        sender_name: senderName,
        message_id: messageId,
        content,
        message_type: messageType,
        media_url: mediaUrl,
        direction: "inbound",
        timestamp,
        raw_payload: msg,
      });
    }

    // Process status updates (delivery, read)
    const statuses = value.statuses || [];
    for (const status of statuses) {
      console.log(`[Facebook Webhook] WABA status update: ${status.status} for ${status.id}`);
    }
  }
}

// POST - Receive real-time events
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    console.log("[Facebook Webhook] 📩 Event received:", JSON.stringify(body).substring(0, 500));

    const object = body.object;
    const entries = body.entry || [];

    for (const entry of entries) {
      if (object === "page") {
        // Facebook Messenger events
        const pageId = entry.id;
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          await processMessengerEvent(pageId, event);
        }
        // Also handle standby (for handover protocol)
        const standby = entry.standby || [];
        for (const event of standby) {
          await processMessengerEvent(pageId, event);
        }
      } else if (object === "instagram") {
        // Instagram DM events
        const igUserId = entry.id;
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          await processInstagramEvent(igUserId, event);
        }
      } else if (object === "whatsapp_business_account") {
        // WhatsApp Business API events
        await processWhatsAppBusinessEvent(entry);
      }
    }

    return c.json({ status: "received" }, 200);
  } catch (error) {
    console.error("[Facebook Webhook] ❌ Error processing event:", error);
    return c.json({ status: "error" }, 200);
  }
});

// OPTIONS - CORS preflight
app.options("*", (c) => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});

Deno.serve(app.fetch);
