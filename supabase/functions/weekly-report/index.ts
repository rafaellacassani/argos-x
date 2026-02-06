import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const app = new Hono().basePath("/weekly-report");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/manager\/?$/, "") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(instanceName: string, phone: string, message: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("[weekly-report] Evolution API not configured");
    return false;
  }

  try {
    const cleanPhone = phone.replace(/\D/g, "");
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
        delay: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[weekly-report] Failed to send message: ${error}`);
      return false;
    }

    console.log(`[weekly-report] Message sent to ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error("[weekly-report] Error sending message:", error);
    return false;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// Main weekly report endpoint - should be called by cron or authenticated user
app.post("/", async (c) => {
  try {
    // Auth: Accept service role key or authenticated user
    const authHeader = c.req.header("authorization") || "";
    const apiKey = c.req.header("apikey") || "";
    const isServiceRole = apiKey === SUPABASE_SERVICE_ROLE_KEY;
    
    if (!isServiceRole) {
      if (!authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401, corsHeaders);
      }
      const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await authClient.auth.getClaims(token);
      if (error || !data?.claims) {
        return c.json({ error: "Unauthorized" }, 401, corsHeaders);
      }
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getHours();

    console.log(`[weekly-report] Running at day ${currentDay}, hour ${currentHour}`);

    // 1. Get managers with weekly report enabled for this day/hour
    const { data: settings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("user_id, weekly_report_day, weekly_report_hour")
      .eq("notify_weekly_report", true)
      .eq("weekly_report_day", currentDay)
      .eq("weekly_report_hour", currentHour);

    if (settingsError) throw settingsError;

    if (!settings || settings.length === 0) {
      console.log("[weekly-report] No reports scheduled for now");
      return c.json({ message: "No reports scheduled" }, 200, corsHeaders);
    }

    // 2. Get manager profiles and verify role
    const userIds = settings.map((s) => s.user_id);

    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from("user_profiles").select("*").in("user_id", userIds),
      supabase.from("user_roles").select("*").in("user_id", userIds).eq("role", "manager"),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const profiles = profilesResult.data || [];
    const managerUserIds = (rolesResult.data || []).map((r) => r.user_id);

    // Filter to only managers
    const managers = profiles.filter((p) => managerUserIds.includes(p.user_id) && p.phone);

    if (managers.length === 0) {
      console.log("[weekly-report] No managers with phone for this schedule");
      return c.json({ message: "No managers to notify" }, 200, corsHeaders);
    }

    // 3. Get first WhatsApp instance
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .limit(1);

    if (!instances || instances.length === 0) {
      console.log("[weekly-report] No WhatsApp instance configured");
      return c.json({ message: "No WhatsApp instance" }, 200, corsHeaders);
    }

    const instanceName = instances[0].instance_name;

    // 4. Calculate date range (last 7 days)
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 5. Fetch all data for the report
    const [salesResult, leadsResult, stagesResult, sellersResult] = await Promise.all([
      // Sales in the period
      supabase
        .from("lead_sales")
        .select("id, lead_id, product_name, value, created_at, leads(responsible_user)")
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString()),
      
      // Leads created in the period
      supabase
        .from("leads")
        .select("id, name, source, responsible_user, stage_id, created_at")
        .gte("created_at", weekStart.toISOString()),
      
      // Win stages to identify conversions
      supabase
        .from("funnel_stages")
        .select("id")
        .eq("is_win_stage", true),
      
      // All sellers
      supabase
        .from("user_profiles")
        .select("id, full_name, user_id")
        .in(
          "user_id",
          (await supabase.from("user_roles").select("user_id").eq("role", "seller")).data?.map(
            (r) => r.user_id
          ) || []
        ),
    ]);

    const sales = salesResult.data || [];
    const leads = leadsResult.data || [];
    const winStageIds = (stagesResult.data || []).map((s) => s.id);
    const sellers = sellersResult.data || [];

    // 6. Calculate metrics
    const totalSalesValue = sales.reduce((sum, s) => sum + Number(s.value || 0), 0);
    const newLeadsCount = leads.length;
    
    // Product ranking
    const productCounts: Record<string, { count: number; value: number }> = {};
    for (const sale of sales) {
      const name = sale.product_name;
      if (!productCounts[name]) {
        productCounts[name] = { count: 0, value: 0 };
      }
      productCounts[name].count++;
      productCounts[name].value += Number(sale.value || 0);
    }
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 5);

    // Source ranking
    const sourceCounts: Record<string, number> = {};
    for (const lead of leads) {
      const source = lead.source || "Desconhecido";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
    const sourceRanking = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

    // Seller ranking by sales value
    const sellerSales: Record<string, { name: string; value: number; count: number }> = {};
    for (const sale of sales) {
      const leadData = sale.leads as any;
      const responsibleUser = leadData?.responsible_user;
      if (responsibleUser) {
        const seller = sellers.find((s) => s.id === responsibleUser);
        if (seller) {
          if (!sellerSales[seller.id]) {
            sellerSales[seller.id] = { name: seller.full_name, value: 0, count: 0 };
          }
          sellerSales[seller.id].value += Number(sale.value || 0);
          sellerSales[seller.id].count++;
        }
      }
    }
    const sellerRanking = Object.values(sellerSales).sort((a, b) => b.value - a.value);
    const topSellers = sellerRanking.slice(0, 3);
    const bottomSellers = sellerRanking.slice(-3).reverse();

    // Conversion rate
    const convertedLeads = leads.filter((l) => winStageIds.includes(l.stage_id));
    const conversionRate = newLeadsCount > 0 
      ? ((convertedLeads.length / newLeadsCount) * 100).toFixed(1)
      : "0";

    // 7. Build report message
    const reportLines = [
      "📊 *RELATÓRIO SEMANAL DE VENDAS*",
      `📅 Período: ${weekStart.toLocaleDateString("pt-BR")} a ${weekEnd.toLocaleDateString("pt-BR")}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      "💰 *RESUMO FINANCEIRO*",
      `• Valor total vendido: ${formatCurrency(totalSalesValue)}`,
      `• Número de vendas: ${sales.length}`,
      "",
      "👥 *LEADS*",
      `• Novos leads: ${newLeadsCount}`,
      `• Taxa de conversão: ${conversionRate}%`,
      "",
    ];

    if (topSellers.length > 0) {
      reportLines.push("🏆 *TOP 3 VENDEDORES*");
      topSellers.forEach((s, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
        reportLines.push(`${medal} ${s.name}: ${formatCurrency(s.value)} (${s.count} vendas)`);
      });
      reportLines.push("");
    }

    if (bottomSellers.length > 0 && sellerRanking.length > 3) {
      reportLines.push("⚠️ *PRECISAM MELHORAR*");
      bottomSellers.forEach((s) => {
        reportLines.push(`• ${s.name}: ${formatCurrency(s.value)}`);
      });
      reportLines.push("");
    }

    if (topProducts.length > 0) {
      reportLines.push("🛍️ *TOP 5 PRODUTOS*");
      topProducts.forEach(([name, data], i) => {
        reportLines.push(`${i + 1}. ${name}: ${data.count}x (${formatCurrency(data.value)})`);
      });
      reportLines.push("");
    }

    if (sourceRanking.length > 0) {
      reportLines.push("📍 *FONTES DE LEADS*");
      sourceRanking.slice(0, 5).forEach(([source, count]) => {
        reportLines.push(`• ${source}: ${count} leads`);
      });
      reportLines.push("");
    }

    reportLines.push("━━━━━━━━━━━━━━━━━━━━━━━━━");
    reportLines.push("Gerado automaticamente pelo CRM");

    const reportMessage = reportLines.join("\n");

    // 8. Send to all managers
    let reportsSent = 0;
    for (const manager of managers) {
      const sent = await sendWhatsAppMessage(instanceName, manager.phone, reportMessage);
      if (sent) {
        reportsSent++;
      }
    }

    console.log(`[weekly-report] Sent ${reportsSent} reports`);

    return c.json(
      { message: "Reports sent", count: reportsSent },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("[weekly-report] Error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
