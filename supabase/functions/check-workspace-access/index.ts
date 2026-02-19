import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Missing workspaceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .select("plan_type, trial_end, subscription_status, blocked_at")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Workspace not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const trialEnd = workspace.trial_end ? new Date(workspace.trial_end) : null;
    const daysRemaining = trialEnd
      ? Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
      : null;

    let allowed = false;
    let reason = workspace.plan_type;

    switch (workspace.plan_type) {
      case "trial_manual":
        if (!trialEnd || trialEnd > now) {
          allowed = true;
          reason = "trial_manual";
        } else {
          allowed = false;
          reason = "blocked";
          // Auto-block expired trial
          await supabaseAdmin
            .from("workspaces")
            .update({ blocked_at: now.toISOString() })
            .eq("id", workspaceId);
        }
        break;

      case "trialing":
        if (trialEnd && trialEnd > now) {
          allowed = true;
          reason = "trialing";
        } else {
          allowed = false;
          reason = "blocked";
          await supabaseAdmin
            .from("workspaces")
            .update({ blocked_at: now.toISOString() })
            .eq("id", workspaceId);
        }
        break;

      case "active":
        allowed = true;
        reason = "active";
        break;

      case "past_due":
        allowed = false;
        reason = "past_due";
        break;

      case "canceled":
      case "blocked":
        allowed = false;
        reason = workspace.plan_type;
        break;

      default:
        allowed = false;
        reason = "blocked";
    }

    return new Response(
      JSON.stringify({
        allowed,
        reason,
        trial_end: workspace.trial_end,
        days_remaining: daysRemaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-workspace-access error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
