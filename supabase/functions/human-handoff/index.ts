import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;

    // Try service role first
    if (token === supabaseServiceKey) {
      userId = "service_role";
    } else {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await authClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { action, workspace_id, lead_id, session_id, instance_name, reason, queue_item_id } = body;

    if (!action || !workspace_id) {
      return new Response(JSON.stringify({ error: "action and workspace_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "intercept") {
      return await handleIntercept(supabase, { workspace_id, lead_id, session_id, instance_name, reason, user_id: userId });
    } else if (action === "resume") {
      return await handleResume(supabase, { workspace_id, lead_id, session_id, queue_item_id, user_id: userId });
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'intercept' or 'resume'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("[human-handoff] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function handleIntercept(supabase: any, params: {
  workspace_id: string;
  lead_id?: string;
  session_id?: string;
  instance_name?: string;
  reason?: string;
  user_id: string;
}) {
  const { workspace_id, lead_id, session_id, instance_name, reason, user_id } = params;

  console.log(`[human-handoff] 🛑 INTERCEPT: workspace=${workspace_id}, lead=${lead_id}, session=${session_id}`);

  // 1. Find the session_id if not provided (look up from agent_memories)
  let resolvedSessionId = session_id || null;
  let agentId: string | null = null;

  if (!resolvedSessionId && lead_id) {
    const { data: memData } = await supabase
      .from("agent_memories")
      .select("session_id, agent_id")
      .eq("lead_id", lead_id)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (memData?.[0]) {
      resolvedSessionId = memData[0].session_id;
      agentId = memData[0].agent_id;
    }
  }

  if (!agentId && resolvedSessionId) {
    const { data: memData } = await supabase
      .from("agent_memories")
      .select("agent_id")
      .eq("session_id", resolvedSessionId)
      .limit(1);
    if (memData?.[0]) {
      agentId = memData[0].agent_id;
    }
  }

  // 2. Pause ALL matching agent_memories (by session AND by lead)
  if (resolvedSessionId) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: true })
      .eq("session_id", resolvedSessionId);
    console.log(`[human-handoff] ⏸️ Paused memories by session_id: ${resolvedSessionId}`);
  }
  if (lead_id) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: true })
      .eq("lead_id", lead_id);
    console.log(`[human-handoff] ⏸️ Paused memories by lead_id: ${lead_id}`);
  }

  // 3. Cancel pending follow-ups
  if (resolvedSessionId) {
    await supabase
      .from("agent_followup_queue")
      .update({ status: "canceled", canceled_reason: "human_intercept" })
      .eq("session_id", resolvedSessionId)
      .eq("status", "pending");
  }
  if (lead_id) {
    await supabase
      .from("agent_followup_queue")
      .update({ status: "canceled", canceled_reason: "human_intercept" })
      .eq("lead_id", lead_id)
      .eq("status", "pending");
  }

  // 4. Create support ticket
  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .insert({
      workspace_id,
      user_id: user_id === "service_role" ? "00000000-0000-0000-0000-000000000000" : user_id,
      subject: `Interceptação manual${reason ? ` — ${reason.substring(0, 100)}` : ""}`,
      status: "in_progress",
      priority: "high",
    })
    .select("id")
    .single();

  if (ticketErr) {
    console.error("[human-handoff] Ticket creation error:", ticketErr);
  }

  // 5. Create human_support_queue item (with ON CONFLICT protection via unique index)
  const queuePayload: any = {
    workspace_id,
    lead_id: lead_id || null,
    agent_id: agentId || null,
    session_id: resolvedSessionId || null,
    reason: reason || "manual",
    status: "in_progress",
    assigned_to: user_id === "service_role" ? null : user_id,
    instance_name: instance_name || null,
    ticket_id: ticket?.id || null,
  };

  // Try insert; if unique constraint fails (already active), update instead
  const { data: queueItem, error: queueErr } = await supabase
    .from("human_support_queue")
    .insert(queuePayload)
    .select("id")
    .single();

  if (queueErr) {
    console.warn("[human-handoff] Queue insert conflict (may already exist):", queueErr.message);
    // Update existing active item
    if (resolvedSessionId) {
      await supabase
        .from("human_support_queue")
        .update({
          status: "in_progress",
          assigned_to: user_id === "service_role" ? null : user_id,
          ticket_id: ticket?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", resolvedSessionId)
        .in("status", ["waiting", "in_progress"]);
    } else if (lead_id) {
      await supabase
        .from("human_support_queue")
        .update({
          status: "in_progress",
          assigned_to: user_id === "service_role" ? null : user_id,
          ticket_id: ticket?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("lead_id", lead_id)
        .in("status", ["waiting", "in_progress"]);
    }
  }

  console.log(`[human-handoff] ✅ Intercept complete. ticket=${ticket?.id}, queue=${queueItem?.id}`);

  return new Response(JSON.stringify({
    success: true,
    ticket_id: ticket?.id || null,
    queue_item_id: queueItem?.id || null,
    session_id: resolvedSessionId,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleResume(supabase: any, params: {
  workspace_id: string;
  lead_id?: string;
  session_id?: string;
  queue_item_id?: string;
  user_id: string;
}) {
  const { workspace_id, lead_id, session_id, queue_item_id } = params;

  console.log(`[human-handoff] ▶️ RESUME: workspace=${workspace_id}, lead=${lead_id}, session=${session_id}, queue=${queue_item_id}`);

  // 1. Find and resolve the queue item
  let queueItem: any = null;

  if (queue_item_id) {
    const { data } = await supabase
      .from("human_support_queue")
      .select("*")
      .eq("id", queue_item_id)
      .single();
    queueItem = data;
  } else if (session_id) {
    const { data } = await supabase
      .from("human_support_queue")
      .select("*")
      .eq("session_id", session_id)
      .in("status", ["waiting", "in_progress"])
      .limit(1)
      .maybeSingle();
    queueItem = data;
  } else if (lead_id) {
    const { data } = await supabase
      .from("human_support_queue")
      .select("*")
      .eq("lead_id", lead_id)
      .in("status", ["waiting", "in_progress"])
      .limit(1)
      .maybeSingle();
    queueItem = data;
  }

  const resolvedSessionId = queueItem?.session_id || session_id;
  const resolvedLeadId = queueItem?.lead_id || lead_id;

  // 2. Resume AI — unpause agent_memories
  if (resolvedSessionId) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: false })
      .eq("session_id", resolvedSessionId);
    console.log(`[human-handoff] ▶️ Resumed memories by session_id: ${resolvedSessionId}`);
  }
  if (resolvedLeadId) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: false })
      .eq("lead_id", resolvedLeadId);
    console.log(`[human-handoff] ▶️ Resumed memories by lead_id: ${resolvedLeadId}`);
  }

  // 3. Resolve queue item
  if (queueItem) {
    await supabase
      .from("human_support_queue")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueItem.id);

    // 4. Close associated ticket
    if (queueItem.ticket_id) {
      await supabase
        .from("support_tickets")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItem.ticket_id);
      console.log(`[human-handoff] 🎫 Ticket ${queueItem.ticket_id} resolved`);
    }
  }

  console.log(`[human-handoff] ✅ Resume complete.`);

  return new Response(JSON.stringify({
    success: true,
    resumed_session: resolvedSessionId,
    resumed_lead: resolvedLeadId,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
