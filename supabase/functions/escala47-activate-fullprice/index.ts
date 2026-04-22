import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const PROMO_CAMPAIGN = "escala_47";
const FULL_VALUE = 197.90;
const PROMO_DAYS = 30;

async function asaasFetch(path: string, options: RequestInit = {}) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Asaas API error:", JSON.stringify(data));
    throw new Error(data.errors?.[0]?.description || `Asaas error: ${res.status}`);
  }
  return data;
}

/**
 * Cron diário: encontra workspaces na promo "escala_47" cujo período de 30 dias
 * já expirou e atualiza a assinatura no Asaas para o valor cheio (R$197,90).
 * Remove a flag is_promo_trial liberando o downgrade.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Encontra workspaces na promo cujo lock já expirou
    const { data: pendingWorkspaces, error } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, asaas_subscription_id, promo_starts_at, promo_locked_until")
      .eq("promo_campaign", PROMO_CAMPAIGN)
      .eq("is_promo_trial", true)
      .lte("promo_locked_until", now);

    if (error) throw error;

    const results: any[] = [];
    let activated = 0;
    let failed = 0;

    for (const ws of pendingWorkspaces || []) {
      try {
        if (!ws.asaas_subscription_id) {
          results.push({ workspace_id: ws.id, status: "skipped", reason: "no asaas_subscription_id" });
          continue;
        }

        // Atualiza valor da assinatura no Asaas para o preço cheio
        await asaasFetch(`/subscriptions/${ws.asaas_subscription_id}`, {
          method: "POST",
          body: JSON.stringify({
            value: FULL_VALUE,
            description: `Argos X - Plano Escala`,
            updatePendingPayments: true,
          }),
        });

        // Libera o lock no workspace
        await supabaseAdmin
          .from("workspaces")
          .update({ is_promo_trial: false })
          .eq("id", ws.id);

        activated++;
        results.push({ workspace_id: ws.id, name: ws.name, status: "activated", new_value: FULL_VALUE });
        console.log(`[escala47-activate] Workspace ${ws.id} migrated to full price R$${FULL_VALUE}`);
      } catch (e: any) {
        failed++;
        results.push({ workspace_id: ws.id, status: "failed", error: e.message });
        console.error(`[escala47-activate] Failed workspace ${ws.id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: (pendingWorkspaces || []).length,
      activated,
      failed,
      results,
      ranAt: now,
      promoDays: PROMO_DAYS,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[escala47-activate] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});