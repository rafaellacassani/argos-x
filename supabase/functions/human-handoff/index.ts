import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default assignee for AI-triggered interceptions (Isabella Mafra)
const DEFAULT_AI_ASSIGNEE = "db358f6a-8d9c-44c7-8043-42e8a27f695c";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    let isServiceRole = false;

    if (token === supabaseServiceKey) {
      userId = "service_role";
      isServiceRole = true;
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
    const { action, workspace_id, lead_id, session_id, instance_name, reason, queue_item_id, transfer_to } = body;

    if (!action || !workspace_id) {
      return new Response(JSON.stringify({ error: "action and workspace_id are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "intercept") {
      return await handleIntercept(supabase, { workspace_id, lead_id, session_id, instance_name, reason, user_id: userId!, is_service_role: isServiceRole });
    } else if (action === "resume") {
      return await handleResume(supabase, { workspace_id, lead_id, session_id, queue_item_id, user_id: userId! });
    } else if (action === "transfer") {
      return await handleTransfer(supabase, { workspace_id, queue_item_id, transfer_to, user_id: userId! });
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'intercept', 'resume' or 'transfer'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
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
  is_service_role: boolean;
}) {
  const { workspace_id, lead_id, session_id, instance_name, reason, user_id, is_service_role } = params;
  console.log(`[human-handoff] 🛑 INTERCEPT: workspace=${workspace_id}, lead=${lead_id}, session=${session_id}, service_role=${is_service_role}`);

  // Determine assignee: AI-triggered → Isabella, manual → the user who triggered
  const assignee = is_service_role ? DEFAULT_AI_ASSIGNEE : user_id;

  // 1. Resolve session_id & agent_id from agent_memories
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

  // 2. Resolve lead data for the queue item
  let leadName: string | null = null;
  let leadPhone: string | null = null;

  if (lead_id) {
    const { data: leadData } = await supabase
      .from("leads")
      .select("name, phone")
      .eq("id", lead_id)
      .single();
    if (leadData) {
      leadName = leadData.name;
      leadPhone = leadData.phone;
    }
  }

  // 3. Pause ALL matching agent_memories (by session AND by lead)
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

  // 4. Cancel pending follow-ups
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

  // 5. Create support ticket with lead reference
  const { data: ticket, error: ticketErr } = await supabase
    .from("support_tickets")
    .insert({
      workspace_id,
      user_id: is_service_role ? DEFAULT_AI_ASSIGNEE : user_id,
      subject: `Suporte: ${leadName || leadPhone || "Contato"}${reason ? ` — ${reason.substring(0, 80)}` : ""}`,
      status: "in_progress",
      priority: "high",
      lead_id: lead_id || null,
      lead_name: leadName || null,
      lead_phone: leadPhone || null,
      session_id: resolvedSessionId || null,
      instance_name: instance_name || null,
    })
    .select("id")
    .single();

  if (ticketErr) {
    console.error("[human-handoff] Ticket creation error:", ticketErr);
  }

  // 6. Create human_support_queue item
  const queuePayload: any = {
    workspace_id,
    lead_id: lead_id || null,
    agent_id: agentId || null,
    session_id: resolvedSessionId || null,
    reason: reason || "manual",
    status: is_service_role ? "waiting" : "in_progress",
    assigned_to: assignee,
    instance_name: instance_name || null,
    ticket_id: ticket?.id || null,
  };

  const { data: queueItem, error: queueErr } = await supabase
    .from("human_support_queue")
    .insert(queuePayload)
    .select("id")
    .single();

  if (queueErr) {
    console.warn("[human-handoff] Queue insert conflict:", queueErr.message);
    const updatePayload = {
      status: is_service_role ? "waiting" : "in_progress",
      assigned_to: assignee,
      ticket_id: ticket?.id || null,
      updated_at: new Date().toISOString(),
    };

    if (resolvedSessionId) {
      await supabase
        .from("human_support_queue")
        .update(updatePayload)
        .eq("session_id", resolvedSessionId)
        .in("status", ["waiting", "in_progress"]);
    } else if (lead_id) {
      await supabase
        .from("human_support_queue")
        .update(updatePayload)
        .eq("lead_id", lead_id)
        .in("status", ["waiting", "in_progress"]);
    }
  }

  // 7. Backfill support ticket with lead data
  if (ticket?.id && lead_id) {
    await supabase
      .from("support_tickets")
      .update({
        lead_id,
        lead_name: leadName,
        lead_phone: leadPhone,
        session_id: resolvedSessionId,
        instance_name: instance_name || null,
      })
      .eq("id", ticket.id);
  }

  // 8. Add "Em suporte" tag
  if (lead_id) {
    await addSupportTag(supabase, workspace_id, lead_id);
  }

  console.log(`[human-handoff] ✅ Intercept complete. ticket=${ticket?.id}, queue=${queueItem?.id}, assignee=${assignee}`);

  return new Response(JSON.stringify({
    success: true,
    ticket_id: ticket?.id || null,
    queue_item_id: queueItem?.id || null,
    session_id: resolvedSessionId,
    lead_name: leadName,
    lead_phone: leadPhone,
    assigned_to: assignee,
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

  // Resume AI
  if (resolvedSessionId) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: false })
      .eq("session_id", resolvedSessionId);
  }
  if (resolvedLeadId) {
    await supabase
      .from("agent_memories")
      .update({ is_paused: false })
      .eq("lead_id", resolvedLeadId);
  }

  // Resolve queue item
  if (queueItem) {
    await supabase
      .from("human_support_queue")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queueItem.id);

    if (queueItem.ticket_id) {
      await supabase
        .from("support_tickets")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItem.ticket_id);
    }
  }

  // Remove "Em suporte" tag
  if (resolvedLeadId) {
    await removeSupportTag(supabase, workspace_id, resolvedLeadId);
  }

  console.log(`[human-handoff] ✅ Resume complete.`);

  return new Response(JSON.stringify({
    success: true,
    resumed_session: resolvedSessionId,
    resumed_lead: resolvedLeadId,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handleTransfer(supabase: any, params: {
  workspace_id: string;
  queue_item_id?: string;
  transfer_to?: string;
  user_id: string;
}) {
  const { workspace_id, queue_item_id, transfer_to, user_id } = params;

  if (!queue_item_id || !transfer_to) {
    return new Response(JSON.stringify({ error: "queue_item_id and transfer_to are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log(`[human-handoff] 🔄 TRANSFER: queue=${queue_item_id}, from=${user_id}, to=${transfer_to}`);

  // Update queue item
  const { error: qErr } = await supabase
    .from("human_support_queue")
    .update({ assigned_to: transfer_to, updated_at: new Date().toISOString() })
    .eq("id", queue_item_id)
    .eq("workspace_id", workspace_id);

  if (qErr) {
    console.error("[human-handoff] Transfer queue error:", qErr);
    return new Response(JSON.stringify({ error: qErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Also update the linked support ticket
  const { data: queueItem } = await supabase
    .from("human_support_queue")
    .select("ticket_id")
    .eq("id", queue_item_id)
    .single();

  if (queueItem?.ticket_id) {
    await supabase
      .from("support_tickets")
      .update({ user_id: transfer_to, updated_at: new Date().toISOString() })
      .eq("id", queueItem.ticket_id);
  }

  console.log(`[human-handoff] ✅ Transfer complete.`);

  return new Response(JSON.stringify({ success: true, transferred_to: transfer_to }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/* ── Tag helpers ── */

async function addSupportTag(supabase: any, workspaceId: string, leadId: string) {
  try {
    let { data: tag } = await supabase
      .from("lead_tags")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", "Em suporte")
      .maybeSingle();

    if (!tag) {
      const { data: newTag } = await supabase
        .from("lead_tags")
        .insert({ workspace_id: workspaceId, name: "Em suporte", color: "#EF4444" })
        .select("id")
        .single();
      tag = newTag;
    }

    if (tag) {
      await supabase
        .from("lead_tag_assignments")
        .upsert({ workspace_id: workspaceId, lead_id: leadId, tag_id: tag.id }, { onConflict: "workspace_id,lead_id,tag_id" });
    }
  } catch (e) {
    console.warn("[human-handoff] addSupportTag error:", e);
  }
}

async function removeSupportTag(supabase: any, workspaceId: string, leadId: string) {
  try {
    const { data: tag } = await supabase
      .from("lead_tags")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", "Em suporte")
      .maybeSingle();

    if (tag) {
      await supabase
        .from("lead_tag_assignments")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("lead_id", leadId)
        .eq("tag_id", tag.id);
    }
  } catch (e) {
    console.warn("[human-handoff] removeSupportTag error:", e);
  }
}
