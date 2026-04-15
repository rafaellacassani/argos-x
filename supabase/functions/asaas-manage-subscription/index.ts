import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

const PLAN_CONFIGS: Record<string, any> = {
  essencial: { plan_name: "essencial", lead_limit: 300, whatsapp_limit: 1, user_limit: 1, ai_interactions_limit: 500, price: 47.90, display: "Essencial" },
  negocio: { plan_name: "negocio", lead_limit: 2000, whatsapp_limit: 3, user_limit: 1, ai_interactions_limit: 2000, price: 97.90, display: "Negócio" },
  escala: { plan_name: "escala", lead_limit: 999999, whatsapp_limit: 999, user_limit: 3, ai_interactions_limit: 10000, price: 197.90, display: "Escala" },
};

const LEAD_PACK_PRICES: Record<number, number> = {
  1000: 17,
  5000: 47,
  20000: 97,
  50000: 197,
};

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
 * Cancel all PENDING and OVERDUE payments for a given Asaas customer,
 * optionally filtering by subscription ID.
 * Returns the count of canceled payments.
 */
async function cancelOrphanPayments(
  customerId: string,
  excludeSubscriptionId?: string
): Promise<{ canceled: number; details: string[] }> {
  const details: string[] = [];
  let canceled = 0;

  for (const status of ["PENDING", "OVERDUE"]) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await asaasFetch(
        `/payments?customer=${customerId}&status=${status}&limit=100&offset=${offset}`
      );
      const payments = res.data || [];

      for (const p of payments) {
        // Skip payments belonging to the NEW subscription (keep those)
        if (excludeSubscriptionId && p.subscription === excludeSubscriptionId) {
          continue;
        }

        try {
          await asaasFetch(`/payments/${p.id}`, { method: "DELETE" });
          details.push(`Cancelado: ${p.id} (${status}, R$${p.value}, sub:${p.subscription || 'avulso'})`);
          canceled++;
        } catch (e: any) {
          details.push(`Falha ao cancelar ${p.id}: ${e.message}`);
        }
      }

      hasMore = payments.length === 100;
      offset += 100;
    }
  }

  return { canceled, details };
}

/**
 * Cancel a specific subscription in Asaas (silently ignores if already deleted).
 */
