import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_BASE = "https://api.asaas.com/v3";

async function asaasFetch(path: string) {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) throw new Error("ASAAS_API_KEY not set");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { "Content-Type": "application/json", access_token: apiKey },
  });
  return res.json();
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 });
  }

  const { action, subscription_ids } = await req.json();

  if (action === "check_subs") {
    const results: any[] = [];
    for (const subId of (subscription_ids || [])) {
      try {
        const sub = await asaasFetch(`/subscriptions/${subId}`);
        results.push({
          id: subId, description: sub.description, value: sub.value,
          status: sub.status, externalReference: sub.externalReference, customer: sub.customer,
        });
      } catch (e) { results.push({ id: subId, error: String(e) }); }
    }
    return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
  }

  if (action === "scan_downgraded") {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: essWs } = await supabase
      .from("workspaces")
      .select("id, name, plan_name, asaas_subscription_id, subscription_status")
      .eq("plan_name", "essencial").eq("payment_provider", "asaas")
      .not("asaas_subscription_id", "is", null);

    const mismatches: any[] = [];
    for (const ws of (essWs || [])) {
      try {
        const sub = await asaasFetch(`/subscriptions/${ws.asaas_subscription_id}`);
        if (sub.value > 50) {
          mismatches.push({
            workspace: ws.name, workspace_id: ws.id, db_plan: ws.plan_name,
            db_status: ws.subscription_status, asaas_value: sub.value,
            asaas_description: sub.description, asaas_status: sub.status,
            expected_plan: sub.value >= 190 ? "escala" : "negocio",
          });
        }
      } catch (e) { console.warn(`Error ${ws.asaas_subscription_id}:`, e); }
    }
    return new Response(JSON.stringify({ mismatches, total_checked: (essWs || []).length }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
});
