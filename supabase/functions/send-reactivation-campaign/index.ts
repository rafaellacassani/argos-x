import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 44 clients — phone is the unique key (dedup on phone)
const CLIENTS = [
  { name: "Andrey de Lima", plan: "Escala", price: "R$197,90", phone: "11942577287" },
  { name: "Joao Paulo", plan: "Escala", price: "R$197,90", phone: "13991120225" },
  { name: "Márcia Vitalina de Souza", plan: "Essencial", price: "R$47,90", phone: "19999773255" },
  { name: "Jardel Sant'anna", plan: "Negócio", price: "R$97,90", phone: "24992950712" },
  { name: "Júlio César Alves", plan: "Negócio", price: "R$97,90", phone: "98881202070" },
  { name: "Gecilda ferreira", plan: "Negócio", price: "R$97,90", phone: "31993163743" },
  { name: "Alielson Luis", plan: "Essencial", price: "R$47,90", phone: "13981126685" },
  { name: "Eber Martins de Campos", plan: "Essencial", price: "R$47,90", phone: "66999067766" },
  { name: "Patricia Fernandes", plan: "Essencial", price: "R$47,90", phone: "11988783335" },
  { name: "Rita de cassia Pereira", plan: "Essencial", price: "R$47,90", phone: "31999188686" },
  { name: "ELISANGELA BERNARDINO", plan: "Essencial", price: "R$47,90", phone: "17981825598" },
  { name: "Vitor Veiga Vasconcelos", plan: "Essencial", price: "R$47,90", phone: "81992512747" },
  { name: "Keren Zuriel Guimarães", plan: "Essencial", price: "R$47,90", phone: "62982876748" },
  { name: "Maria Santana", plan: "Essencial", price: "R$47,90", phone: "22981617926" },
  { name: "Cristiane Lisboa", plan: "Essencial", price: "R$47,90", phone: "15996437585" },
  { name: "MARIA DE FATIMA GOMES", plan: "Essencial", price: "R$47,90", phone: "33999085238" },
  { name: "MARCELO RATTO CAMPI", plan: "Essencial", price: "R$47,90", phone: "11964100975" },
  { name: "Jonathan Leonardo Rodrigues", plan: "Essencial", price: "R$47,90", phone: "55219703346" },
  { name: "NEILA CRISTINA BRAGA RIOS", plan: "Essencial", price: "R$47,90", phone: "61984786626" },
  { name: "JULIANA FERNANDES GOMES", plan: "Essencial", price: "R$47,90", phone: "11999793339" },
  { name: "Daniela Rosa Lourenço", plan: "Essencial", price: "R$47,90", phone: "21978872593" },
  { name: "Erick Henrique de Souza", plan: "Essencial", price: "R$47,90", phone: "21964341225" },
  { name: "Roebson Cesario", plan: "Essencial", price: "R$47,90", phone: "81982119734" },
  { name: "Wandreiguison Ferreira", plan: "Essencial", price: "R$47,90", phone: "11954660405" },
  { name: "Liberto Chaves Barboza", plan: "Essencial", price: "R$47,90", phone: "12996280422" },
  { name: "Catarina da Silva", plan: "Essencial", price: "R$47,90", phone: "21991163921" },
  { name: "Monalisa Cristina Vilela", plan: "Essencial", price: "R$47,90", phone: "35998980089" },
  { name: "Wesley Gutiery Carneiro", plan: "Essencial", price: "R$47,90", phone: "61991958147" },
  { name: "ANDREI LAURIMAR GRUBER", plan: "Essencial", price: "R$47,90", phone: "41998211838" },
  { name: "ALEXANDRO DE OLIVEIRA BELO", plan: "Essencial", price: "R$47,90", phone: "21979523421" },
  { name: "Michelle Maria de Souza", plan: "Essencial", price: "R$47,90", phone: "19199740759" },
  { name: "Juliana correa cecilio", plan: "Essencial", price: "R$47,90", phone: "34992664900" },
  { name: "JEFFERSON VICTOR GONCALVES", plan: "Essencial", price: "R$47,90", phone: "38997433523" },
  { name: "Alessandra Correa", plan: "Essencial", price: "R$47,90", phone: "16981052241" },
  { name: "JACKELINE RODRIGUES FEITOSA", plan: "Essencial", price: "R$47,90", phone: "86988320969" },
  { name: "Letícia Rodrigues", plan: "Essencial", price: "R$47,90", phone: "16993994357" },
  { name: "Jefferson Caproni", plan: "Essencial", price: "R$47,90", phone: "11967514139" },
  { name: "Ana Paula Contente", plan: "Essencial", price: "R$47,90", phone: "11949184431" },
  { name: "Wallace Sillva de Souza", plan: "Essencial", price: "R$47,90", phone: "22992676400" },
  { name: "Roberto de souza", plan: "Essencial", price: "R$47,90", phone: "21970661217" },
  { name: "Luiz Rogério Maciel", plan: "Essencial", price: "R$47,90", phone: "71987958764" },
  { name: "Bianca Mirella da Silva", plan: "Essencial", price: "R$47,90", phone: "11994039783" },
];

function getFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0];
  // Capitalize properly
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function buildMessage(firstName: string, planName: string): string {
  return `Olá, ${firstName}! 👋

Aqui é da equipe do *Argos X*.

Notamos que houve uma pendência no pagamento da sua assinatura do plano *${planName}*. Pode ter sido um problema técnico com o cartão.

Para continuar usando o Argos X sem interrupção, acesse o link abaixo e atualize seu método de pagamento:

👉 https://argosx.com.br/planos

Qualquer dúvida, é só responder aqui. Estamos aqui para ajudar! 🚀`;
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

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance name from cadence config
    const { data: config } = await supabaseAdmin
      .from("reactivation_cadence_config")
      .select("whatsapp_instance_name")
      .limit(1)
      .single();

    const instanceName = config?.whatsapp_instance_name;
    if (!instanceName) {
      return new Response(JSON.stringify({ error: "No WhatsApp instance configured in cadence config" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const batchId = `reactivation_${new Date().toISOString().slice(0, 10)}_${Date.now()}`;

    // Deduplicate by phone
    const uniquePhones = new Set<string>();
    const dedupedClients = CLIENTS.filter((c) => {
      if (uniquePhones.has(c.phone)) return false;
      uniquePhones.add(c.phone);
      return true;
    });

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results: string[] = [];

    for (const client of dedupedClients) {
      let cleanPhone = client.phone.replace(/\D/g, "");
      if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
        cleanPhone = "55" + cleanPhone;
      }

      // Check if already sent for this batch date
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabaseAdmin
        .from("reactivation_campaigns")
        .select("id")
        .eq("phone", cleanPhone)
        .gte("sent_at", `${today}T00:00:00Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        skippedCount++;
        results.push(`SKIPPED (already sent today): ${client.name} - ${cleanPhone}`);
        continue;
      }

      // Find workspace by owner phone
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .or(`phone.eq.${client.phone},personal_whatsapp.eq.${client.phone},phone.eq.55${client.phone},personal_whatsapp.eq.55${client.phone}`);

      let workspaceId: string | null = null;
      let asaasCustomerId: string | null = null;

      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          const { data: ws } = await supabaseAdmin
            .from("workspaces")
            .select("id, plan_type, blocked_at, asaas_customer_id")
            .eq("created_by", p.user_id)
            .eq("payment_provider", "asaas")
            .limit(1)
            .single();

          if (ws) {
            // Only send to non-blocked workspaces
            if (ws.blocked_at) {
              skippedCount++;
              results.push(`SKIPPED (already blocked): ${client.name} - ${ws.id}`);
              break;
            }
            workspaceId = ws.id;
            asaasCustomerId = ws.asaas_customer_id;
            break;
          }
        }
      }

      if (!workspaceId && !asaasCustomerId) {
        // Still send the message even without workspace match
        results.push(`WARN: No workspace found for ${client.name} (${client.phone}), sending anyway`);
      }

      const firstName = getFirstName(client.name);
      const message = buildMessage(firstName, `${client.plan} ${client.price}`);

      try {
        const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({ number: cleanPhone, text: message }),
        });

        const status = res.ok ? "sent" : "failed";

        await supabaseAdmin.from("reactivation_campaigns").insert({
          workspace_id: workspaceId,
          asaas_customer_id: asaasCustomerId,
          phone: cleanPhone,
          client_name: client.name,
          plan_name: `${client.plan} ${client.price}`,
          message_sent: message,
          status,
          campaign_batch: batchId,
        });

        if (res.ok) {
          sentCount++;
          results.push(`SENT: ${client.name} - ${cleanPhone}`);
        } else {
          errorCount++;
          results.push(`FAILED: ${client.name} - HTTP ${res.status}`);
        }

        // Rate limit: 2s between messages
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e: any) {
        errorCount++;
        results.push(`ERROR: ${client.name} - ${e.message}`);

        await supabaseAdmin.from("reactivation_campaigns").insert({
          workspace_id: workspaceId,
          asaas_customer_id: asaasCustomerId,
          phone: cleanPhone,
          client_name: client.name,
          plan_name: `${client.plan} ${client.price}`,
          message_sent: message,
          status: "failed",
          campaign_batch: batchId,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch: batchId,
        total: dedupedClients.length,
        sent: sentCount,
        skipped: skippedCount,
        errors: errorCount,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-reactivation-campaign] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
