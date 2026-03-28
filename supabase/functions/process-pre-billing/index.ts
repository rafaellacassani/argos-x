import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const STRIPE_PORTAL_URL = "https://billing.stripe.com/p/login/5kQcN7a4y2yX8x7bCe2sM00";

const PLAN_NAMES: Record<string, string> = {
  essencial: "Essencial",
  negocio: "Negócio",
  escala: "Escala",
};

const PLAN_PRICES: Record<string, string> = {
  essencial: "97,90",
  negocio: "197,90",
  escala: "497,90",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function replaceVariables(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

async function sendEmail(to: string, subject: string, body: string): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Argos X <noreply@argosx.com.br>",
        to: [to],
        subject,
        text: body,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data?.message || JSON.stringify(data) };
    }
    return { id: data.id };
  } catch (err: any) {
    return { error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[pre-billing] Starting pre-billing email check...");

    // 1. Load active configs
    const { data: configs } = await supabase
      .from("pre_billing_cadence_config")
      .select("*")
      .eq("ativo", true);

    if (!configs || configs.length === 0) {
      console.log("[pre-billing] No active configs found.");
      return new Response(JSON.stringify({ message: "No active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const configMap: Record<string, any> = {};
    for (const c of configs) {
      configMap[c.email_type] = c;
    }

    // 2. Get today's date at midnight UTC
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Calculate target dates
    const d3Date = new Date(now);
    d3Date.setDate(d3Date.getDate() + 3);
    const d3Str = d3Date.toISOString().split("T")[0];

    const d1Date = new Date(now);
    d1Date.setDate(d1Date.getDate() + 1);
    const d1Str = d1Date.toISOString().split("T")[0];

    console.log(`[pre-billing] Today: ${todayStr}, D-3 targets trial_end=${d3Str}, D-1 targets trial_end=${d1Str}, Dia cobrança targets trial_end=${todayStr}`);

    // 3. Get workspaces in trial with trial_end matching each scenario
    const targetDates = new Set<string>();
    if (configMap.d3) targetDates.add(d3Str);
    if (configMap.d1) targetDates.add(d1Str);
    if (configMap.dia_cobranca) targetDates.add(todayStr);

    if (targetDates.size === 0) {
      return new Response(JSON.stringify({ message: "No applicable dates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all workspaces with trial ending on any of these dates
    const { data: workspaces } = await supabase
      .from("workspaces")
      .select("id, name, plan_type, trial_end, subscription_status, stripe_customer_id, created_by")
      .in("subscription_status", ["trialing", "trial"]);

    if (!workspaces || workspaces.length === 0) {
      console.log("[pre-billing] No workspaces in trial.");
      return new Response(JSON.stringify({ message: "No trial workspaces", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const ws of workspaces) {
      if (!ws.trial_end) continue;
      const trialEndStr = new Date(ws.trial_end).toISOString().split("T")[0];

      // Determine which emails to send
      const emailsToSend: { emailType: string; tipoEmail: string }[] = [];
      if (configMap.d3 && trialEndStr === d3Str) {
        emailsToSend.push({ emailType: "d3", tipoEmail: "pre_cobranca_d3" });
      }
      if (configMap.d1 && trialEndStr === d1Str) {
        emailsToSend.push({ emailType: "d1", tipoEmail: "pre_cobranca_d1" });
      }
      if (configMap.dia_cobranca && trialEndStr === todayStr) {
        emailsToSend.push({ emailType: "dia_cobranca", tipoEmail: "cobranca_confirmada" });
      }

      if (emailsToSend.length === 0) continue;

      // Get owner info
      const { data: owner } = await supabase
        .from("user_profiles")
        .select("full_name, email, id")
        .eq("id", ws.created_by)
        .single();

      if (!owner || !owner.email) {
        console.log(`[pre-billing] No owner email for workspace ${ws.id}`);
        continue;
      }

      const portalUrl = STRIPE_PORTAL_URL;
      const planName = PLAN_NAMES[ws.plan_type] || ws.plan_type || "Essencial";
      const planPrice = PLAN_PRICES[ws.plan_type] || "97,90";
      const trialEndFormatted = new Date(ws.trial_end).toLocaleDateString("pt-BR");

      // Next renewal = trial_end + 30 days
      const nextRenewal = new Date(ws.trial_end);
      nextRenewal.setDate(nextRenewal.getDate() + 30);

      const vars: Record<string, string> = {
        "{nome}": owner.full_name || "Cliente",
        "{data_vencimento}": trialEndFormatted,
        "{nome_plano}": planName,
        "{valor_plano}": planPrice,
        "{proxima_data_renovacao}": nextRenewal.toLocaleDateString("pt-BR"),
        "{data_cobranca}": new Date().toLocaleDateString("pt-BR"),
        "{link_cancelamento}": portalUrl,
        "{link_gerenciar_assinatura}": portalUrl,
      };

      for (const { emailType, tipoEmail } of emailsToSend) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("pre_billing_email_logs")
          .select("id")
          .eq("workspace_id", ws.id)
          .eq("tipo_email", tipoEmail)
          .gte("timestamp_envio", todayStr + "T00:00:00Z")
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[pre-billing] Already sent ${tipoEmail} to workspace ${ws.id} today`);
          continue;
        }

        const config = configMap[emailType];
        const subject = replaceVariables(config.assunto, vars);
        const body = replaceVariables(config.corpo, vars);

        const result = await sendEmail(owner.email, subject, body);

        // Log
        await supabase.from("pre_billing_email_logs").insert({
          workspace_id: ws.id,
          user_id: owner.id,
          tipo_email: tipoEmail,
          status_entrega: result.error ? "falha" : "enviado",
          resend_message_id: result.id || null,
          error_message: result.error || null,
        });

        if (result.error) {
          console.error(`[pre-billing] Failed ${tipoEmail} for ${owner.email}: ${result.error}`);
          totalFailed++;
        } else {
          console.log(`[pre-billing] ✅ Sent ${tipoEmail} to ${owner.email}`);
          totalSent++;
        }
      }
    }

    console.log(`[pre-billing] Done. Sent: ${totalSent}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pre-billing] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
