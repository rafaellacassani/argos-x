// One-shot catch-up: replays a list of inbound messages through ai-agent-chat with service role
// and dispatches the response back via Evolution API. Safe to call multiple times — relies on
// ai-agent-chat dedup/lock + agent_executions table to avoid double sends.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") || "").replace(/\/manager\/?$/, "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, "$2");
}

async function evoSend(instance: string, number: string, text: string) {
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text, delay: 0, linkPreview: false }),
  });
  if (!res.ok) {
    console.error(`[catchup] evo error ${res.status}: ${await res.text()}`);
    return false;
  }
  return true;
}

interface Item {
  session_id: string;
  phone_number: string;
  message: string;
  message_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const workspaceId: string = body.workspace_id;
    const agentId: string = body.agent_id;
    const instanceName: string = body.instance_name;
    const items: Item[] = body.items || [];
    if (!workspaceId || !agentId || !instanceName || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];
    for (const it of items) {
      try {
        const agentRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-agent-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            agent_id: agentId,
            session_id: it.session_id,
            message: it.message,
            phone_number: it.phone_number,
            instance_name: instanceName,
            message_id: it.message_id,
            _internal_webhook: true,
            _recovery_retry: true,
          }),
        });
        const data = await agentRes.json();
        const chunks: string[] = data.chunks || (data.response ? [data.response] : []);
        let sent = 0;
        for (const chunk of chunks) {
          if (!chunk?.trim()) continue;
          const ok = await evoSend(instanceName, it.phone_number, stripMarkdownLinks(chunk));
          if (ok) sent++;
          if (chunks.length > 1) await new Promise((r) => setTimeout(r, 800));
        }
        results.push({ session: it.session_id, status: agentRes.status, chunks: chunks.length, sent, skipped: data.skipped || false });
      } catch (e) {
        results.push({ session: it.session_id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
