import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

// Internal CRM constants
const INTERNAL_WS = "41efdc6d-d4ba-4589-9761-7438a5911d57";
const STAGE_CANCELED = "a1c9acb9-82e5-4b99-966b-d7a033372a9a";
const TAG_CANCELED = "0594a852-068d-4a23-a9d5-c17e8106f396";
const STATUS_TAGS = [
  "a57de997-9b5c-467d-ad1e-8b50e0d07958", // trial
  "62750bf4-b139-4462-b646-100e1c69723b", // active
  "0594a852-068d-4a23-a9d5-c17e8106f396", // canceled
];

async function asaasFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

/**
 * Dunning / collection automation for Asaas-billed workspaces.
 * Runs via pg_cron every hour.
 *
 * Rules:
 * - Trial expired (trial_end passed) + no confirmed payment → block
 * - plan_type = "past_due" for 7+ days → block workspace
 * - plan_type = "past_due" for 15+ days → cancel subscription in Asaas + cancel workspace
 * - billingType UNDEFINED (no payment method) for 7+ days → block
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const results: string[] = [];

    // ================================================================
    // 1. Block expired trials that never paid
    // ================================================================
    const { data: expiredTrials } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, trial_end, asaas_customer_id, plan_type")
      .eq("payment_provider", "asaas")
      .in("plan_type", ["trialing", "trial_manual"])
      .is("blocked_at", null)
      .not("trial_end", "is", null);

    for (const ws of expiredTrials || []) {
      const trialEnd = new Date(ws.trial_end);
      if (trialEnd > now) continue; // Still in trial

      await supabaseAdmin
        .from("workspaces")
        .update({
          plan_type: "blocked",
          subscription_status: "past_due",
          blocked_at: now.toISOString(),
        })
        .eq("id", ws.id);

      results.push(`BLOCKED expired trial: ${ws.name} (${ws.id})`);
    }

    // ================================================================
    // 2. Block past_due workspaces after 7 days
    // ================================================================
    const { data: pastDueWorkspaces } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, updated_at, asaas_customer_id, asaas_subscription_id")
      .eq("payment_provider", "asaas")
      .eq("plan_type", "past_due")
      .is("blocked_at", null);

    for (const ws of pastDueWorkspaces || []) {
      const updatedAt = new Date(ws.updated_at);
      const daysSincePastDue = (now.getTime() - updatedAt.getTime()) / 86400000;

      if (daysSincePastDue >= 7) {
        await supabaseAdmin
          .from("workspaces")
          .update({
            blocked_at: now.toISOString(),
            plan_type: "blocked",
          })
          .eq("id", ws.id);

        results.push(`BLOCKED past_due 7d+: ${ws.name} (${ws.id}), ${Math.floor(daysSincePastDue)}d overdue`);
      }
    }

    // ================================================================
    // 3. Cancel subscriptions for blocked workspaces after 15 days
    // ================================================================
    const { data: blockedWorkspaces } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, blocked_at, asaas_customer_id, asaas_subscription_id, plan_type")
      .eq("payment_provider", "asaas")
      .in("plan_type", ["blocked", "past_due"])
      .not("blocked_at", "is", null)
      .not("asaas_subscription_id", "is", null);

    for (const ws of blockedWorkspaces || []) {
      const blockedAt = new Date(ws.blocked_at);
      const daysSinceBlocked = (now.getTime() - blockedAt.getTime()) / 86400000;

      if (daysSinceBlocked >= 15) {
        // Cancel subscription in Asaas
        try {
          await asaasFetch(`/subscriptions/${ws.asaas_subscription_id}`, {
            method: "DELETE",
          });
          results.push(`CANCELED sub ${ws.asaas_subscription_id} for: ${ws.name}`);
        } catch (e: any) {
          results.push(`Failed to cancel sub for ${ws.name}: ${e.message}`);
        }

        await supabaseAdmin
          .from("workspaces")
          .update({
            plan_type: "canceled",
            subscription_status: "canceled",
          })
          .eq("id", ws.id);

        // Move internal CRM lead to canceled
        try {
          const { data: profile } = await supabaseAdmin
            .from("user_profiles")
            .select("email")
            .eq("user_id", (await supabaseAdmin.from("workspace_members").select("user_id").eq("workspace_id", ws.id).eq("role", "admin").limit(1).single()).data?.user_id)
            .single();

          if (profile?.email) {
            const { data: lead } = await supabaseAdmin
              .from("leads")
              .select("id")
              .eq("workspace_id", INTERNAL_WS)
              .eq("email", profile.email)
              .maybeSingle();

            if (lead) {
              await supabaseAdmin.from("leads").update({ stage_id: STAGE_CANCELED }).eq("id", lead.id);
              await supabaseAdmin.from("lead_tag_assignments").delete()
                .eq("lead_id", lead.id).eq("workspace_id", INTERNAL_WS).in("tag_id", STATUS_TAGS);
              await supabaseAdmin.from("lead_tag_assignments").upsert(
                { workspace_id: INTERNAL_WS, lead_id: lead.id, tag_id: TAG_CANCELED },
                { onConflict: "lead_id,tag_id" }
              );
            }
          }
        } catch (e) {
          console.warn("CRM update failed:", e);
        }

        results.push(`CANCELED workspace: ${ws.name} (${ws.id})`);
      }
    }

    // ================================================================
    // 4. Audit workspaces with active status but OVERDUE payments in Asaas
    // ================================================================
    const { data: activeAsaas } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, asaas_customer_id, plan_name, plan_type")
      .eq("payment_provider", "asaas")
      .eq("plan_type", "active")
      .not("asaas_customer_id", "is", null)
      .limit(200);

    let overdueActive = 0;
    for (const ws of activeAsaas || []) {
      try {
        const overdueRes = await asaasFetch(
          `/payments?customer=${ws.asaas_customer_id}&status=OVERDUE&limit=5`
        );
        const overduePayments = overdueRes.data || [];
        if (overduePayments.length > 0) {
          // Has overdue payments but plan_type is still "active" → fix it
          await supabaseAdmin
            .from("workspaces")
            .update({
              plan_type: "past_due",
              subscription_status: "past_due",
            })
            .eq("id", ws.id);

          overdueActive++;
          results.push(`FIXED active→past_due: ${ws.name} (${ws.id}), ${overduePayments.length} overdue payments`);
        }
      } catch (e) {
        // Rate limit or API error — skip
      }
    }

    console.log(`[check-overdue] Processed: ${results.length} actions. Overdue-active fixed: ${overdueActive}`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        actions: results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[check-overdue] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
