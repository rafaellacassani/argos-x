import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/manager\/?$/, "") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

const MAX_REPORTS_PER_RUN = 20;
const MAX_MESSAGE_LENGTH = 4000;

const STAGE_EMOJIS = ["📥", "🔄", "📋", "📅", "🤝", "✅", "🗑️"];

function getStageEmoji(position: number): string {
  return position < STAGE_EMOJIS.length ? STAGE_EMOJIS[position] : "▪️";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getNowSP(): Date {
  const now = new Date();
  const spStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(spStr);
}

function getOffsetMinutes(): number {
  return 180;
}

function getTodayRangeSP(): { start: string; end: string } {
  const sp = getNowSP();
  const start = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate(), 0, 0, 0);
  const end = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate(), 23, 59, 59, 999);
  const offset = getOffsetMinutes();
  const startUTC = new Date(start.getTime() + offset * 60000);
  const endUTC = new Date(end.getTime() + offset * 60000);
  return { start: startUTC.toISOString(), end: endUTC.toISOString() };
}

function getPeriodRange(frequency: string, dayOfWeek: number): { start: string; end: string; label: string } | null {
  const sp = getNowSP();
  const todayStart = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate(), 0, 0, 0);
  const offset = getOffsetMinutes();

  if (frequency === "daily") {
    const startUTC = new Date(todayStart.getTime() + offset * 60000);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
    const label = todayStart.toLocaleDateString("pt-BR");
    return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
  }

  if (frequency === "weekly") {
    if (sp.getDay() !== dayOfWeek) return null;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const startUTC = new Date(weekStart.getTime() + offset * 60000);
    const endUTC = new Date(todayStart.getTime() + offset * 60000);
    const label = `${weekStart.toLocaleDateString("pt-BR")} a ${todayStart.toLocaleDateString("pt-BR")}`;
    return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
  }

  if (frequency === "monthly") {
    if (sp.getDate() !== dayOfWeek) return null;
    const monthStart = new Date(sp.getFullYear(), sp.getMonth() - 1, sp.getDate(), 0, 0, 0);
    const startUTC = new Date(monthStart.getTime() + offset * 60000);
    const endUTC = new Date(todayStart.getTime() + offset * 60000);
    const label = `${monthStart.toLocaleDateString("pt-BR")} a ${todayStart.toLocaleDateString("pt-BR")}`;
    return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
  }

  return null;
}

// Force variant: always returns daily range regardless of frequency
function getForcedPeriodRange(frequency: string): { start: string; end: string; label: string } {
  const sp = getNowSP();
  const todayStart = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate(), 0, 0, 0);
  const offset = getOffsetMinutes();

  if (frequency === "weekly") {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const startUTC = new Date(weekStart.getTime() + offset * 60000);
    const endUTC = new Date(todayStart.getTime() + offset * 60000 + 24 * 60 * 60 * 1000);
    const label = `${weekStart.toLocaleDateString("pt-BR")} a ${sp.toLocaleDateString("pt-BR")}`;
    return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
  }

  if (frequency === "monthly") {
    const monthStart = new Date(sp.getFullYear(), sp.getMonth(), 1, 0, 0, 0);
    const startUTC = new Date(monthStart.getTime() + offset * 60000);
    const endUTC = new Date(todayStart.getTime() + offset * 60000 + 24 * 60 * 60 * 1000);
    const label = `${monthStart.toLocaleDateString("pt-BR")} a ${sp.toLocaleDateString("pt-BR")}`;
    return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
  }

  // daily
  const startUTC = new Date(todayStart.getTime() + offset * 60000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  const label = sp.toLocaleDateString("pt-BR");
  return { start: startUTC.toISOString(), end: endUTC.toISOString(), label };
}

function isWithinWindow(configuredTime: string): boolean {
  const sp = getNowSP();
  const [hours, minutes] = configuredTime.split(":").map(Number);
  const currentMinutes = sp.getHours() * 60 + sp.getMinutes();
  const targetMinutes = hours * 60 + minutes;
  return Math.abs(currentMinutes - targetMinutes) <= 15;
}

