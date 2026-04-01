import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate confirmation
    const body = await req.json();
    if (body.confirmation !== "EXCLUIR") {
      return new Response(
        JSON.stringify({ error: "Confirmação inválida. Digite EXCLUIR para confirmar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's workspace
    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Nenhum workspace encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workspaceId = membership.workspace_id;

    // Only workspace admin/owner can delete the entire workspace
    // Non-admins can only remove themselves
    const isAdmin = membership.role === "admin";

    if (isAdmin) {
      // ── Full workspace deletion (same logic as admin-clients delete-workspace) ──

      // 1. Cancel payment provider subscription
      const { data: wsData } = await supabaseAdmin
        .from("workspaces")
        .select("stripe_customer_id, stripe_subscription_id, payment_provider, asaas_subscription_id")
        .eq("id", workspaceId)
        .single();

      if (wsData) {
        if (wsData.payment_provider === "asaas" && wsData.asaas_subscription_id) {
          // Cancel Asaas subscription
          try {
            const asaasKey = Deno.env.get("ASAAS_API_KEY");
            if (asaasKey) {
              await fetch(`https://api.asaas.com/v3/subscriptions/${wsData.asaas_subscription_id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json", access_token: asaasKey },
              });
              console.log("Asaas subscription canceled:", wsData.asaas_subscription_id);
            }
          } catch (e) {
            console.warn("Failed to cancel Asaas subscription:", e);
          }
        } else {
          // Cancel Stripe subscription (existing logic)
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
          if (stripeKey && (wsData.stripe_subscription_id || wsData.stripe_customer_id)) {
            try {
              const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

              if (wsData.stripe_subscription_id) {
                try {
                  await stripe.subscriptions.cancel(wsData.stripe_subscription_id);
                  console.log("Stripe subscription canceled:", wsData.stripe_subscription_id);
                } catch (e) {
                  console.warn("Failed to cancel subscription:", e);
                }
              }

              if (wsData.stripe_customer_id) {
                try {
                  const subs = await stripe.subscriptions.list({
                    customer: wsData.stripe_customer_id,
                    status: "active",
                    limit: 10,
                  });
                  for (const sub of subs.data) {
                    await stripe.subscriptions.cancel(sub.id);
                  }
                  const trialSubs = await stripe.subscriptions.list({
                    customer: wsData.stripe_customer_id,
                    status: "trialing",
                    limit: 10,
                  });
                  for (const sub of trialSubs.data) {
                    await stripe.subscriptions.cancel(sub.id);
                  }
                } catch (e) {
                  console.warn("Failed to cancel customer subscriptions:", e);
                }
              }
            } catch (e) {
              console.warn("Stripe cleanup failed:", e);
            }
          }
        }
      }

      // 2. Delete all dependent data
      const tables = [
        "reactivation_log",
        "agent_followup_queue", "agent_executions", "agent_memories", "agent_attachments", "ai_agents",
        "bot_execution_logs", "salesbot_wait_queue", "salesbots",
        "campaign_recipients", "campaigns",
        "followup_campaign_contacts", "followup_campaigns",
        "lead_tag_assignments", "lead_proposals", "lead_sales", "lead_history",
        "lead_custom_field_values", "lead_attribution", "leads",
        "funnel_stages", "funnels",
        "whatsapp_messages", "whatsapp_cloud_connections", "whatsapp_templates", "whatsapp_instances",
        "calendar_events", "google_calendar_tokens",
        "emails", "email_accounts",
        "notification_preferences", "notification_settings",
        "scheduled_messages", "tag_rules", "lead_tags",
        "stage_automation_queue", "stage_automations",
        "meta_conversations", "meta_pages", "meta_accounts",
        "alert_log", "lead_packs",
        "user_sessions", "webhook_message_log",
        "member_permissions", "api_key_usage_log", "api_keys",
        "support_tickets", "human_support_queue",
        "cadence_messages",
      ];

      for (const table of tables) {
        try {
          await supabaseAdmin.from(table).delete().eq("workspace_id", workspaceId);
        } catch (e) {
          console.warn(`Failed to delete from ${table}:`, e);
        }
      }

      // 3. Get all members
      const { data: members } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      const memberUserIds = (members || []).map((m: any) => m.user_id);

      // Delete workspace members
      await supabaseAdmin.from("workspace_members").delete().eq("workspace_id", workspaceId);

      // Delete client invites
      await supabaseAdmin.from("client_invites").delete().eq("workspace_id", workspaceId);

      // 4. Delete workspace
      await supabaseAdmin.from("workspaces").delete().eq("id", workspaceId);

      // 5. Clean up orphaned users
      for (const uid of memberUserIds) {
        const { count } = await supabaseAdmin
          .from("workspace_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", uid);

        if (count === 0) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_profiles").delete().eq("user_id", uid);
          try {
            await supabaseAdmin.auth.admin.deleteUser(uid);
            console.log("Deleted auth user:", uid);
          } catch (e) {
            console.warn("Failed to delete auth user:", uid, e);
          }
        }
      }
    } else {
      // Non-admin: just remove themselves from the workspace
      await supabaseAdmin.from("workspace_members").delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);
      await supabaseAdmin.from("member_permissions").delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
      await supabaseAdmin.from("user_profiles").delete().eq("user_id", user.id);
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
      } catch (e) {
        console.warn("Failed to delete auth user:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cancel-account error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
