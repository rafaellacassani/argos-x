import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const app = new Hono().basePath("/reprocess-missed-leads");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const rawApiUrl = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_URL = rawApiUrl.replace(/\/manager\/?$/, "");

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function evolutionFetch(endpoint: string, method: string, body?: Record<string, unknown>) {
  const url = `${EVOLUTION_API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY };
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[reprocess] Evolution API error ${res.status}: ${text}`);
    return null;
  }
  return res.json();
}

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// POST - Reprocess leads that received inbound messages but got no AI response
app.post("/", async (c) => {
  try {
    const authHeader = c.req.header("authorization");
    if (!authHeader?.includes(SUPABASE_SERVICE_KEY)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { workspace_id, hours_back = 24, dry_run = false } = body;

    const supabase = getSupabase();

    // Find all active AI agents
    const agentFilter = workspace_id
      ? supabase.from("ai_agents").select("id, instance_name, workspace_id, name").eq("is_active", true).eq("workspace_id", workspace_id)
      : supabase.from("ai_agents").select("id, instance_name, workspace_id, name").eq("is_active", true);

    const { data: agents } = await agentFilter;
    if (!agents || agents.length === 0) {
      return c.json({ message: "No active agents found", reprocessed: 0 }, 200);
    }

    console.log(`[reprocess] Found ${agents.length} active agents`);

    const cutoff = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();
    let totalReprocessed = 0;
    const results: any[] = [];

    for (const agent of agents) {
      // Get all memories for this agent updated recently
      const { data: memories } = await supabase
        .from("agent_memories")
        .select("id, session_id, messages, lead_id, is_paused, updated_at")
        .eq("agent_id", agent.id)
        .eq("is_paused", false)
        .gte("updated_at", cutoff);

      if (!memories || memories.length === 0) continue;

      for (const mem of memories) {
        const messages = Array.isArray(mem.messages) ? mem.messages : [];
        if (messages.length === 0) continue;

        // Check if the last message was from the user (no AI response)
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role !== "user") continue; // AI already responded

        // This lead got a message but no AI response — needs reprocessing
        const sessionId = mem.session_id;
        const lastUserMessage = lastMsg.content;

        console.log(`[reprocess] 🔄 Session ${sessionId} has unanswered message: "${lastUserMessage?.substring(0, 50)}"`);

        if (dry_run) {
          results.push({ session_id: sessionId, lead_id: mem.lead_id, last_message: lastUserMessage?.substring(0, 80), agent: agent.name });
          totalReprocessed++;
          continue;
        }

        // Call ai-agent-chat to generate response
        try {
          const agentRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent-chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              agent_id: agent.id,
              session_id: sessionId,
              message: lastUserMessage,
              lead_id: mem.lead_id,
              _internal_webhook: true,
              instance_name: agent.instance_name,
            }),
          });

          const agentData = await agentRes.json();

          if (agentData.skipped) {
            console.log(`[reprocess] ⏭️ Skipped ${sessionId}: ${agentData.reason}`);
            results.push({ session_id: sessionId, status: "skipped", reason: agentData.reason });
            continue;
          }

          if (agentData.error) {
            console.error(`[reprocess] ❌ Error for ${sessionId}: ${agentData.error}`);
            results.push({ session_id: sessionId, status: "error", error: agentData.error });
            continue;
          }

          // Send response via Evolution API
          const responseText = agentData.response || (agentData.chunks ? agentData.chunks.join("\n\n") : null);
          if (responseText && agent.instance_name) {
            // Extract phone from session_id
            const phone = sessionId.replace(/@s\.whatsapp\.net$|@lid$/i, "");

            if (agentData.chunks && Array.isArray(agentData.chunks)) {
              for (const chunk of agentData.chunks) {
                if (!chunk?.trim()) continue;
                const sendResult = await evolutionFetch(`/message/sendText/${agent.instance_name}`, "POST", {
                  number: phone,
                  text: chunk,
                  delay: 0,
                  linkPreview: false,
                });
                if (sendResult) {
                  await supabase.from("whatsapp_messages").insert({
                    workspace_id: agent.workspace_id,
                    instance_name: agent.instance_name,
                    remote_jid: sessionId,
                    from_me: true,
                    direction: "outbound",
                    content: chunk,
                    message_type: "text",
                    push_name: "IA",
                    message_id: `out-reprocess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    timestamp: new Date().toISOString(),
                  });
                }
                if (agentData.chunks.length > 1) await new Promise(r => setTimeout(r, 1500));
              }
            } else {
              const sendResult = await evolutionFetch(`/message/sendText/${agent.instance_name}`, "POST", {
                number: phone,
                text: responseText,
                delay: 0,
                linkPreview: false,
              });
              if (sendResult) {
                await supabase.from("whatsapp_messages").insert({
                  workspace_id: agent.workspace_id,
                  instance_name: agent.instance_name,
                  remote_jid: sessionId,
                  from_me: true,
                  direction: "outbound",
                  content: responseText,
                  message_type: "text",
                  push_name: "IA",
                  message_id: `out-reprocess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  timestamp: new Date().toISOString(),
                });
              }
            }

            console.log(`[reprocess] ✅ Reprocessed ${sessionId} - response sent`);
            results.push({ session_id: sessionId, status: "sent", response_length: responseText.length });
            totalReprocessed++;
          }
        } catch (err) {
          console.error(`[reprocess] ❌ Error reprocessing ${sessionId}:`, err);
          results.push({ session_id: sessionId, status: "error", error: String(err) });
        }

        // Small delay between reprocessing to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return c.json({
      message: `Reprocessed ${totalReprocessed} missed conversations`,
      total: totalReprocessed,
      results,
      dry_run,
    }, 200);
  } catch (error) {
    console.error("[reprocess] ❌ Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
