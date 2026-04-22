import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Permanent protections — never archive or delete these
const PROTECTED_WORKSPACE_IDS = [
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X master
  "00000000-0000-0000-0000-000000000001", // Default
];
const PROTECTED_OWNER_EMAILS = ["rafaellacassani@gmail.com"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();

    // Resolve protected user IDs
    const { data: protectedUsers } = await supabase
      .from("user_profiles")
      .select("user_id")
      .in("email", PROTECTED_OWNER_EMAILS);
    const protectedUserIds = (protectedUsers || []).map((u) => u.user_id);

    // ------------------------------------------------------------------
    // 1) Identify candidates for archiving
    // ------------------------------------------------------------------
    // Trial expired > 30d, no customer_id
    // Trial expired > 45d, with customer_id (but not on reactivation_watch active)
    // Canceled > 60d
    const { data: candidates } = await supabase
      .from("workspaces")
      .select("id, name, plan_type, subscription_status, trial_end, updated_at, stripe_customer_id, asaas_customer_id, created_by")
      .is("archived_at", null);

    const toArchive: { id: string; name: string; reason: string }[] = [];

    // Pull active reactivation_watch (still within deadline)
    const { data: watchRows } = await supabase
      .from("reactivation_watch")
      .select("workspace_id, archive_deadline");
    const watchMap = new Map<string, string>(
      (watchRows || []).map((w) => [w.workspace_id, w.archive_deadline])
    );

    for (const ws of candidates || []) {
      if (PROTECTED_WORKSPACE_IDS.includes(ws.id)) continue;
      if (ws.created_by && protectedUserIds.includes(ws.created_by)) continue;

      const hasCustomer = !!(ws.stripe_customer_id || ws.asaas_customer_id);
      const trialEnd = ws.trial_end ? new Date(ws.trial_end) : null;
      const updatedAt = new Date(ws.updated_at);
      const daysSinceTrialEnd = trialEnd ? (now.getTime() - trialEnd.getTime()) / 86400000 : 0;
      const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / 86400000;

      // Canceled > 60 days
      if (ws.subscription_status === "canceled" && daysSinceUpdate >= 60) {
        toArchive.push({ id: ws.id, name: ws.name, reason: "canceled_60d" });
        continue;
      }

      // Trial expired
      if (ws.subscription_status === "trialing" && trialEnd && daysSinceTrialEnd >= 30) {
        if (!hasCustomer) {
          toArchive.push({ id: ws.id, name: ws.name, reason: "trial_no_payment_30d" });
        } else if (daysSinceTrialEnd >= 45) {
          // Respect reactivation watch deadline if still in future
          const deadline = watchMap.get(ws.id);
          if (!deadline || new Date(deadline) <= now) {
            toArchive.push({ id: ws.id, name: ws.name, reason: "trial_with_customer_45d" });
          }
        }
      }
    }

    // ------------------------------------------------------------------
    // 2) Archive
    // ------------------------------------------------------------------
    const archivedIds: string[] = [];
    if (toArchive.length > 0) {
      const ids = toArchive.map((w) => w.id);
      const { error: wsErr } = await supabase
        .from("workspaces")
        .update({ archived_at: now.toISOString(), blocked_at: now.toISOString(), plan_type: "archived" })
        .in("id", ids)
        .is("archived_at", null);
      if (wsErr) throw wsErr;

      await supabase.from("ai_agents").update({ is_active: false }).in("workspace_id", ids);

      archivedIds.push(...ids);
    }

    // ------------------------------------------------------------------
    // 3) Permanent deletion candidates: archived > 180 days
    // (Soft list only — we DO NOT auto-delete data. Just report.)
    // ------------------------------------------------------------------
    const { data: oldArchived } = await supabase
      .from("workspaces")
      .select("id, name, archived_at")
      .not("archived_at", "is", null)
      .lt("archived_at", new Date(now.getTime() - 180 * 86400000).toISOString());

    const deletionCandidates = (oldArchived || []).filter(
      (w) => !PROTECTED_WORKSPACE_IDS.includes(w.id)
    );

    // ------------------------------------------------------------------
    // 4) Audit log
    // ------------------------------------------------------------------
    await supabase.from("cleanup_log").insert({
      trigger_source: "cron",
      archived_count: archivedIds.length,
      deleted_count: 0,
      archived_workspace_ids: archivedIds,
      deleted_workspace_ids: [],
      details: {
        candidates_evaluated: candidates?.length || 0,
        archive_breakdown: toArchive.reduce<Record<string, number>>((acc, w) => {
          acc[w.reason] = (acc[w.reason] || 0) + 1;
          return acc;
        }, {}),
        deletion_candidates_180d: deletionCandidates.map((w) => ({ id: w.id, name: w.name })),
        protected_workspace_ids: PROTECTED_WORKSPACE_IDS,
        protected_owner_emails: PROTECTED_OWNER_EMAILS,
      },
    });

    return new Response(
      JSON.stringify({
        archived: archivedIds.length,
        archived_ids: archivedIds,
        deletion_candidates_180d: deletionCandidates.length,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cleanup-inactive-workspaces] error:", msg);
    await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
      .from("cleanup_log")
      .insert({ trigger_source: "cron", error_message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});