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
  if (!res.ok) return null;
  return res.json();
}

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

app.post("/", async (c) => {
  try {
    const supabase = getSupabase();

    const authHeader = c.req.header("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    let authorized = false;

    // Internal automation (service role)
    if (token && token === SUPABASE_SERVICE_KEY) {
      authorized = true;
    }

    // Manual operation by authenticated admin user
    if (!authorized && token) {
      const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      const requesterUserId = claimsData?.claims?.sub;

      if (!claimsError && requesterUserId) {
        const { data: adminMembership } = await supabase
          .from("workspace_members")
          .select("id")
          .eq("user_id", requesterUserId)
          .eq("role", "admin")
          .not("accepted_at", "is", null)
          .limit(1);

        authorized = !!(adminMembership && adminMembership.length > 0);
      }
    }

    if (!authorized) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const { hours_back = 48, dry_run = false } = body;
    const cutoff = new Date(Date.now() - hours_back * 60 * 60 * 1000).toISOString();

    // Optional RPC path (if function exists) - best effort only
    try {
      await supabase.rpc("get_missed_messages_for_reprocess", {
        cutoff_time: cutoff,
      });
    } catch (rpcErr) {
      console.log("[reprocess] ℹ️ RPC get_missed_messages_for_reprocess unavailable, using fallback query");
    }

    // Fallback: direct query approach
    // Find agent_memories where last message in array is role=assistant (qualification question)
    // AND there exists a NEWER inbound whatsapp_message with no outbound response
    const { data: memories } = await supabase
      .from("agent_memories")
      .select("id, agent_id, session_id, messages, lead_id, updated_at, is_paused")
      .eq("is_paused", false)
      .eq("is_processing", false)
      .gte("updated_at", cutoff);

    if (!memories || memories.length === 0) {
      return c.json({ message: "No memories found in time window", reprocessed: 0 }, 200);
    }

    const results: any[] = [];
    let totalReprocessed = 0;

    for (const mem of memories) {
      const messages = Array.isArray(mem.messages) ? mem.messages : [];
      if (messages.length === 0) continue;

      const lastMsg = messages[messages.length - 1];
      // Only reprocess if the LAST message is from assistant (AI asked something, lead may have responded but it was lost)
      if (lastMsg.role !== "assistant") continue;

      const sessionId = mem.session_id;
      const sessionPhone = sessionId.replace(/@s\.whatsapp\.net$|@lid$|@c\.us$/i, "");

      // Check if there are newer inbound messages for this session that got no AI response
      const { data: unansweredMsgs } = await supabase
        .from("whatsapp_messages")
        .select("content, push_name, timestamp, remote_jid")
        .eq("from_me", false)
        .eq("direction", "inbound")
        .gt("timestamp", mem.updated_at)
        .or(`remote_jid.like.%${sessionPhone.slice(-10)}%`)
        .order("timestamp", { ascending: true })
        .limit(5);

      if (!unansweredMsgs || unansweredMsgs.length === 0) continue;

      // Also check via webhook_message_log for @lid mapped sessions
      const { data: mappedMsgs } = await supabase
        .from("webhook_message_log")
        .select("message_id")
        .eq("session_id", sessionId)
        .gte("processed_at", mem.updated_at);

      if (mappedMsgs && mappedMsgs.length > 0) {
        // There are messages logged for this session after the last AI response
        const msgIds = mappedMsgs.map((m: any) => m.message_id);
        const { data: actualMsgs } = await supabase
          .from("whatsapp_messages")
          .select("content, push_name, timestamp")
          .in("message_id", msgIds)
          .eq("from_me", false)
          .order("timestamp", { ascending: true });

        if (actualMsgs && actualMsgs.length > 0) {
          const latestMsg = actualMsgs[actualMsgs.length - 1];
          
          console.log(`[reprocess] 🔄 Session ${sessionId}: unanswered message "${latestMsg.content?.substring(0, 50)}" from ${latestMsg.push_name}`);

          if (dry_run) {
            results.push({ 
              session_id: sessionId, 
              lead_id: mem.lead_id,
              message: latestMsg.content?.substring(0, 80),
              push_name: latestMsg.push_name,
              status: "would_reprocess"
            });
            totalReprocessed++;
            continue;
          }

          // Get the agent's instance_name
          const { data: agent } = await supabase
            .from("ai_agents")
            .select("instance_name, workspace_id, name")
            .eq("id", mem.agent_id)
            .single();

          if (!agent) continue;

          // Clear the stale last_message_id to avoid dedup blocking
          await supabase.from("agent_memories")
            .update({ last_message_id: null })
            .eq("id", mem.id);

          // Call ai-agent-chat
          try {
            const agentRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent-chat`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              },
              body: JSON.stringify({
                agent_id: mem.agent_id,
                session_id: sessionId,
                message: latestMsg.content,
                lead_id: mem.lead_id,
                _internal_webhook: true,
                instance_name: agent.instance_name,
              }),
            });

            const agentData = await agentRes.json();

            if (agentData.skipped || agentData.error) {
              console.log(`[reprocess] ⏭️ ${sessionId}: ${agentData.reason || agentData.error}`);
              results.push({ session_id: sessionId, status: "skipped", reason: agentData.reason || agentData.error });
              continue;
            }

            const responseText = agentData.response || (agentData.chunks ? agentData.chunks.join("\n\n") : null);
            if (responseText && agent.instance_name) {
              const chunks = agentData.chunks || [responseText];
              for (const chunk of chunks) {
                if (!chunk?.trim()) continue;
                const sendResult = await evolutionFetch(`/message/sendText/${agent.instance_name}`, "POST", {
                  number: sessionPhone,
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
                if (chunks.length > 1) await new Promise(r => setTimeout(r, 400));
              }

              console.log(`[reprocess] ✅ ${sessionId} - response sent (${responseText.length} chars)`);
              results.push({ session_id: sessionId, status: "sent", response_length: responseText.length, push_name: latestMsg.push_name });
              totalReprocessed++;
            }
          } catch (err) {
            console.error(`[reprocess] ❌ ${sessionId}:`, err);
            results.push({ session_id: sessionId, status: "error", error: String(err) });
          }

          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    return c.json({ message: `Reprocessed ${totalReprocessed} missed conversations`, total: totalReprocessed, results, dry_run }, 200);
  } catch (error) {
    console.error("[reprocess] ❌ Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
