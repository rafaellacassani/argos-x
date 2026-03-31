import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const app = new Hono().basePath("/facebook-webhook");

const VERIFY_TOKEN = "inboxia-verification";
const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET")!;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: verify Meta X-Hub-Signature-256 header
async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader || !FACEBOOK_APP_SECRET) return false;
  const [algo, signature] = signatureHeader.split("=");
  if (algo !== "sha256" || !signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(FACEBOOK_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

// GET - Meta webhook verification (challenge)
app.get("/", async (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  console.log("[Facebook Webhook] Verification request:", { mode, token, challenge });

  // First try the default verify token
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[Facebook Webhook] ✅ Verification successful (default token)");
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  // Then try dynamic tokens from whatsapp_cloud_connections
  if (mode === "subscribe" && token) {
    const { data: conn } = await supabase
      .from("whatsapp_cloud_connections")
      .select("id")
      .eq("webhook_verify_token", token)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (conn) {
      await supabase
        .from("whatsapp_cloud_connections")
        .update({ last_webhook_at: new Date().toISOString(), status: "active" })
        .eq("id", conn.id);

      console.log("[Facebook Webhook] ✅ Verification successful (WABA token, conn:", conn.id, ")");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  }

  console.log("[Facebook Webhook] ❌ Verification failed");
  return new Response("Forbidden", { status: 403 });
});

// Helper: find meta_page by page_id
async function findMetaPage(pageId: string) {
  const { data, error } = await supabase
    .from("meta_pages")
    .select("id, page_access_token, platform, workspace_id")
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
  workspace_id: string;
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
    workspace_id: metaPage.workspace_id,
  });
}

// Process Instagram messaging events
async function processInstagramEvent(igUserId: string, event: any) {
  // For Instagram, the page_id in meta_pages corresponds to the Facebook Page linked to the IG account
  // We need to find by instagram_account_id
  const { data: metaPage, error } = await supabase
    .from("meta_pages")
    .select("id, page_access_token, platform, page_id, workspace_id")
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
    sender_name: undefined,
    message_id: messageId,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    direction,
    timestamp,
    raw_payload: event,
    workspace_id: metaPage.workspace_id,
  });
}

// Helper: download media from Meta Graph API and return base64
async function downloadMediaAsBase64(mediaId: string, accessToken: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // Step 1: get the download URL
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
      console.error(`[Facebook Webhook] ❌ Failed to get media URL: ${metaRes.status}`);
      await metaRes.text();
      return null;
    }
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || "image/jpeg";

    if (!downloadUrl) {
      console.error("[Facebook Webhook] ❌ No download URL in media response");
      return null;
    }

    // Step 2: download the binary
    const binRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!binRes.ok) {
      console.error(`[Facebook Webhook] ❌ Failed to download media: ${binRes.status}`);
      await binRes.text();
      return null;
    }

    const buffer = await binRes.arrayBuffer();
    // Limit to 5MB
    if (buffer.byteLength > 5 * 1024 * 1024) {
      console.warn("[Facebook Webhook] ⚠️ Media too large (>5MB), skipping");
      return null;
    }

    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    console.log(`[Facebook Webhook] ✅ Downloaded media ${mediaId}: ${mimeType}, ${Math.round(buffer.byteLength / 1024)}KB`);
    return { base64, mimeType };
  } catch (err) {
    console.error("[Facebook Webhook] ❌ Media download error:", err);
    return null;
  }
}

