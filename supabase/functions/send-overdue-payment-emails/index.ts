import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

// Lista alinhada com send-overdue-payment-links + e-mail do admin do workspace
const OVERDUE = [
  { workspace_id: "cd80423b-dbf0-4960-a78d-194926a1e560", payment_id: "793390769", valor: 197.9, descricao: "Plano Escala", nome: "Fabiano Massaneiro", email: "contato@fabianoadvogado.adv.br" },
  { workspace_id: "9df5640c-2814-4e58-accb-749502dbdc63", payment_id: "793056417", valor: 17.0, descricao: "Pacote +1.000 leads", nome: "Derzelay dos Santos", email: "derzelay.santos@gmail.com" },
  { workspace_id: "51bc9d66-7bf4-4e63-9878-b91a23425b67", payment_id: "792759737", valor: 97.9, descricao: "Plano Negócio", nome: "Maria de Fátima Gomes", email: "florbellags@hotmail.com" },
  { workspace_id: "69d59b2a-111e-4ad2-be67-72dc37a05f43", payment_id: "792351938", valor: 47.9, descricao: "Plano Essencial", nome: "Thaillenso Cardoso", email: "obr.thaillenson777@gmail.com" },
  { workspace_id: "c34066f5-787f-41f7-be4d-de41e80c2d23", payment_id: "791523844", valor: 17.0, descricao: "Pacote +1.000 leads", nome: "Nivianne Alves Miranda", email: "niviannealves@gmail.com" },
  { workspace_id: "21ef1850-1758-4ceb-b316-ea13b6f04059", payment_id: "791230710", valor: 97.9, descricao: "Plano Negócio", nome: "Marcelo Gonçalves Bento", email: "alpino.sapory@proton.me" },
  { workspace_id: "ca6fd305-6c00-4575-907d-b0c3e9664b14", payment_id: "790688340", valor: 97.0, descricao: "Pacote +20.000 leads", nome: "Márcia Vitalina de Souza", email: "dimitri.1@terra.com.br" },
  { workspace_id: "07b660f4-c20a-47f6-b39b-fb4676009db3", payment_id: "789897456", valor: 197.0, descricao: "Pacote +50.000 leads", nome: "João Paulo", email: "jotape.ceo7@gmail.com" },
  { workspace_id: "a7bcbec1-66d4-4ec6-a223-d26bfb220105", payment_id: "789605841", valor: 197.9, descricao: "Plano Escala", nome: "Felipe Hendrel", email: "felipehendrel@gmail.com" },
  { workspace_id: "01fea310-7e2e-40b1-a948-33e1e5ea4bd4", payment_id: "789356541", valor: 197.9, descricao: "Plano Escala", nome: "Enio Ribeiro", email: "enioademicon@icloud.com" },
];

