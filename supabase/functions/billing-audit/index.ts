import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customerIds } = await req.json();
    if (!customerIds || !Array.isArray(customerIds)) {
      return new Response(JSON.stringify({ error: "customerIds array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const cid of customerIds) {
      const customerOrphans: any[] = [];
      
      for (const status of ["PENDING", "OVERDUE"]) {
        const res = await asaasFetch(`/payments?customer=${cid}&status=${status}&limit=100`);
        for (const p of (res.data || [])) {
          customerOrphans.push({
            paymentId: p.id,
            status: p.status,
            value: p.value,
            dueDate: p.dueDate,
            description: p.description,
            subscription: p.subscription,
          });
        }
      }

      // Also get active subscriptions
      const subs = await asaasFetch(`/subscriptions?customer=${cid}&limit=50`);
      const activeSubs = (subs.data || []).filter((s: any) => s.status === "ACTIVE");

      results.push({
        customerId: cid,
        pendingPayments: customerOrphans,
        activeSubscriptions: activeSubs.map((s: any) => ({
          id: s.id,
          value: s.value,
          description: s.description,
          status: s.status,
          nextDueDate: s.nextDueDate,
        })),
      });
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