async function cancelSubscriptionSafe(subscriptionId: string): Promise<boolean> {
  try {
    await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
    console.log(`[asaas-manage] Subscription ${subscriptionId} canceled`);
    return true;
  } catch (e: any) {
    console.warn(`[asaas-manage] Delete sub ${subscriptionId} warning: ${e.message}`);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, workspaceId, plan, packSize, paymentId } = body;

    // === CANCEL ORPHAN PAYMENT (admin action, no workspace needed) ===
    if (action === "cancel_orphan_payment" && paymentId) {
      const authHeader = req.headers.get("authorization") || "";
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Não autenticado." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        await asaasFetch(`/payments/${paymentId}`, { method: "DELETE" });
        console.log(`[asaas-manage] Orphan payment ${paymentId} canceled by ${user.id}`);
        return new Response(JSON.stringify({ success: true, message: `Cobrança ${paymentId} cancelada.` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!workspaceId || !action) {
      return new Response(JSON.stringify({ error: "workspaceId e action são obrigatórios." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: get user from JWT
    const authHeader = req.headers.get("authorization") || "";
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to workspace
    const { data: member } = await supabaseAdmin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Sem acesso a este workspace." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get workspace
    const { data: workspace, error: wsError } = await supabaseAdmin
      .from("workspaces")
      .select("id, payment_provider, asaas_customer_id, asaas_subscription_id, plan_name")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Workspace não encontrado." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (workspace.payment_provider !== "asaas") {
      return new Response(JSON.stringify({ error: "Este workspace não usa Asaas como provedor de pagamento." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === UPGRADE ===
    if (action === "upgrade") {
      if (!plan || !PLAN_CONFIGS[plan]) {
        return new Response(JSON.stringify({ error: `Plano inválido: ${plan}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = PLAN_CONFIGS[plan];
      const previousPlan = workspace.plan_name;
      const previousSubId = workspace.asaas_subscription_id;

      if (!workspace.asaas_customer_id) {
        return new Response(JSON.stringify({ error: "Nenhum cliente Asaas vinculado a este workspace." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ============================================================
      // CLEAN UPGRADE LOGIC:
      // 1. Cancel ALL pending/overdue payments from old subscription
      // 2. Cancel old subscription
      // 3. Create new subscription
      // ============================================================

      let newSubId: string;

      // Step 1 & 2: Cancel old subscription and its orphan payments
      if (previousSubId) {
        console.log(`[asaas-manage] Starting clean upgrade: ${previousPlan} → ${plan}`);

        // Cancel all pending/overdue payments for this customer (except new sub)
        const orphanResult = await cancelOrphanPayments(workspace.asaas_customer_id);
        console.log(`[asaas-manage] Canceled ${orphanResult.canceled} orphan payments:`, orphanResult.details);

        // Cancel old subscription
        await cancelSubscriptionSafe(previousSubId);
      }

      // Step 3: Create new subscription
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 1);

      const newSub = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: workspace.asaas_customer_id,
          billingType: "CREDIT_CARD",
          value: config.price,
          cycle: "MONTHLY",
          nextDueDate: nextDueDate.toISOString().split("T")[0],
          description: `Argos X - Plano ${config.display}`,
          externalReference: JSON.stringify({ type: "plan", plan: config.plan_name, workspace_id: workspaceId }),
        }),
      });
      newSubId = newSub.id;
      console.log(`[asaas-manage] New subscription created: ${newSubId}`);

      // Update workspace limits immediately
      await supabaseAdmin
        .from("workspaces")
        .update({
          plan_name: config.plan_name,
          lead_limit: config.lead_limit,
          whatsapp_limit: config.whatsapp_limit,
          user_limit: config.user_limit,
          ai_interactions_limit: config.ai_interactions_limit,
          subscription_status: "active",
          plan_type: "active",
          blocked_at: null,
          asaas_subscription_id: newSubId,
        })
        .eq("id", workspaceId);

      // Log plan change history
      try {
        await supabaseAdmin.from("lead_history").insert({
          lead_id: workspaceId, // Using workspace ID for tracking
          workspace_id: workspaceId,
          action: "plan_change",
          performed_by: user.id,
          metadata: {
            from_plan: previousPlan,
            to_plan: plan,
            from_subscription: previousSubId,
            to_subscription: newSubId,
            from_price: PLAN_CONFIGS[previousPlan]?.price || null,
            to_price: config.price,
            changed_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        console.warn("[asaas-manage] Failed to log plan change:", e);
      }

      console.log(`[asaas-manage] Clean upgrade ${previousPlan} → ${plan} for workspace ${workspaceId}`);

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Plano atualizado para ${config.display}`,
        details: { from: previousPlan, to: plan, newSubscriptionId: newSubId }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LEAD PACK ===
    if (action === "lead_pack") {
      if (!packSize || !LEAD_PACK_PRICES[packSize]) {
        return new Response(JSON.stringify({ error: `Pacote inválido: ${packSize}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!workspace.asaas_customer_id) {
        return new Response(JSON.stringify({ error: "Nenhum cliente Asaas vinculado a este workspace." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const price = LEAD_PACK_PRICES[packSize];
      const externalReference = JSON.stringify({
        type: "lead_pack",
        pack_size: packSize,
        workspace_id: workspaceId,
      });

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 1);

      const subscription = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: workspace.asaas_customer_id,
          billingType: "CREDIT_CARD",
          value: price,
          cycle: "MONTHLY",
          nextDueDate: nextDueDate.toISOString().split("T")[0],
          description: `Argos X - Pacote +${packSize.toLocaleString()} leads`,
          externalReference,
        }),
      });

      await supabaseAdmin.from("lead_packs").insert({
        workspace_id: workspaceId,
        pack_size: packSize,
        price_paid: price,
        active: true,
        asaas_subscription_id: subscription.id,
      });

      const { data: allPacks } = await supabaseAdmin
        .from("lead_packs")
        .select("pack_size")
        .eq("workspace_id", workspaceId)
        .eq("active", true);
      
      const totalExtra = (allPacks || []).reduce((sum: number, p: any) => sum + p.pack_size, 0);
      await supabaseAdmin
        .from("workspaces")
        .update({ extra_leads: totalExtra })
        .eq("id", workspaceId);

      console.log(`[asaas-manage] Lead pack +${packSize} created for workspace ${workspaceId}, sub: ${subscription.id}`);

      return new Response(JSON.stringify({ success: true, message: `Pacote de +${packSize.toLocaleString()} leads contratado!` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ADD USER ===
    if (action === "add_user") {
      if (!workspace.asaas_customer_id) {
        return new Response(JSON.stringify({ error: "Nenhum cliente Asaas vinculado a este workspace." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userPrice = 47;
      const externalReference = JSON.stringify({
        type: "add_user",
        extra_users: 1,
        workspace_id: workspaceId,
      });

      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + 1);

      await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: workspace.asaas_customer_id,
          billingType: "CREDIT_CARD",
          value: userPrice,
          cycle: "MONTHLY",
          nextDueDate: nextDueDate.toISOString().split("T")[0],
          description: `Argos X - Usuário adicional (${workspace.plan_name || 'plano'})`,
          externalReference,
        }),
      });

      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("user_limit")
        .eq("id", workspaceId)
        .single();

      const newLimit = (ws?.user_limit || 1) + 1;
      await supabaseAdmin
        .from("workspaces")
        .update({ user_limit: newLimit })
        .eq("id", workspaceId);

      console.log(`[asaas-manage] Add user for workspace ${workspaceId}, new limit: ${newLimit}`);

      return new Response(JSON.stringify({ success: true, message: `Usuário adicional contratado! Novo limite: ${newLimit}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === AUDIT ORPHAN PAYMENTS (admin-only) ===
    if (action === "audit_orphans") {
      if (!workspace.asaas_customer_id) {
        return new Response(JSON.stringify({ error: "Nenhum cliente Asaas vinculado." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const orphans: any[] = [];
      for (const status of ["PENDING", "OVERDUE"]) {
        const res = await asaasFetch(
          `/payments?customer=${workspace.asaas_customer_id}&status=${status}&limit=100`
        );
        for (const p of (res.data || [])) {
          if (p.subscription !== workspace.asaas_subscription_id) {
            orphans.push({
              paymentId: p.id,
              status: p.status,
              value: p.value,
              dueDate: p.dueDate,
              description: p.description,
              subscription: p.subscription,
            });
          }
        }
      }

      return new Response(JSON.stringify({ 
        workspace: workspace.id,
        currentPlan: workspace.plan_name,
        currentSubscription: workspace.asaas_subscription_id,
        orphanPayments: orphans,
        orphanCount: orphans.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[asaas-manage] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
