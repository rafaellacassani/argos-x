import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

// Cobranças vencidas (workspace_id válidos no Argos X)
const OVERDUE = [
  { workspace_id: "cd80423b-dbf0-4960-a78d-194926a1e560", payment_id: "793390769", valor: 197.9, descricao: "Plano Escala", nome: "Fabiano Massaneiro", celular: "47899942425" },
  { workspace_id: "9df5640c-2814-4e58-accb-749502dbdc63", payment_id: "793056417", valor: 17.0, descricao: "Pacote +1.000 leads", nome: "Derzelay dos Santos", celular: "92984184838" },
  { workspace_id: "51bc9d66-7bf4-4e63-9878-b91a23425b67", payment_id: "792759737", valor: 97.9, descricao: "Plano Negócio", nome: "Maria de Fátima Gomes", celular: "33999085238" },
  { workspace_id: "69d59b2a-111e-4ad2-be67-72dc37a05f43", payment_id: "792351938", valor: 47.9, descricao: "Plano Essencial", nome: "Thaillenso Cardoso", celular: "91981741235" },
  { workspace_id: "c34066f5-787f-41f7-be4d-de41e80c2d23", payment_id: "791523844", valor: 17.0, descricao: "Pacote +1.000 leads", nome: "Nivianne Alves Miranda", celular: "21978590397" },
  { workspace_id: "21ef1850-1758-4ceb-b316-ea13b6f04059", payment_id: "791230710", valor: 97.9, descricao: "Plano Negócio", nome: "Marcelo Gonçalves Bento", celular: "22998299187" },
  { workspace_id: "ca6fd305-6c00-4575-907d-b0c3e9664b14", payment_id: "790688340", valor: 97.0, descricao: "Pacote +20.000 leads", nome: "Márcia Vitalina de Souza", celular: "19999773255" },
  { workspace_id: "a12b7754-6da4-417f-8e4d-9ac6a835699f", payment_id: "790514680", valor: 17.0, descricao: "Pacote +1.000 leads", nome: "Djalma da Silva", celular: "11986046163" },
  { workspace_id: "07b660f4-c20a-47f6-b39b-fb4676009db3", payment_id: "789897456", valor: 197.0, descricao: "Pacote +50.000 leads", nome: "João Paulo", celular: "13991120225" },
  { workspace_id: "a7bcbec1-66d4-4ec6-a223-d26bfb220105", payment_id: "789605841", valor: 197.9, descricao: "Plano Escala", nome: "Felipe Hendrel", celular: "11956516893" },
  { workspace_id: "01fea310-7e2e-40b1-a948-33e1e5ea4bd4", payment_id: "789356541", valor: 197.9, descricao: "Plano Escala", nome: "Enio Ribeiro", celular: "67998119205" },
];

function getFirstName(s: string): string {
  const p = (s || "").trim().split(/\s+/)[0] || "Cliente";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function buildMessage(firstName: string, descricao: string, valor: number, link: string): string {
  const valorFmt = valor.toFixed(2).replace(".", ",");
  return `Olá, ${firstName}! 💙

Aqui é da equipe do *Argos X*. Tudo bem?

Notamos que sua cobrança do *${descricao}* (R$ ${valorFmt}) está em aberto. Sabemos que imprevistos acontecem e queremos te ajudar a regularizar isso ainda *hoje*, sem complicação. 🚀

✅ Mantenha seus *Agentes de IA ativos* respondendo seus clientes 24h
✅ Continue com o *controle do seu WhatsApp* e leads em um só lugar
✅ Sem perder histórico, conexões ou configurações

💳 *Pague em poucos cliques pelo link abaixo:*
${link}

⚡ *Agora aceitamos PIX (aprovação na hora) e Cartão de Crédito!*
Escolha a forma que for melhor pra você.

Qualquer dúvida, é só responder aqui — nosso time está pronto pra te ajudar. 🤝

Equipe Argos X`;
}

async function asaasGet(path: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "Content-Type": "application/json", access_token: apiKey },
  });
  const text = await res.text();
  if (!text) return { _empty: true, _status: res.status };
  try { return JSON.parse(text); } catch { return { _parse_error: true, _raw: text.slice(0, 200), _status: res.status }; }
}