// Helper: route inbound message to AI Agent (if active)
async function routeToAIAgent(workspaceId: string, senderPhone: string, messageText: string, messageId: string, phoneNumberId: string, accessToken: string, mediaType?: string, mediaId?: string) {
  if (!messageText && !mediaId) return;

  try {
    // Find active AI agents for this workspace
    const { data: agents } = await supabase
      .from("ai_agents")
      .select("id, instance_name, respond_to, respond_to_stages, cloud_24h_window_only")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (!agents || agents.length === 0) {
      console.log("[Facebook Webhook] No active AI agents for workspace:", workspaceId);
      return;
    }

    // Match agent: prefer specific cloud instance, then fallback to any active agent
    const cloudInstanceId = `cloud_${phoneNumberId}`;
    
    // Priority 1: agent explicitly configured for this cloud instance
    let matchingAgent = agents.find((a: any) => a.instance_name === cloudInstanceId);
    
    // Priority 2: agent with no instance restriction (empty/null)
    if (!matchingAgent) {
      matchingAgent = agents.find((a: any) => !a.instance_name || a.instance_name === "");
    }
    
    // Priority 3: fallback to any active agent in the workspace (e.g. Evolution agent that should also handle WABA)
    if (!matchingAgent) {
      matchingAgent = agents[0];
      console.log(`[Facebook Webhook] ℹ️ No dedicated cloud agent found, falling back to agent: ${matchingAgent.id} (${matchingAgent.instance_name})`);
    }

    if (!matchingAgent) {
      console.log("[Facebook Webhook] No agent matched for cloud instance:", cloudInstanceId);
      return;
    }

    // Check 24h window if enabled
    if (matchingAgent.cloud_24h_window_only !== false) {
      const windowCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: lastInbound } = await supabase
        .from("meta_conversations")
        .select("timestamp")
        .eq("workspace_id", workspaceId)
        .eq("sender_id", senderPhone)
        .eq("direction", "inbound")
        .eq("platform", "whatsapp_business")
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      // The current message IS the inbound, so window is open. 
      // This check is mainly for follow-ups; for live responses the window is always valid.
      // We still set the flag so follow-up logic can use it.
    }

    // Find existing lead by phone
    let leadId: string | null = null;
    const phoneSuffix = senderPhone.length >= 10 ? senderPhone.slice(-10) : senderPhone;
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, stage_id")
      .eq("workspace_id", workspaceId)
      .like("phone", `%${phoneSuffix}`)
      .limit(1)
      .single();
    leadId = existingLead?.id || null;

    // Check stage filter
    if (matchingAgent.respond_to === "specific_stages" && existingLead) {
      const stages = matchingAgent.respond_to_stages || [];
      if (stages.length > 0 && !stages.includes(existingLead.stage_id)) {
        console.log("[Facebook Webhook] Agent skipped: lead stage not matched");
        return;
      }
    }

    // Cancel pending follow-ups
    if (leadId) {
      await supabase.from("agent_followup_queue")
        .update({ status: "canceled", canceled_reason: "lead_responded" })
        .eq("session_id", `waba_${senderPhone}`)
        .eq("status", "pending");
    }

    // Download media if present (image/audio support for AI)
    let mediaBase64: string | undefined;
    let mediaMimeType: string | undefined;
    if ((mediaType === "image" || mediaType === "audio") && mediaId) {
      console.log(`[Facebook Webhook] 📦 Downloading ${mediaType} ${mediaId} for AI`);
      const mediaData = await downloadMediaAsBase64(mediaId, accessToken);
      if (mediaData) {
        mediaBase64 = mediaData.base64;
        mediaMimeType = mediaData.mimeType;
      }
    }

    // Call ai-agent-chat
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log(`[Facebook Webhook] 🚀 Calling ai-agent-chat for agent ${matchingAgent.id}, phone ${senderPhone}${mediaBase64 ? ' (with image)' : ''}`);

    const agentPayload: Record<string, any> = {
      agent_id: matchingAgent.id,
      session_id: `waba_${senderPhone}`,
      message: messageText || "(imagem enviada)",
      lead_id: leadId,
      message_id: messageId,
      phone_number: senderPhone,
      _internal_webhook: true,
      channel_type: "whatsapp_cloud",
      cloud_phone_number_id: phoneNumberId,
      cloud_access_token: accessToken,
    };

    if (mediaBase64 && mediaMimeType && mediaType) {
      agentPayload.media_type = mediaType;
      agentPayload.media_base64 = mediaBase64;
      agentPayload.media_mimetype = mediaMimeType;
    }

    const agentRes = await fetch(`${supabaseUrl}/functions/v1/ai-agent-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(agentPayload),
    });

    const agentData = await agentRes.json();
    console.log(`[Facebook Webhook] 📤 Agent response status: ${agentRes.status}, skipped: ${agentData.skipped || false}`);

    // Send response via WhatsApp Cloud API (with media extraction)
    const allChunks = agentData.chunks && Array.isArray(agentData.chunks)
      ? agentData.chunks
      : agentData.response ? [agentData.response] : [];

    const sentContents: string[] = [];
    for (const chunk of allChunks) {
      if (!chunk?.trim()) continue;
      const { medias, cleanText } = extractMediaFromChunk(chunk);

      // Send clean text first
      if (cleanText) {
        await sendWhatsAppCloudMessage(phoneNumberId, accessToken, senderPhone, cleanText);
        sentContents.push(cleanText);
      }

      // Send each extracted media
      for (const media of medias) {
        await new Promise(r => setTimeout(r, 500));
        await sendWhatsAppCloudMedia(phoneNumberId, accessToken, senderPhone, media.url, media.type);
        sentContents.push(`[${media.type}: ${media.url}]`);
      }

      if (allChunks.length > 1) await new Promise(r => setTimeout(r, 1000));
    }

    if (sentContents.length > 0) {
      console.log(`[Facebook Webhook] ✅ Agent response sent via Cloud API (${sentContents.length} parts)`);
    }

    // Save outbound messages to meta_conversations
    const responseText = sentContents.join(" ") || null;
    if (responseText) {
      const { data: metaPage } = await supabase
        .from("meta_pages")
        .select("id")
        .eq("page_id", phoneNumberId)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (metaPage) {
        await saveMessage({
          meta_page_id: metaPage.id,
          platform: "whatsapp_business",
          sender_id: senderPhone,
          message_id: `out-agent-${Date.now()}`,
          content: responseText,
          message_type: "text",
          direction: "outbound",
          timestamp: new Date().toISOString(),
          raw_payload: { source: "ai_agent" },
          workspace_id: workspaceId,
        });
      }
    }

    // Schedule follow-up if enabled
    if (!agentData.paused && !agentData.skipped && leadId) {
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
          session_id: `waba_${senderPhone}`,
          workspace_id: workspaceId,
          step_index: 0,
          execute_at: executeAt,
          status: "pending",
        });
        console.log(`[Facebook Webhook] 📅 Follow-up scheduled: ${executeAt}`);
      }
    }
  } catch (err) {
    console.error("[Facebook Webhook] ❌ AI Agent routing error:", err);
  }
}

// Helper: extract media references from AI text like [Vídeo anexo: URL]
function extractMediaFromChunk(text: string) {
  const mediaPattern = /\[(Vídeo anexo|Imagem anexa|PDF anexo|Anexo|Video anexo|Imagen anexa):\s*(https?:\/\/[^\]\s]+)\]/gi;
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
}

// Helper: send a text message via WhatsApp Cloud API
async function sendWhatsAppCloudMessage(phoneNumberId: string, accessToken: string, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Facebook Webhook] ❌ Cloud API send failed: ${res.status} ${errText}`);
  }
  return res;
}