async function sendWhatsApp(instanceName: string, phone: string, message: string): Promise<boolean> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !phone) return false;
  try {
    let cleanPhone = phone.replace(/\D/g, "");
    if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }
    const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ number: cleanPhone, text: message, delay: 0 }),
    });
    if (!res.ok) {
      console.error(`[send-daily-reports] Send failed: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[send-daily-reports] Send error:", e);
    return false;
  }
}

async function sendLongMessage(instanceName: string, phone: string, message: string): Promise<boolean> {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return sendWhatsApp(instanceName, phone, message);
  }
  const mid = Math.floor(message.length / 2);
  const sepPattern = "━━━━━━━━━━━━━━━";
  let bestIdx = -1;
  let bestDist = Infinity;
  let idx = message.indexOf(sepPattern);
  while (idx !== -1) {
    const dist = Math.abs(idx - mid);
    if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    idx = message.indexOf(sepPattern, idx + 1);
  }
  if (bestIdx > 0) {
    const part1 = message.substring(0, bestIdx).trim();
    const part2 = message.substring(bestIdx).trim();
    const r1 = await sendWhatsApp(instanceName, phone, part1);
    const r2 = await sendWhatsApp(instanceName, phone, part2);
    return r1 && r2;
  }
  return sendWhatsApp(instanceName, phone, message.substring(0, MAX_MESSAGE_LENGTH));
}

interface StageMetric {
  stage_name: string;
  position: number;
  moves: number;
}

interface SellerMetrics {
  profile_id: string;
  full_name: string;
  stages: StageMetric[];
  sales_count: number;
  sales_value: number;
  no_response_count: number;
}

async function getStagesForWorkspace(supabase: any, workspaceId: string) {
  const { data: funnels } = await supabase
    .from("funnels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .limit(1);

  const funnelId = funnels?.[0]?.id;
  if (!funnelId) {
    const { data: allFunnels } = await supabase
      .from("funnels").select("id").eq("workspace_id", workspaceId).limit(1);
    if (!allFunnels?.[0]) return [];
    const { data: stages } = await supabase
      .from("funnel_stages").select("id, name, position, is_loss_stage")
      .eq("funnel_id", allFunnels[0].id).order("position");
    return stages || [];
  }

  const { data: stages } = await supabase
    .from("funnel_stages").select("id, name, position, is_loss_stage")
    .eq("funnel_id", funnelId).order("position");
  return stages || [];
}

async function getSellerMetrics(
  supabase: any, workspaceId: string, profileId: string, stages: any[], periodStart: string, periodEnd: string
): Promise<SellerMetrics> {
  const { data: profile } = await supabase
    .from("user_profiles").select("full_name").eq("id", profileId).single();

  const { data: history } = await supabase
    .from("lead_history")
    .select("to_stage_id")
    .eq("workspace_id", workspaceId)
    .eq("performed_by", profileId)
    .eq("action", "moved")
    .gte("created_at", periodStart)
    .lt("created_at", periodEnd);

  const moveCounts: Record<string, number> = {};
  for (const h of history || []) {
    moveCounts[h.to_stage_id] = (moveCounts[h.to_stage_id] || 0) + 1;
  }

  const stageMetrics: StageMetric[] = stages.map((s: any) => ({
    stage_name: s.name,
    position: s.position,
    moves: moveCounts[s.id] || 0,
  }));

  const { data: sales } = await supabase
    .from("lead_sales")
    .select("value, leads!inner(responsible_user)")
    .eq("leads.responsible_user", profileId)
    .gte("created_at", periodStart)
    .lt("created_at", periodEnd);

  const salesCount = sales?.length || 0;
  const salesValue = (sales || []).reduce((s: number, r: any) => s + Number(r.value || 0), 0);

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const lossStageIds = stages.filter((s: any) => s.is_loss_stage).map((s: any) => s.id);

  const { data: sellerLeads } = await supabase
    .from("leads")
    .select("id, updated_at, stage_id")
    .eq("workspace_id", workspaceId)
    .eq("responsible_user", profileId)
    .eq("status", "active");

  let noResponse = 0;
  for (const lead of sellerLeads || []) {
    if (lossStageIds.includes(lead.stage_id)) continue;
    if (lead.updated_at && lead.updated_at < thirtyMinAgo) {
      noResponse++;
    }
  }

  return {
    profile_id: profileId,
    full_name: profile?.full_name || "Sem nome",
    stages: stageMetrics,
    sales_count: salesCount,
    sales_value: salesValue,
    no_response_count: noResponse,
  };
}

function buildSellerReport(metrics: SellerMetrics, dateLabel: string): string {
  const lines: string[] = [
    `📊 *Seu resumo do dia — ${dateLabel}*`,
    "",
    `Olá ${metrics.full_name}! Veja como foi seu dia:`,
    "",
  ];

  for (const stage of metrics.stages) {
    lines.push(`${getStageEmoji(stage.position)} ${stage.stage_name}: ${stage.moves} movidos`);
  }

  lines.push("");
  lines.push(`💰 Vendas hoje: ${metrics.sales_count} vendas — ${formatCurrency(metrics.sales_value)}`);
  lines.push(`⚠️ Sem resposta agora: ${metrics.no_response_count} leads aguardando`);
  lines.push("");
  lines.push("Bom trabalho! 💪");

  return lines.join("\n");
}

function buildManagerReport(
  allMetrics: SellerMetrics[],
  dateLabel: string,
  frequency: string,
  newLeadsCount: number,
  totalNoResponse: number
): string {
  const totalSales = allMetrics.reduce((s, m) => s + m.sales_count, 0);
  const totalValue = allMetrics.reduce((s, m) => s + m.sales_value, 0);

  const headerWord = frequency === "weekly" ? "semanal" : frequency === "monthly" ? "mensal" : "da equipe";
  const lines: string[] = [
    `📊 *Relatório ${headerWord} — ${dateLabel}*`,
    "",
    `Panorama ${frequency === "daily" ? "Geral" : frequency === "weekly" ? "da semana" : "do mês"}:`,
    `📥 Novos leads: ${newLeadsCount}`,
    `💰 Vendas: ${totalSales} — ${formatCurrency(totalValue)}`,
    `⚠️ Sem resposta agora: ${totalNoResponse}`,
  ];

  if (frequency !== "daily" && allMetrics.length > 0) {
    const ranked = [...allMetrics].sort((a, b) => b.sales_value - a.sales_value);
    const medals = ["🥇", "🥈", "🥉"];
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("Ranking de vendas:");
    ranked.slice(0, 3).forEach((m, i) => {
      lines.push(`${medals[i] || "•"} ${m.full_name}: ${formatCurrency(m.sales_value)} (${m.sales_count} vendas)`);
    });
  }

  for (const m of allMetrics) {
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push(`*${m.full_name}:*`);
    for (const stage of m.stages) {
      lines.push(`${getStageEmoji(stage.position)} ${stage.stage_name}: ${stage.moves}`);
    }
    lines.push(`💰 Vendas: ${m.sales_count} — ${formatCurrency(m.sales_value)}`);
    lines.push(`⚠️ Sem resposta: ${m.no_response_count}`);
  }

  lines.push("");
  lines.push("━━━━━━━━━━━━━━━");
  lines.push("Bom trabalho, equipe! 🚀");

  return lines.join("\n");
}

// ===== FORCED SEND for a specific user =====
async function handleForcedSend(supabase: any, workspaceId: string, userProfileId: string): Promise<{ message: string; sent: boolean }> {
  // Get workspace alert instance
  const { data: ws } = await supabase
    .from("workspaces").select("alert_instance_name").eq("id", workspaceId).single();
  if (!ws?.alert_instance_name) {
    return { message: "Nenhuma instância de alertas configurada no workspace", sent: false };
  }

  const instanceName = ws.alert_instance_name;

  // Get user profile with personal_whatsapp
  const { data: profile } = await supabase
    .from("user_profiles").select("id, full_name, personal_whatsapp").eq("id", userProfileId).single();
  if (!profile?.personal_whatsapp) {
    return { message: "Usuário sem WhatsApp pessoal cadastrado", sent: false };
  }

  // Get stages
  const stages = await getStagesForWorkspace(supabase, workspaceId);
  if (stages.length === 0) {
    return { message: "Nenhuma etapa de funil encontrada", sent: false };
  }

  // Load notification preferences to know what to send
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_profile_id", userProfileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const frequency = prefs?.manager_report_frequency || "daily";
  const period = getForcedPeriodRange(frequency);

  // Check what reports are enabled
  const sendDashboard = prefs?.daily_report_enabled ?? true;
  const sendManagerReport = prefs?.manager_report_enabled ?? false;

  const messages: string[] = [];

  if (sendDashboard || sendManagerReport) {
    // Get all sellers for manager report
    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId)
      .not("accepted_at", "is", null);

    const userIds = (members || []).map((m: any) => m.user_id);
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, user_id, full_name, personal_whatsapp")
      .in("user_id", userIds);

    const profileByUserId: Record<string, any> = {};
    for (const p of profiles || []) {
      profileByUserId[p.user_id] = p;
    }

    const sellerMembers = (members || []).filter((m: any) => m.role === "seller");

    // Gather seller metrics
    const allMetrics: SellerMetrics[] = [];
    for (const sm of sellerMembers) {
      const sp = profileByUserId[sm.user_id];
      if (!sp) continue;
      const m = await getSellerMetrics(supabase, workspaceId, sp.id, stages, period.start, period.end);
      allMetrics.push(m);
    }

    // New leads in period
    const { count: newLeads } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", period.start)
      .lt("created_at", period.end);

    const totalNoResponse = allMetrics.reduce((s, m) => s + m.no_response_count, 0);

    if (sendManagerReport || sendDashboard) {
      const message = buildManagerReport(allMetrics, period.label, frequency, newLeads || 0, totalNoResponse);
      messages.push(message);
    }
  } else {
    // Fallback: send a personal seller report
    const metrics = await getSellerMetrics(supabase, workspaceId, userProfileId, stages, period.start, period.end);
    const message = buildSellerReport(metrics, period.label);
    messages.push(message);
  }

  let allSent = true;
  for (const msg of messages) {
    const sent = await sendLongMessage(instanceName, profile.personal_whatsapp, msg);
    if (!sent) allSent = false;
  }

  if (allSent && messages.length > 0) {
    await supabase.from("alert_log").insert({
      workspace_id: workspaceId,
      user_profile_id: userProfileId,
      alert_type: "daily_report",
      message_preview: messages[0].substring(0, 200),
    });
  }

  return { message: allSent ? "Relatório enviado com sucesso" : "Falha ao enviar relatório", sent: allSent };
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if this is a forced send request
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body = cron invocation
    }

    if (body?.force && body?.workspace_id && body?.user_profile_id) {
      console.log(`[send-daily-reports] Force send for user ${body.user_profile_id} in workspace ${body.workspace_id}`);
      const result = await handleForcedSend(supabase, body.workspace_id, body.user_profile_id);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== SCHEDULED (CRON) FLOW =====
    let reportsSent = 0;

    const { data: prefs, error: prefsErr } = await supabase
      .from("notification_preferences")
      .select("*")
      .or("daily_report_enabled.eq.true,manager_report_enabled.eq.true");

    if (prefsErr) throw prefsErr;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ message: "No reports configured" }), { headers: corsHeaders });
    }

    const byWorkspace: Record<string, any[]> = {};
    for (const p of prefs) {
      if (!byWorkspace[p.workspace_id]) byWorkspace[p.workspace_id] = [];
      byWorkspace[p.workspace_id].push(p);
    }

    for (const [workspaceId, wsPrefs] of Object.entries(byWorkspace)) {
      if (reportsSent >= MAX_REPORTS_PER_RUN) break;

      const { data: ws } = await supabase
        .from("workspaces").select("alert_instance_name").eq("id", workspaceId).single();

      if (!ws?.alert_instance_name) {
        console.log(`[send-daily-reports] No alert instance for workspace ${workspaceId}`);
        continue;
      }

      const instanceName = ws.alert_instance_name;
      const stages = await getStagesForWorkspace(supabase, workspaceId);
      if (stages.length === 0) continue;

      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, role")
        .eq("workspace_id", workspaceId)
        .not("accepted_at", "is", null);

      const userIds = (members || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name, personal_whatsapp")
        .in("user_id", userIds);

      const profileByUserId: Record<string, any> = {};
      const profileById: Record<string, any> = {};
      for (const p of profiles || []) {
        profileByUserId[p.user_id] = p;
        profileById[p.id] = p;
      }

      const sellerMembers = (members || []).filter((m: any) => m.role === "seller");

      for (const pref of wsPrefs) {
        if (reportsSent >= MAX_REPORTS_PER_RUN) break;

        const profile = profileById[pref.user_profile_id];
        if (!profile?.personal_whatsapp) continue;

        // --- SELLER DAILY REPORT ---
        if (pref.daily_report_enabled) {
          const configTime = pref.daily_report_time || "19:00";
          if (!isWithinWindow(configTime)) continue;

          const todayRange = getTodayRangeSP();
          const { count: alreadySent } = await supabase
            .from("alert_log")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("user_profile_id", pref.user_profile_id)
            .eq("alert_type", "daily_report")
            .gte("sent_at", todayRange.start);

          if ((alreadySent || 0) > 0) continue;

          const metrics = await getSellerMetrics(supabase, workspaceId, pref.user_profile_id, stages, todayRange.start, todayRange.end);
          const sp = getNowSP();
          const dateLabel = sp.toLocaleDateString("pt-BR");
          const message = buildSellerReport(metrics, dateLabel);

          const sent = await sendLongMessage(instanceName, profile.personal_whatsapp, message);
          if (sent) {
            await supabase.from("alert_log").insert({
              workspace_id: workspaceId,
              user_profile_id: pref.user_profile_id,
              alert_type: "daily_report",
              message_preview: message.substring(0, 200),
            });
            reportsSent++;
          }
        }

        // --- MANAGER/ADMIN PERIODIC REPORT ---
        if (pref.manager_report_enabled) {
          const frequency = pref.manager_report_frequency || "daily";
          const configTime = pref.manager_report_time || "19:00";
          if (!isWithinWindow(configTime)) continue;

          const dayOfWeek = pref.manager_report_day_of_week ?? 1;
          const period = getPeriodRange(frequency, dayOfWeek);
          if (!period) continue;

          const alertType = frequency === "daily" ? "daily_report" : frequency === "weekly" ? "weekly_report" : "monthly_report";
          const todayRange = getTodayRangeSP();
          const { count: alreadySent } = await supabase
            .from("alert_log")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("user_profile_id", pref.user_profile_id)
            .eq("alert_type", alertType)
            .gte("sent_at", todayRange.start);

          if ((alreadySent || 0) > 0) continue;

          const allMetrics: SellerMetrics[] = [];
          for (const sm of sellerMembers) {
            const sp = profileByUserId[sm.user_id];
            if (!sp) continue;
            const m = await getSellerMetrics(supabase, workspaceId, sp.id, stages, period.start, period.end);
            allMetrics.push(m);
          }

          const { count: newLeads } = await supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .gte("created_at", period.start)
            .lt("created_at", period.end);

          const totalNoResponse = allMetrics.reduce((s, m) => s + m.no_response_count, 0);
          const message = buildManagerReport(allMetrics, period.label, frequency, newLeads || 0, totalNoResponse);

          const sent = await sendLongMessage(instanceName, profile.personal_whatsapp, message);
          if (sent) {
            await supabase.from("alert_log").insert({
              workspace_id: workspaceId,
              user_profile_id: pref.user_profile_id,
              alert_type: alertType,
              message_preview: message.substring(0, 200),
            });
            reportsSent++;
          }
        }
      }
    }

    console.log(`[send-daily-reports] Sent ${reportsSent} reports`);
    return new Response(
      JSON.stringify({ message: "Reports processed", count: reportsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-daily-reports] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
