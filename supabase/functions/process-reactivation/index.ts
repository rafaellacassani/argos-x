import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function buildHtmlEmail(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
<tr><td style="background:#0F172A;padding:24px 32px;text-align:center">
<img src="https://argosx.com.br/favicon.png" width="40" height="40" alt="Argos X" style="display:inline-block;vertical-align:middle;margin-right:8px">
<span style="color:#ffffff;font-size:22px;font-weight:700;vertical-align:middle">Argos X</span>
</td></tr>
<tr><td style="padding:32px">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 32px 24px;text-align:center;color:#94a3b8;font-size:12px">
© ${new Date().getFullYear()} Argos X — CRM Inteligente
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// No hardcoded fallback templates — the system ONLY sends active cadence_messages from DB.
// This ensures the admin has full control: activate/deactivate any day or channel at will.

function replaceVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), val);
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    const cadenceDays: number[] = Array.isArray(config.cadence_days) ? config.cadence_days : [];

    // 1b. Fetch all cadence messages from DB
    const { data: allCadenceMessages } = await supabaseAdmin
      .from("cadence_messages")
      .select("*")
      .eq("config_id", config.id)
      .order("position", { ascending: true });

    // Group ACTIVE messages by day — only active messages will be sent
    const messagesByDay: Record<number, any[]> = {};
    for (const msg of allCadenceMessages || []) {
      if (!msg.is_active) continue;
      if (!messagesByDay[msg.cadence_day]) messagesByDay[msg.cadence_day] = [];
      messagesByDay[msg.cadence_day].push(msg);
    }

    // 2. Fetch workspaces with trials
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, trial_end, plan_type, created_by, blocked_at")
      .in("plan_type", ["trial_manual", "trialing", "blocked"])
      .not("trial_end", "is", null);

    if (wsErr) throw wsErr;

    const now = new Date();
    let sentCount = 0;
    let skippedCount = 0;

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    for (const ws of workspaces || []) {
      const trialEnd = new Date(ws.trial_end);
      const daysFromExpiry = Math.round((now.getTime() - trialEnd.getTime()) / 86400000);

      const matchingDay = cadenceDays.find((d) => d === daysFromExpiry);
      if (matchingDay === undefined) continue;

      // Skip if the user already has ANOTHER workspace with an active paid plan
      const { data: otherActiveWs } = await supabaseAdmin
        .from("workspaces")
        .select("id")
        .eq("created_by", ws.created_by)
        .in("plan_type", ["active"])
        .neq("id", ws.id)
        .limit(1);

      if (otherActiveWs && otherActiveWs.length > 0) {
        console.log(`Skipping cadence for workspace ${ws.id} — user has active workspace ${otherActiveWs[0].id}`);
        skippedCount++;
        continue;
      }

      // Check if already sent
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
      const daysSinceExpiry = Math.max(0, daysFromExpiry);
      const planLink = "https://argosx.com.br/planos";

      const vars = {
        nome: ownerName,
        link: planLink,
        dias_expirado: String(daysSinceExpiry),
        email: ownerEmail || "",
      };

      const dayMessages = messagesByDay[matchingDay] || [];

      // ── Send WhatsApp ──
      if (config.send_whatsapp && ownerPhone && config.whatsapp_instance_name) {
        try {
          if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            let cleanPhone = ownerPhone.replace(/\D/g, "");
            if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
              cleanPhone = "55" + cleanPhone;
            }

            const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
            const whatsappMsgs = dayMessages.filter((m: any) => m.channel === "whatsapp");

            if (whatsappMsgs.length > 0) {
              for (let i = 0; i < whatsappMsgs.length; i++) {
                const msg = whatsappMsgs[i];
                let res: Response;

                if (msg.message_type === "audio" && msg.audio_url) {
                  res = await fetch(`${apiUrl}/message/sendWhatsAppAudio/${config.whatsapp_instance_name}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
                    body: JSON.stringify({ number: cleanPhone, audio: msg.audio_url }),
                  });
                } else if ((msg.message_type === "video" || msg.message_type === "image") && msg.audio_url) {
                  const caption = msg.content ? replaceVars(msg.content, vars) : undefined;
                  res = await fetch(`${apiUrl}/message/sendMedia/${config.whatsapp_instance_name}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
                    body: JSON.stringify({ number: cleanPhone, mediatype: msg.message_type, media: msg.audio_url, caption, delay: 0 }),
                  });
                } else {
                  const text = replaceVars(msg.content || "", vars);
                  res = await fetch(`${apiUrl}/message/sendText/${config.whatsapp_instance_name}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
                    body: JSON.stringify({ number: cleanPhone, text }),
                  });
                }

                if (res.ok) sentCount++;

                await supabaseAdmin.from("reactivation_log").insert({
                  workspace_id: ws.id,
                  cadence_day: matchingDay,
                  channel: "whatsapp",
                  status: res.ok ? "sent" : "failed",
                  error_message: res.ok ? null : `HTTP ${res.status}`,
                });

                if (i < whatsappMsgs.length - 1) await sleep(2000);
              }
            } else {
              console.log(`[cadence] Day ${matchingDay}: no active WhatsApp messages, skipping`);
            }
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

      // ── Send Email ──
      if (config.send_email && ownerEmail && RESEND_API_KEY) {
        try {
          const emailMsgs = dayMessages.filter((m: any) => m.channel === "email" && m.message_type === "text");

          if (emailMsgs.length > 0) {
            const emailMsg = emailMsgs[0];
            const emailContent = replaceVars(emailMsg.content || "", vars);
            const emailSubject = replaceVars(
              emailMsg.subject || config.email_subject || "Argos X — Reative sua conta",
              vars
            );
            const htmlEmail = buildHtmlEmail(
              emailSubject,
              `<div style="color:#475569;font-size:15px;line-height:1.6;white-space:pre-line">${emailContent}</div>`
            );

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
                html: htmlEmail,
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
          } else {
            console.log(`[cadence] Day ${matchingDay}: no active email messages, skipping`);
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