function firstName(s: string) {
  const p = (s || "").trim().split(/\s+/)[0] || "Cliente";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function buildHtml(name: string, descricao: string, valor: number, link: string) {
  const valorFmt = valor.toFixed(2).replace(".", ",");
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Regularize sua assinatura - Argos X</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;color:#fff;">
          <div style="font-size:13px;opacity:.85;letter-spacing:1px;text-transform:uppercase;">Argos X</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px;">Vamos manter sua operação no ar 💙</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:16px;margin:0 0 14px;">Olá, <strong>${name}</strong>!</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
            Notamos que sua cobrança do <strong>${descricao}</strong> no valor de
            <strong>R$ ${valorFmt}</strong> está em aberto. Sabemos que imprevistos acontecem — e queremos te ajudar a regularizar isso ainda <strong>hoje</strong>, sem complicação.
          </p>
          <ul style="font-size:15px;line-height:1.7;padding-left:18px;margin:0 0 22px;color:#334155;">
            <li>Mantenha seus <strong>Agentes de IA ativos</strong> respondendo seus clientes 24h</li>
            <li>Continue com o <strong>controle do seu WhatsApp</strong> e leads em um só lugar</li>
            <li>Sem perder histórico, conexões ou configurações</li>
          </ul>
          <div style="text-align:center;margin:28px 0;">
            <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 28px;border-radius:10px;">
              💳 Regularizar agora
            </a>
          </div>
          <div style="background:#f1f5ff;border:1px solid #e0e7ff;border-radius:10px;padding:14px 16px;font-size:14px;color:#3730a3;margin-bottom:18px;">
            ⚡ <strong>Novidade:</strong> agora aceitamos <strong>PIX (aprovação na hora)</strong> e <strong>Cartão de Crédito</strong>. Escolha a forma que for melhor pra você no link acima.
          </div>
          <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 6px;">
            Se preferir copiar o link: <br>
            <a href="${link}" style="color:#4f46e5;word-break:break-all;">${link}</a>
          </p>
          <p style="font-size:14px;color:#475569;line-height:1.6;margin:22px 0 0;">
            Qualquer dúvida, é só responder este e-mail — nosso time está pronto pra te ajudar. 🤝
          </p>
          <p style="font-size:14px;color:#1a1a2e;margin:18px 0 0;"><strong>Equipe Argos X</strong></p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;font-size:12px;color:#94a3b8;text-align:center;">
          Este e-mail foi enviado porque há uma cobrança em aberto vinculada à sua conta Argos X.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function asaasGet(path: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "Content-Type": "application/json", access_token: apiKey },
  });
  const t = await res.text();
  try { return t ? JSON.parse(t) : null; } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let dryRun = false;
    let onlyIds: string[] | null = null;
    const url = new URL(req.url);
    if (["1", "true"].includes(url.searchParams.get("dryRun") || "")) dryRun = true;
    const onlyParam = url.searchParams.get("only");
    if (onlyParam) onlyIds = onlyParam.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const txt = await req.text();
      if (txt) {
        const body = JSON.parse(txt);
        if (body?.dryRun) dryRun = true;
        if (Array.isArray(body?.only)) onlyIds = body.only.map(String);
      }
    } catch {}

    const batchId = `overdue_email_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const targetList = onlyIds ? OVERDUE.filter((o) => onlyIds!.includes(o.payment_id)) : OVERDUE;
    const results: any[] = [];
    let sent = 0, failed = 0, skipped = 0;

    for (const item of targetList) {
      const payment = await asaasGet(`/payments/${item.payment_id}`);
      if (!payment || payment.errors) {
        results.push({ ...item, status: "skipped_no_payment" });
        skipped++;
        continue;
      }
      if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status)) {
        results.push({ ...item, status: "skipped_already_paid" });
        skipped++;
        continue;
      }

      const link = payment.invoiceUrl || `https://www.asaas.com/i/${item.payment_id}`;
      const fname = firstName(item.nome);
      const html = buildHtml(fname, item.descricao, item.valor, link);
      const subject = `${fname}, regularize sua assinatura Argos X em poucos cliques 💙`;

      if (dryRun) {
        results.push({ ...item, status: "dry_run", link });
        continue;
      }

      try {
        const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "Argos X <financeiro@argosx.com.br>",
            to: [item.email],
            subject,
            html,
          }),
        });
        const body = await res.json().catch(() => ({}));
        const ok = res.ok && !body?.error;

        await supabaseAdmin.from("reactivation_campaigns").insert({
          workspace_id: item.workspace_id,
          phone: item.email, // reaproveita coluna como destinatário
          client_name: item.nome,
          plan_name: `[EMAIL] ${item.descricao} R$ ${item.valor.toFixed(2)}`,
          message_sent: subject,
          status: ok ? "sent" : "failed",
          campaign_batch: batchId,
        });

        if (ok) { sent++; results.push({ ...item, status: "sent", link }); }
        else { failed++; results.push({ ...item, status: "failed", error: body }); }

        await new Promise((r) => setTimeout(r, 800));
      } catch (e: any) {
        failed++;
        results.push({ ...item, status: "error", error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, dryRun, batch: batchId, total: targetList.length, sent, failed, skipped, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-overdue-payment-emails] Error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});