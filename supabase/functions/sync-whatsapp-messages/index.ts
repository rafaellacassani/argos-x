import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;

async function evolutionFetch(endpoint: string, method: string, body?: Record<string, unknown>) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[sync-whatsapp-messages] Evolution API error ${res.status}: ${text.substring(0, 300)}`);
    return null;
  }
  return res.json();
}

function extractContent(msg: any): { content: string; messageType: string } {
  const m = msg.message;
  if (!m) return { content: "", messageType: "text" };
  if (m.conversation) return { content: m.conversation, messageType: "text" };
  if (m.extendedTextMessage?.text) return { content: m.extendedTextMessage.text, messageType: "text" };
  if (m.imageMessage) return { content: m.imageMessage.caption || "📷 Imagem", messageType: "image" };
  if (m.videoMessage) return { content: m.videoMessage.caption || "🎥 Vídeo", messageType: "video" };
  if (m.audioMessage) return { content: "🎵 Áudio", messageType: "audio" };
  if (m.documentMessage) return { content: m.documentMessage.fileName || "📎 Documento", messageType: "document" };
  if (m.stickerMessage) return { content: "🏷️ Figurinha", messageType: "text" };
  if (m.locationMessage) return { content: "📍 Localização", messageType: "text" };
  if (m.contactMessage) return { content: "👤 Contato", messageType: "text" };
  return { content: "Mensagem", messageType: "text" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { instanceName, workspaceId } = await req.json();
    if (!instanceName || !workspaceId) {
      return new Response(JSON.stringify({ error: "instanceName and workspaceId required" }), { status: 400, headers: corsHeaders });
    }

    console.log(`[sync-whatsapp-messages] Starting sync for instance: ${instanceName}, workspace: ${workspaceId}`);

    // Use service role for DB writes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch all chats from Evolution API
    const chats = await evolutionFetch(`/chat/findChats/${instanceName}`, "POST", {});
    if (!Array.isArray(chats) || chats.length === 0) {
      console.log("[sync-whatsapp-messages] No chats found from Evolution API");
      return new Response(JSON.stringify({ synced: 0, chats: 0 }), { headers: corsHeaders });
    }

    // Filter out group chats
    const individualChats = chats.filter((c: any) => {
      const jid = c.remoteJid || c.id || "";
      return !jid.endsWith("@g.us");
    });

    console.log(`[sync-whatsapp-messages] Found ${individualChats.length} individual chats`);

    let totalSynced = 0;
    const BATCH_SIZE = 10; // Process 10 chats at a time

    for (let i = 0; i < individualChats.length; i += BATCH_SIZE) {
      const batch = individualChats.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (chat: any) => {
        const remoteJid = chat.remoteJid || chat.id;
        if (!remoteJid) return;

        try {
          // Fetch messages for this chat (up to 100)
          const result = await evolutionFetch(`/chat/findMessages/${instanceName}`, "POST", {
            where: { key: { remoteJid } },
            limit: 100,
          });

          let messages: any[] = [];
          if (result?.messages?.records && Array.isArray(result.messages.records)) {
            messages = result.messages.records;
          } else if (Array.isArray(result?.messages)) {
            messages = result.messages;
          } else if (Array.isArray(result)) {
            messages = result;
          }

          if (messages.length === 0) return;

          // Build rows for upsert
          const rows = messages
            .filter((msg: any) => msg.key?.id)
            .map((msg: any) => {
              const { content, messageType } = extractContent(msg);
              const ts = msg.messageTimestamp
                ? new Date(msg.messageTimestamp * 1000).toISOString()
                : new Date().toISOString();
              return {
                workspace_id: workspaceId,
                instance_name: instanceName,
                remote_jid: remoteJid,
                from_me: msg.key?.fromMe || false,
                direction: msg.key?.fromMe ? "outbound" : "inbound",
                content: content || "",
                message_type: messageType,
                timestamp: ts,
                message_id: msg.key.id,
                push_name: msg.pushName || null,
              };
            });

          if (rows.length === 0) return;

          // Upsert in chunks of 50
          for (let j = 0; j < rows.length; j += 50) {
            const chunk = rows.slice(j, j + 50);
            const { error: upsertError } = await supabase
              .from("whatsapp_messages")
              .upsert(chunk, { onConflict: "message_id", ignoreDuplicates: true });

            if (upsertError) {
              // message_id might not have unique constraint, try insert with ignore
              console.warn(`[sync-whatsapp-messages] Upsert error for ${remoteJid}, trying insert:`, upsertError.message);
              // Fall back to inserting one by one, skipping duplicates
              for (const row of chunk) {
                await supabase.from("whatsapp_messages").insert(row).then(() => {});
              }
            }
            totalSynced += chunk.length;
          }
        } catch (err) {
          console.error(`[sync-whatsapp-messages] Error syncing ${remoteJid}:`, err);
        }
      }));

      // Small delay between batches
      if (i + BATCH_SIZE < individualChats.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`[sync-whatsapp-messages] ✅ Sync complete: ${totalSynced} messages from ${individualChats.length} chats`);

    return new Response(
      JSON.stringify({ synced: totalSynced, chats: individualChats.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-whatsapp-messages] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
