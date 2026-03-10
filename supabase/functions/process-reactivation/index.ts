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

const preExpiryTemplates: Record<number, { subject: string; body: (name: string, days: number, link: string) => string }> = {
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

const whatsappTemplates: Record<number, (name: string, link: string) => string> = {
  [-2]: (name, link) => `Olá, ${name}! ⏳\n\nSeu trial no *Argos X* acaba em *2 dias*.\n\nAtive seu plano para não perder o acesso:\n👉 ${link}\n\nPlanos a partir de R$ 47,90/mês.`,
  [-1]: (name, link) => `🚨 ${name}, *último dia* do seu trial no Argos X!\n\nAmanhã seu acesso será bloqueado.\n\nAtive agora:\n👉 ${link}`,
  [0]: (name, link) => `🔒 ${name}, seu acesso ao *Argos X* foi bloqueado.\n\nMas seus dados estão salvos! Escolha um plano e continue de onde parou:\n👉 ${link}`,
  [3]: (name, link) => `📊 ${name}, seus leads continuam esperando!\n\nReative sua conta no Argos X:\n👉 ${link}\n\nPlanos a partir de R$ 47,90/mês.`,
  [7]: (name, link) => `⚠️ ${name}, última chance!\n\nSeu trial expirou há 7 dias. Reative agora antes que seus dados sejam removidos:\n👉 ${link}`,
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

    const cadenceDays: number[] = Array.isArray(config.cadence_days) ? config.cadence_days : [-2, -1, 0, 3, 7];

    // 2. Fetch workspaces with trials (active or expired)
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
      // Days relative to expiration: negative = before, 0 = day of, positive = after
      const daysFromExpiry = Math.round((now.getTime() - trialEnd.getTime()) / 86400000);

      // Check if today matches any cadence day
      const matchingDay = cadenceDays.find((d) => d === daysFromExpiry);
      if (matchingDay === undefined) continue;

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
      const daysSinceExpiry = Math.max(0, daysFromExpiry);
      const planLink = "https://argosx.com.br/auth";

      // Send Email
      if (config.send_email && ownerEmail) {
        try {
          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (RESEND_API_KEY) {
            const template = preExpiryTemplates[matchingDay];
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

            const whatsappFn = whatsappTemplates[matchingDay];
            const message = whatsappFn
              ? whatsappFn(ownerName, planLink)
              : config.whatsapp_template
                  .replace(/{nome}/g, ownerName)
                  .replace(/{link}/g, planLink)
                  .replace(/{dias_expirado}/g, String(daysSinceExpiry));

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
