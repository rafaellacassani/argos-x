import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function jidToNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");
}

async function evolutionFetch(endpoint: string, method: string, body?: Record<string, unknown>) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[check-missed] Evolution API error ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const supabase = getSupabase();

    // 1. Get all active commercial instances
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, workspace_id")
      .neq("instance_type", "alerts");

    if (!instances || instances.length === 0) {
      console.log("[check-missed] No active instances found");
      return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    let totalProcessed = 0;

    for (const inst of instances) {
      const { instance_name: instanceName, workspace_id: workspaceId } = inst;

      // 2. Check if there's an active AI agent for this instance
      const { data: agents } = await supabase
        .from("ai_agents")
        .select("id, instance_name, respond_to, respond_to_stages")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      if (!agents || agents.length === 0) continue;

      const matchingAgent = agents.find((a: any) =>
        !a.instance_name || a.instance_name === "" || a.instance_name === instanceName
      );

      if (!matchingAgent) continue;

      // 3. Fetch recent chats with unread messages from Evolution API
      let chats: any[] = [];
      try {
        const chatData = await evolutionFetch(`/chat/findChats/${instanceName}`, "POST", {});
        if (Array.isArray(chatData)) {
          chats = chatData;
        }
      } catch (e) {
        console.error(`[check-missed] Error fetching chats for ${instanceName}:`, e);
        continue;
      }

      // Filter: only individual chats with unread messages, not groups
      const unreadChats = chats.filter((c: any) => {
        const jid = c.remoteJid || "";
        const unread = c.unreadCount || 0;
        const lastMsg = c.lastMessage;
        // Skip groups, status broadcasts
        if (jid.endsWith("@g.us") || jid === "status@broadcast") return false;
        // Must have unread messages
        if (unread <= 0) return false;
        // Last message must NOT be from us
        if (lastMsg?.key?.fromMe === true) return false;
        return true;
      });

      if (unreadChats.length === 0) continue;

      console.log(`[check-missed] ${instanceName}: Found ${unreadChats.length} unread chats`);

      // 4. For each unread chat, check if already processed
      for (const chat of unreadChats) {
        const remoteJid = chat.remoteJid || "";
        const lastMsg = chat.lastMessage;
        if (!lastMsg?.key?.id) continue;

        const msgId = lastMsg.key.id;
        const messageText = lastMsg.message?.conversation ||
          lastMsg.message?.extendedTextMessage?.text || "";
        const pushName = lastMsg.pushName || chat.pushName || "";

        // Resolve @lid to real number
        let resolvedJid = remoteJid;
        let phoneNumber = "";

        if (remoteJid.endsWith("@lid")) {
          const remoteJidAlt = lastMsg.key?.remoteJidAlt || "";
          if (remoteJidAlt && !remoteJidAlt.endsWith("@lid")) {
            resolvedJid = remoteJidAlt;
            phoneNumber = jidToNumber(remoteJidAlt);
          } else {
            // Try fetchProfile to resolve @lid
            try {
              const profileData = await evolutionFetch(`/chat/fetchProfile/${instanceName}`, "POST", {
                number: jidToNumber(remoteJid),
              });
              const resolvedNumber = profileData?.number || profileData?.wuid || profileData?.jid || "";
              const cleanNumber = resolvedNumber ? jidToNumber(String(resolvedNumber)) : "";
              if (cleanNumber && cleanNumber.length >= 10 && cleanNumber.length <= 15 && /^\d+$/.test(cleanNumber)) {
                resolvedJid = `${cleanNumber}@s.whatsapp.net`;
                phoneNumber = cleanNumber;
              } else {
                phoneNumber = jidToNumber(remoteJid);
              }
            } catch {
              phoneNumber = jidToNumber(remoteJid);
            }
          }
        } else {
          phoneNumber = jidToNumber(remoteJid);
        }

        // Check if this message was already processed via webhook
        const { data: existing } = await supabase
          .from("webhook_message_log")
          .select("id")
          .eq("message_id", msgId)
          .limit(1);

        if (existing && existing.length > 0) {
          // Already processed
          continue;
        }

        // Check if message has actual content (text or media)
        const hasMedia = !!(lastMsg.message?.imageMessage || lastMsg.message?.audioMessage ||
          lastMsg.message?.videoMessage || lastMsg.message?.documentMessage);

        if (!messageText && !hasMedia) continue;

        console.log(`[check-missed] 🔔 MISSED MESSAGE from ${pushName} (${remoteJid} → ${resolvedJid}): "${messageText?.substring(0, 80)}"`);

        // Persist inbound message to whatsapp_messages for Chat UI visibility
        try {
          await supabase.from("whatsapp_messages").insert({
            workspace_id: workspaceId,
            instance_name: instanceName,
            remote_jid: resolvedJid,
            from_me: false,
            direction: "inbound",
            content: messageText || (hasMedia ? "[Mídia recebida]" : ""),
            message_type: hasMedia ? "media" : "text",
            message_id: msgId,
            push_name: pushName || null,
            timestamp: new Date().toISOString(),
          });
        } catch (_persistErr) {
          // Ignore duplicate inserts
        }

        // 5. Log to webhook_message_log to prevent re-processing
        const { error: dupError } = await supabase
          .from("webhook_message_log")
          .insert({ message_id: msgId, session_id: resolvedJid, workspace_id: workspaceId });

        if (dupError) {
          console.log(`[check-missed] Dedup collision for ${msgId}, skipping`);
          continue;
        }

        // 6. Check agent respond_to filter
        let shouldRespond = true;
        let leadId: string | null = null;

        const leadOrFilters = [`whatsapp_jid.eq.${remoteJid}`];
        if (resolvedJid !== remoteJid) leadOrFilters.push(`whatsapp_jid.eq.${resolvedJid}`);
        if (phoneNumber.length >= 10 && phoneNumber.length <= 15) {
          leadOrFilters.push(`phone.like.%${phoneNumber.slice(-10)}`);
        }

        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, stage_id")
          .eq("workspace_id", workspaceId)
          .or(leadOrFilters.join(","))
          .limit(1)
          .single();

        leadId = existingLead?.id || null;

        if (matchingAgent.respond_to === "specific_stages" && existingLead) {
          const stages = matchingAgent.respond_to_stages || [];
          if (stages.length > 0 && !stages.includes(existingLead.stage_id)) {
            shouldRespond = false;
          }
        }

        if (!shouldRespond) continue;

        // 7. Cancel pending follow-ups
        try {
          await supabase.from("agent_followup_queue")
            .update({ status: "canceled", canceled_reason: "lead_responded" })
            .eq("session_id", resolvedJid)
            .eq("status", "pending");
        } catch (_) { /* ignore */ }

        // 8. Call ai-agent-chat
        try {
          const mediaType = lastMsg.message?.imageMessage ? "image" :
            lastMsg.message?.audioMessage ? "audio" :
            lastMsg.message?.videoMessage ? "video" : null;

          const mediaCaption = lastMsg.message?.imageMessage?.caption ||
            lastMsg.message?.videoMessage?.caption || null;

          const agentMessage = messageText || mediaCaption ||
            (mediaType ? `[${mediaType === "image" ? "Imagem" : mediaType === "audio" ? "Áudio" : "Mídia"} enviada pelo lead]` : "");

          const agentUrl = `${SUPABASE_URL}/functions/v1/ai-agent-chat`;
          const agentRes = await fetch(agentUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              agent_id: matchingAgent.id,
              session_id: resolvedJid,
              message: agentMessage,
              lead_id: leadId,
              message_id: msgId,
              phone_number: phoneNumber,
              instance_name: instanceName,
              _internal_webhook: true,
              media_type: mediaType,
            }),
          });

          const agentData = await agentRes.json();
          console.log(`[check-missed] Agent response: status=${agentRes.status}, chunks=${agentData.chunks?.length || 0}, skipped=${agentData.skipped || false}`);

          // Send response
          const sendToNumber = (phoneNumber.length >= 10 && phoneNumber.length <= 15 && /^\d+$/.test(phoneNumber))
            ? phoneNumber : remoteJid;

          if (agentData.chunks && Array.isArray(agentData.chunks)) {
            for (const chunk of agentData.chunks) {
              if (chunk && chunk.trim()) {
                let sendResult = await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                  number: sendToNumber,
                  text: chunk,
                  delay: 0,
                  linkPreview: false,
                });
                // Fallback with original JID
                if (!sendResult && sendToNumber !== remoteJid) {
                  sendResult = await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                    number: remoteJid,
                    text: chunk,
                    delay: 0,
                    linkPreview: false,
                  });
                }
                if (agentData.chunks.length > 1) {
                  await new Promise((r) => setTimeout(r, 1000));
                }
              }
            }
            console.log(`[check-missed] ✅ Response sent to ${sendToNumber}`);
          } else if (agentData.response) {
            let sendResult = await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
              number: sendToNumber,
              text: agentData.response,
              delay: 0,
              linkPreview: false,
            });
            if (!sendResult && sendToNumber !== remoteJid) {
              await evolutionFetch(`/message/sendText/${instanceName}`, "POST", {
                number: remoteJid,
                text: agentData.response,
                delay: 0,
                linkPreview: false,
              });
            }
          }

          totalProcessed++;
        } catch (agentErr) {
          console.error(`[check-missed] ❌ Agent call error for ${remoteJid}:`, agentErr);
        }
      }
    }

    console.log(`[check-missed] ✅ Done. Processed ${totalProcessed} missed messages.`);
    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[check-missed] ❌ Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