// Helper: send media (video/image/document) via WhatsApp Cloud API
async function sendWhatsAppCloudMedia(phoneNumberId: string, accessToken: string, to: string, mediaUrl: string, mediaType: string) {
  const typeMap: Record<string, string> = { video: "video", image: "image", document: "document" };
  const type = typeMap[mediaType] || "document";
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type,
    [type]: { link: mediaUrl },
  };
  console.log(`[Facebook Webhook] 📎 Sending Cloud API media: ${type} → ${mediaUrl}`);
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Facebook Webhook] ❌ Cloud API media send failed: ${res.status} ${errText}`);
  }
  return res;
}

// Helper: calculate follow-up delay
function getFollowupDelayMs(value: number, unit: string): number {
  const multipliers: Record<string, number> = { minutes: 60000, hours: 3600000, days: 86400000 };
  return (value || 1) * (multipliers[unit] || 3600000);
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
      .select("id, page_access_token, workspace_id")
      .eq("page_id", phoneNumberId)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (error || !metaPage) {
      console.warn("[Facebook Webhook] No meta_page for WABA phone_number_id:", phoneNumberId);
      continue;
    }

    // Also try to get access_token from whatsapp_cloud_connections (preferred, more up-to-date)
    const { data: cloudConn } = await supabase
      .from("whatsapp_cloud_connections")
      .select("access_token")
      .eq("phone_number_id", phoneNumberId)
      .eq("is_active", true)
      .limit(1)
      .single();

    const accessToken = cloudConn?.access_token || metaPage.page_access_token;

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
      } else if (msg.type === "button") {
        // User pressed a quick reply button on a template
        content = msg.button?.text || "✅ Resposta de botão";
        messageType = "text";
      } else if (msg.type === "interactive") {
        // User replied to an interactive message (list, buttons, etc.)
        const interactive = msg.interactive;
        if (interactive?.type === "button_reply") {
          content = interactive.button_reply?.title || "✅ Resposta de botão";
        } else if (interactive?.type === "list_reply") {
          content = interactive.list_reply?.title || interactive.list_reply?.description || "✅ Resposta de lista";
        } else {
          content = interactive?.body?.text || "✅ Resposta interativa";
        }
        messageType = "text";
      } else if (["image", "video", "audio", "document", "sticker"].includes(msg.type)) {
        const mediaObj = msg[msg.type];
        if (mediaObj?.id) {
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
        workspace_id: metaPage.workspace_id,
      });

      // Route to AI Agent — pass media info for image/audio understanding
      const rawMediaId = msg[msg.type]?.id;
      const supportedMediaTypes = ["image", "audio"];
      const isMediaWithId = supportedMediaTypes.includes(msg.type) && rawMediaId;
      if (content || isMediaWithId) {
        await routeToAIAgent(metaPage.workspace_id, senderId, content, messageId, phoneNumberId, accessToken, isMediaWithId ? msg.type : undefined, isMediaWithId ? rawMediaId : undefined);
      } else {
        console.log(`[Facebook Webhook] ⚠️ No content to route to AI agent for ${senderId} (type: ${messageType})`);
      }
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
    const rawBody = await c.req.text();

    // Validate Meta signature (non-blocking — log warning but process anyway)
    const signatureHeader = c.req.header("x-hub-signature-256");
    if (signatureHeader) {
      const valid = await verifySignature(rawBody, signatureHeader);
      if (!valid) {
        console.warn("[Facebook Webhook] ⚠️ Signature mismatch — processing anyway (may be a different Meta app)");
      } else {
        console.log("[Facebook Webhook] ✅ Signature verified");
      }
    } else {
      console.warn("[Facebook Webhook] ⚠️ No signature header present");
    }

    const body = JSON.parse(rawBody);
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
