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

// Fallback templates used when no cadence_messages exist for a given day
const fallbackWhatsappTemplates: Record<number, (name: string, link: string, days: number) => string> = {
  [-2]: (name, link) => `Olá, ${name}! ⏳\n\nSeu trial no *Argos X* acaba em *2 dias*.\n\nAtive seu plano para não perder o acesso:\n👉 ${link}\n\nPlanos a partir de R$ 47,90/mês.`,
  [-1]: (name, link) => `🚨 ${name}, *último dia* do seu trial no Argos X!\n\nAmanhã seu acesso será bloqueado.\n\nAtive agora:\n👉 ${link}`,
  [0]: (name, link) => `🔒 ${name}, seu acesso ao *Argos X* foi bloqueado.\n\nMas seus dados estão salvos! Escolha um plano e continue de onde parou:\n👉 ${link}`,
  [3]: (name, link) => `📊 ${name}, seus leads continuam esperando!\n\nReative sua conta no Argos X:\n👉 ${link}\n\nPlanos a partir de R$ 47,90/mês.`,
  [7]: (name, link) => `⚠️ ${name}, última chance!\n\nSeu trial expirou há 7 dias. Reative agora antes que seus dados sejam removidos:\n👉 ${link}`,
};

const fallbackEmailTemplates: Record<number, { subject: string; body: (name: string, days: number, link: string) => string }> = {
  [-2]: {
    subject: "⏳ Seu trial acaba em 2 dias — ative seu plano!",
    body: (name, _, link) => `
      <h2 style="color:#0F172A;margin:0 0 16px">Olá, ${name}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Seu período de teste no <strong>Argos X</strong> encerra em <strong>2 dias</strong>.</p>
      <p style="color:#475569;font-size:15px;line-height:1.6">Não perca o acesso ao seu funil de vendas, agente de IA e todas as conversas com seus leads.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#0171C3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Ativar meu plano agora</a>
      </div>
      <p style="color:#94a3b8;font-size:13px">Planos a partir de R$ 47,90/mês.</p>`,
  },
  [-1]: {
    subject: "🚨 Último dia do seu trial — ative agora!",
    body: (name, _, link) => `
      <h2 style="color:#0F172A;margin:0 0 16px">Olá, ${name}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6"><strong>Hoje é o último dia</strong> do seu período de teste no Argos X.</p>
      <p style="color:#475569;font-size:15px;line-height:1.6">Amanhã seu acesso será bloqueado. Seus dados continuam salvos, mas você não conseguirá acessar o sistema.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#DC2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Ativar antes que expire</a>
      </div>`,
  },
  [0]: {
    subject: "🔒 Seu acesso foi bloqueado — reative agora",
    body: (name, _, link) => `
      <h2 style="color:#0F172A;margin:0 0 16px">Olá, ${name}!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Seu período de teste no <strong>Argos X</strong> acabou e seu acesso foi bloqueado.</p>
      <p style="color:#475569;font-size:15px;line-height:1.6">Mas não se preocupe — <strong>seus dados continuam salvos</strong>! Escolha um plano e volte exatamente de onde parou.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#0171C3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Escolher meu plano</a>
      </div>`,
  },
  [3]: {
    subject: "📊 Seus leads ainda estão aqui — não perca!",
    body: (name, days, link) => `
      <h2 style="color:#0F172A;margin:0 0 16px">${name}, seus leads continuam esperando!</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Faz ${days} dias que seu trial expirou, mas <strong>seus leads e conversas continuam salvos</strong>.</p>
      <p style="color:#475569;font-size:15px;line-height:1.6">Reative agora e continue vendendo com:</p>
      <ul style="color:#475569;font-size:15px;line-height:1.8">
        <li>✅ Funil de vendas inteligente</li>
        <li>✅ Agente de IA 24h no WhatsApp</li>
        <li>✅ Campanhas automatizadas</li>
      </ul>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#0171C3;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Reativar agora</a>
      </div>`,
  },
  [7]: {
    subject: "⚠️ Última chance — seus dados serão removidos em breve",
    body: (name, _, link) => `
      <h2 style="color:#0F172A;margin:0 0 16px">${name}, esta é a última notificação</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6">Seu trial expirou há 7 dias. Em breve seus dados poderão ser removidos.</p>
      <p style="color:#475569;font-size:15px;line-height:1.6">Reative agora a partir de <strong>R$ 47,90/mês</strong> e mantenha tudo funcionando.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:#DC2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">Reativar minha conta</a>
      </div>`,
  },
};

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

    const cadenceDays: number[] = Array.isArray(config.cadence_days) ? config.cadence_days : [-2, -1, 0, 3, 7];

    // 1b. Fetch all cadence messages from DB
    const { data: allCadenceMessages } = await supabaseAdmin
      .from("cadence_messages")
      .select("*")
      .eq("config_id", config.id)
      .eq("is_active", true)
      .order("position", { ascending: true });

    // Group messages by day
    const messagesByDay: Record<number, any[]> = {};
    for (const msg of allCadenceMessages || []) {
      if (!messagesByDay[msg.cadence_day]) messagesByDay[msg.cadence_day] = [];
      messagesByDay[msg.cadence_day].push(msg);
    }

    // 2. Fetch workspaces with trials
    const { data: workspaces, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, trial_end, plan_type, created_by, blocked_at")
      .in("plan_type", ["trial_manual", "trialing", "blocked"])
      .not("trial_end", "is", null);

    // Also fetch active trial workspaces for engagement messages (negative days)
    // These are already included above since trial_manual/trialing covers active trials

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

      const dayMessages = messagesByDay[matchingDay];
      const hasCustomMessages = dayMessages && dayMessages.length > 0;

      // ── Send WhatsApp ──
      if (config.send_whatsapp && ownerPhone && config.whatsapp_instance_name) {
        try {
          if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
            let cleanPhone = ownerPhone.replace(/\D/g, "");
            if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
              cleanPhone = "55" + cleanPhone;
            }

            const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
            const whatsappMsgs = hasCustomMessages
              ? dayMessages.filter((m: any) => m.channel === "whatsapp")
              : null;

            if (whatsappMsgs && whatsappMsgs.length > 0) {
              // Send custom messages from DB
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

                // Wait between messages
                if (i < whatsappMsgs.length - 1) await sleep(2000);
              }
            } else {
              // Fallback to hardcoded templates
              const fallbackFn = fallbackWhatsappTemplates[matchingDay];
              const message = fallbackFn
                ? fallbackFn(ownerName, planLink, daysSinceExpiry)
                : replaceVars(config.whatsapp_template || "", vars);

              const res = await fetch(`${apiUrl}/message/sendText/${config.whatsapp_instance_name}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
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
          const emailMsgs = hasCustomMessages
            ? dayMessages.filter((m: any) => m.channel === "email" && m.message_type === "text")
            : null;

          if (emailMsgs && emailMsgs.length > 0) {
            // Use first email message content as body, with per-message subject
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
            // Fallback to hardcoded email templates
            const template = fallbackEmailTemplates[matchingDay];
            if (template) {
              const bodyHtml = template.body(ownerName, daysSinceExpiry, planLink);
              const htmlEmail = buildHtmlEmail(template.subject, bodyHtml);

              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: "Argos X <noreply@argosx.com.br>",
                  to: [ownerEmail],
                  subject: template.subject,
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
            }
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
