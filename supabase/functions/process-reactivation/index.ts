import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Fetch cadence config
    const { data: config, error: configErr } = await supabaseAdmin
      .from("reactivation_cadence_config")
      .select("*")
      .limit(1)
      .single();

    if (configErr || !config || !config.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: "Cadence inactive or not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cadenceDays: number[] = Array.isArray(config.cadence_days) ? config.cadence_days : [6, 7, 9, 14, 21];

    // 2. Fetch workspaces with expired or expiring trials that haven't paid
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, trial_end, plan_type, created_by, blocked_at")
      .in("plan_type", ["trial_manual", "trialing", "blocked"])
      .not("trial_end", "is", null);

    if (wsErr) throw wsErr;

    const now = new Date();
    let sentCount = 0;
    let skippedCount = 0;

    for (const ws of workspaces || []) {
      const trialEnd = new Date(ws.trial_end);
      const trialStart = new Date(trialEnd.getTime() - 7 * 86400000); // trial_end - 7 days = trial start
      const daysSinceTrialStart = Math.ceil((now.getTime() - trialStart.getTime()) / 86400000);

      // Check if today matches any cadence day
      const matchingDay = cadenceDays.find((d) => d === daysSinceTrialStart);
      if (!matchingDay) continue;

      // Check if already sent for this day + workspace
      const { data: existing } = await supabaseAdmin
        .from("reactivation_log")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("cadence_day", matchingDay)
        .limit(1);

      if (existing && existing.length > 0) {
        skippedCount++;
        continue;
      }

      // Get owner profile
      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("full_name, email, phone, personal_whatsapp")
        .eq("user_id", ws.created_by)
        .single();

      if (!profile) continue;

      const ownerName = profile.full_name || "Cliente";
      const ownerEmail = profile.email;
      const ownerPhone = profile.personal_whatsapp || profile.phone;
      const daysSinceExpiry = Math.max(0, Math.ceil((now.getTime() - trialEnd.getTime()) / 86400000));
      const planLink = "https://argosx.com.br/auth";

      const replacePlaceholders = (template: string) =>
        template
          .replace(/{nome}/g, ownerName)
          .replace(/{email}/g, ownerEmail || "")
          .replace(/{link}/g, planLink)
          .replace(/{dias_expirado}/g, String(daysSinceExpiry));

      // Send WhatsApp
      if (config.send_whatsapp && ownerPhone && config.whatsapp_instance_name) {
        try {
          const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
          const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

          if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            let cleanPhone = ownerPhone.replace(/\D/g, "");
            if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
              cleanPhone = "55" + cleanPhone;
            }

            const message = replacePlaceholders(config.whatsapp_template);
            const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");

            const res = await fetch(`${apiUrl}/message/sendText/${config.whatsapp_instance_name}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: EVOLUTION_API_KEY,
              },
              body: JSON.stringify({ number: cleanPhone, text: message }),
            });

            await supabaseAdmin.from("reactivation_log").insert({
              workspace_id: ws.id,
              cadence_day: matchingDay,
              channel: "whatsapp",
              status: res.ok ? "sent" : "failed",
              error_message: res.ok ? null : `HTTP ${res.status}`,
            });

            if (res.ok) sentCount++;
          }
        } catch (e) {
          console.warn("WhatsApp send failed:", e);
          await supabaseAdmin.from("reactivation_log").insert({
            workspace_id: ws.id,
            cadence_day: matchingDay,
            channel: "whatsapp",
            status: "failed",
            error_message: String(e),
          });
        }
      }

      // Send Email
      if (config.send_email && ownerEmail) {
        try {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const emailBody = replacePlaceholders(config.email_template);
            const emailSubject = replacePlaceholders(config.email_subject);

            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Argos X <noreply@argosx.com.br>",
                to: [ownerEmail],
                subject: emailSubject,
                text: emailBody,
              }),
            });

            await supabaseAdmin.from("reactivation_log").insert({
              workspace_id: ws.id,
              cadence_day: matchingDay,
              channel: "email",
              status: res.ok ? "sent" : "failed",
              error_message: res.ok ? null : `HTTP ${res.status}`,
            });

            if (res.ok) sentCount++;
          }
        } catch (e) {
          console.warn("Email send failed:", e);
          await supabaseAdmin.from("reactivation_log").insert({
            workspace_id: ws.id,
            cadence_day: matchingDay,
            channel: "email",
            status: "failed",
            error_message: String(e),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-reactivation error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