async function asaasUpdateBilling(paymentId: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) return null;
  // Force billingType UNDEFINED so customer can choose PIX or Card on the invoice page
  try {
    const res = await fetch(`${ASAAS_BASE}/payments/${paymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify({ billingType: "UNDEFINED" }),
    });
    const t = await res.text();
    try { return t ? JSON.parse(t) : null; } catch { return null; }
  } catch {
    return null;
  }
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

    const EVO_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVO_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVO_URL || !EVO_KEY) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional flags via query params:
    //   ?dryRun=1    -> preview only
    //   ?only=ID,ID  -> filter to specific payment_id(s)
    let dryRun = false;
    let onlyIds: string[] | null = null;
    const url = new URL(req.url);
    if (url.searchParams.get("dryRun") === "1" || url.searchParams.get("dryRun") === "true") {
      dryRun = true;
    }
    const onlyParam = url.searchParams.get("only");
    if (onlyParam) {
      onlyIds = onlyParam.split(",").map((s) => s.trim()).filter(Boolean);
    }
    try {
      const text = await req.text();
      if (text) {
        const body = JSON.parse(text);
        if (body?.dryRun) dryRun = true;
        if (Array.isArray(body?.only)) onlyIds = body.only.map(String);
      }
    } catch {}

    // Pick instance for sending (cadence config)
    const { data: cfg } = await supabaseAdmin
      .from("reactivation_cadence_config")
      .select("whatsapp_instance_name")
      .limit(1)
      .single();
    const instanceName = cfg?.whatsapp_instance_name;
    if (!instanceName) {
      return new Response(JSON.stringify({ error: "No WhatsApp instance configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = EVO_URL.replace(/\/+$/, "");
    const batchId = `overdue_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;
    const results: any[] = [];
    let sent = 0, failed = 0, skipped = 0;

    const targetList = onlyIds ? OVERDUE.filter((o) => onlyIds!.includes(o.payment_id)) : OVERDUE;
    for (const item of targetList) {
      // 1. Fetch payment from Asaas to get invoiceUrl
      const payment = await asaasGet(`/payments/${item.payment_id}`);
      if (!payment || payment.errors) {
        results.push({ ...item, status: "skipped_no_payment", error: payment?.errors });
        skipped++;
        continue;
      }

      // 2. Skip if already paid
      if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status)) {
        results.push({ ...item, status: "skipped_already_paid", asaas_status: payment.status });
        skipped++;
        continue;
      }

      // 3. Force UNDEFINED billing type to allow PIX + Card choice on invoice page
      await asaasUpdateBilling(item.payment_id);

      const link = payment.invoiceUrl || `https://www.asaas.com/i/${item.payment_id}`;
      const firstName = getFirstName(item.nome);
      const text = buildMessage(firstName, item.descricao, item.valor, link);

      // 4. Normalize phone
      let phone = String(item.celular).replace(/\D/g, "");
      if (phone.length >= 10 && !phone.startsWith("55")) phone = "55" + phone;

      if (dryRun) {
        results.push({ ...item, status: "dry_run", link, preview: text.slice(0, 120) });
        continue;
      }

      // 5. Send via Evolution
      try {
        const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_KEY },
          body: JSON.stringify({ number: phone, text }),
        });
        const ok = res.ok;

        await supabaseAdmin.from("reactivation_campaigns").insert({
          workspace_id: item.workspace_id,
          phone,
          client_name: item.nome,
          plan_name: `${item.descricao} R$ ${item.valor.toFixed(2)}`,
          message_sent: text,
          status: ok ? "sent" : "failed",
          campaign_batch: batchId,
        });

        if (ok) { sent++; results.push({ ...item, status: "sent", phone, link }); }
        else { failed++; results.push({ ...item, status: "failed", http: res.status }); }

        await new Promise((r) => setTimeout(r, 2500));
      } catch (e: any) {
        failed++;
        results.push({ ...item, status: "error", error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        batch: batchId,
        total: OVERDUE.length,
        sent, failed, skipped,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[send-overdue-payment-links] Error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});