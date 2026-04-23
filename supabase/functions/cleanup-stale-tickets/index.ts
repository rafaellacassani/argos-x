// Cron-driven cleanup of abandoned support tickets.
// Auto-resolves human_support_queue tickets older than 48h with no new
// inbound messages, and relies on the auto_unpause_agent_on_resolve trigger
// to resume the AI session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const STALE_HOURS = 48;
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  try {
    // Fetch open tickets older than 48h
    const { data: openTickets, error: fetchErr } = await supabase
      .from("human_support_queue")
      .select("id, workspace_id, lead_id, session_id, created_at, updated_at")
      .neq("status", "resolved")
      .lt("created_at", cutoff);

    if (fetchErr) throw fetchErr;

    const stale: string[] = [];
    const skipped: string[] = [];

    for (const t of openTickets ?? []) {
      // Look for any inbound message after ticket creation for the same lead
      let hasRecent = false;

      if (t.lead_id) {
        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("workspace_id", t.workspace_id)
          .eq("lead_id", t.lead_id)
          .eq("from_me", false)
          .gt("created_at", t.created_at)
          .limit(1);
        if (msgs && msgs.length > 0) hasRecent = true;
      } else if (t.session_id) {
        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("id")
          .eq("workspace_id", t.workspace_id)
          .eq("remote_jid", t.session_id)
          .eq("from_me", false)
          .gt("created_at", t.created_at)
          .limit(1);
        if (msgs && msgs.length > 0) hasRecent = true;
      }

      if (hasRecent) {
        skipped.push(t.id);
      } else {
        stale.push(t.id);
      }
    }

    let resolvedCount = 0;
    if (stale.length > 0) {
      const { error: updErr, count } = await supabase
        .from("human_support_queue")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          notes: "[auto-resolvido por cleanup-stale-tickets: abandonado +48h sem novas mensagens]",
        }, { count: "exact" })
        .in("id", stale);

      if (updErr) throw updErr;
      resolvedCount = count ?? stale.length;
    }

    const result = {
      ok: true,
      ran_at: new Date().toISOString(),
      cutoff,
      open_tickets_scanned: openTickets?.length ?? 0,
      auto_resolved: resolvedCount,
      skipped_recent_activity: skipped.length,
    };

    console.log("[cleanup-stale-tickets]", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cleanup-stale-tickets] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});