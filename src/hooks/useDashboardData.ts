import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, startOfMonth, parseISO } from "date-fns";

export interface DashboardStats {
  totalMessages: number;
  activeConversations: number;
  unansweredChats: number;
  avgResponseTime: string;
  messagesChange: number;
  conversationsChange: number;
  unansweredChange: number;
  responseTimeChange: number;
  leadsInPeriod: number;
  leadsChange: number;
  pipelineValue: number;
}

export interface MessageChartData {
  name: string;
  recebidas: number;
  leads: number;
}

export interface LeadSourceData {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface RecentLead {
  name: string;
  source: string;
  stage: string;
  time: string;
  initials: string;
  sourceColor: string;
}

export interface TeamMemberRanking {
  profileId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  activeLeads: number;
  salesCount: number;
  avgResponseTime: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  color: string;
}

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#25D366",
  site: "#0171C3",
  instagram: "#E4405F",
  indicação: "#060369",
  manual: "#94A3B8",
  facebook: "#1877F2",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const today = startOfDay(now);
  switch (period) {
    case "today":
      return { start: today, end: now };
    case "yesterday":
      return { start: subDays(today, 1), end: today };
    case "7d":
      return { start: subDays(today, 7), end: now };
    case "30d":
      return { start: subDays(today, 30), end: now };
    case "month":
      return { start: startOfMonth(now), end: now };
    default:
      return { start: subDays(today, 7), end: now };
  }
}

function getPrevDateRange(period: string): { start: Date; end: Date } {
  const { start, end } = getDateRange(period);
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: start,
  };
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function calcAvgResponseTime(messages: any[]): string {
  const bySender: Record<string, any[]> = {};
  for (const m of messages) {
    if (!bySender[m.sender_id]) bySender[m.sender_id] = [];
    bySender[m.sender_id].push(m);
  }

  const responseTimes: number[] = [];
  for (const msgs of Object.values(bySender)) {
    const sorted = msgs.sort(
      (a: any, b: any) =>
        new Date(a.timestamp || a.created_at).getTime() -
        new Date(b.timestamp || b.created_at).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].direction === "inbound") {
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].direction === "outbound") {
            const inTime = new Date(sorted[i].timestamp || sorted[i].created_at).getTime();
            const outTime = new Date(sorted[j].timestamp || sorted[j].created_at).getTime();
            const diffMin = (outTime - inTime) / 60000;
            if (diffMin > 0 && diffMin < 1440) {
              responseTimes.push(diffMin);
            }
            break;
          }
        }
      }
    }
  }

  if (responseTimes.length === 0) return "N/A";
  const avg = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
  if (avg < 60) return `${avg}min`;
  const hours = Math.floor(avg / 60);
  const mins = avg % 60;
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
}

function calcUnanswered(messages: any[]): number {
  const lastBySender: Record<string, any> = {};
  for (const m of messages) {
    const ts = new Date(m.timestamp || m.created_at).getTime();
    if (!lastBySender[m.sender_id] || ts > new Date(lastBySender[m.sender_id].timestamp || lastBySender[m.sender_id].created_at).getTime()) {
      lastBySender[m.sender_id] = m;
    }
  }
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  return Object.values(lastBySender).filter(
    (m) => m.direction === "inbound" && new Date(m.timestamp || m.created_at).getTime() < thirtyMinAgo
  ).length;
}

function getDaysInRange(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export function useDashboardData(period: string, userId: string | null = null) {
  const { workspaceId } = useWorkspace();

  const { start, end } = useMemo(() => getDateRange(period), [period]);
  const { start: prevStart, end: prevEnd } = useMemo(() => getPrevDateRange(period), [period]);
  const startISO = useMemo(() => start.toISOString(), [start]);
  const prevStartISO = useMemo(() => prevStart.toISOString(), [prevStart]);
  const prevEndISO = useMemo(() => prevEnd.toISOString(), [prevEnd]);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: ["dashboard", workspaceId, startISO, prevStartISO, userId],
    queryFn: async () => {
      // Build lead queries with optional userId filter
      let leadsQuery = supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", startISO)
        .order("created_at", { ascending: false });
      if (userId) leadsQuery = leadsQuery.eq("responsible_user", userId);

      let prevLeadsQuery = supabase
        .from("leads")
        .select("id, created_at")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", prevStartISO)
        .lt("created_at", startISO);
      if (userId) prevLeadsQuery = prevLeadsQuery.eq("responsible_user", userId);

      let activeLeadsQuery = supabase
        .from("leads")
        .select("id, value, status, responsible_user")
        .eq("workspace_id", workspaceId!)
        .eq("status", "active");
      if (userId) activeLeadsQuery = activeLeadsQuery.eq("responsible_user", userId);

      const [
        leadsRes,
        prevLeadsRes,
        stagesRes,
        messagesRes,
        prevMessagesRes,
        activeLeadsRes,
        membersRes,
        profilesRes,
        salesRes,
      ] = await Promise.all([
        leadsQuery,
        prevLeadsQuery,
        supabase.from("funnel_stages").select("*").eq("workspace_id", workspaceId!),
        supabase
          .from("meta_conversations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", startISO)
          .order("timestamp", { ascending: false }),
        supabase
          .from("meta_conversations")
          .select("id, direction, sender_id, timestamp, created_at")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", prevStartISO)
          .lt("created_at", startISO),
        activeLeadsQuery,
        supabase
          .from("workspace_members")
          .select("user_id, role")
          .eq("workspace_id", workspaceId!)
          .not("accepted_at", "is", null),
        supabase.from("user_profiles").select("id, user_id, full_name, avatar_url"),
        supabase
          .from("lead_sales")
          .select("id, lead_id, created_at, value")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", startISO),
      ]);

      return {
        leads: leadsRes.data || [],
        prevLeads: prevLeadsRes.data || [],
        stages: stagesRes.data || [],
        messages: messagesRes.data || [],
        prevMessages: prevMessagesRes.data || [],
        activeLeads: activeLeadsRes.data || [],
        members: membersRes.data || [],
        profiles: profilesRes.data || [],
        sales: salesRes.data || [],
      };
    },
    enabled: !!workspaceId,
  });

  const leads = rawData?.leads || [];
  const prevLeads = rawData?.prevLeads || [];
  const stages = rawData?.stages || [];
  const messages = rawData?.messages || [];
  const prevMessages = rawData?.prevMessages || [];
  const activeLeads = rawData?.activeLeads || [];
  const members = rawData?.members || [];
  const profiles = rawData?.profiles || [];
  const sales = rawData?.sales || [];

  // Stats
  const stats: DashboardStats = useMemo(() => {
    const inbound = messages.filter((m) => m.direction === "inbound");
    const prevInbound = prevMessages.filter((m: any) => m.direction === "inbound");
    const uniqueSenders = new Set(inbound.map((m) => m.sender_id)).size;
    const prevUniqueSenders = new Set(prevInbound.map((m: any) => m.sender_id)).size;
    const unanswered = calcUnanswered(messages);
    const prevUnanswered = calcUnanswered(prevMessages);
    const pipelineValue = activeLeads.reduce((sum: number, l: any) => sum + (Number(l.value) || 0), 0);

    return {
      totalMessages: inbound.length,
      activeConversations: uniqueSenders,
      unansweredChats: unanswered,
      avgResponseTime: calcAvgResponseTime(messages),
      messagesChange: calcChange(inbound.length, prevInbound.length),
      conversationsChange: calcChange(uniqueSenders, prevUniqueSenders),
      unansweredChange: calcChange(unanswered, prevUnanswered),
      responseTimeChange: 0,
      leadsInPeriod: leads.length,
      leadsChange: calcChange(leads.length, prevLeads.length),
      pipelineValue,
    };
  }, [messages, prevMessages, leads, prevLeads, activeLeads]);

  // Chart data
  const messageChartData: MessageChartData[] = useMemo(() => {
    const days = getDaysInRange(start, end);
    const chartDays = Math.min(days, 31);
    const dayMap: Record<string, { recebidas: number; leads: number }> = {};

    for (let i = chartDays - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "dd/MM");
      dayMap[key] = { recebidas: 0, leads: 0 };
    }

    for (const m of messages) {
      const key = format(parseISO(m.timestamp || m.created_at), "dd/MM");
      if (dayMap[key] && m.direction === "inbound") {
        dayMap[key].recebidas++;
      }
    }

    for (const l of leads) {
      const key = format(parseISO(l.created_at), "dd/MM");
      if (dayMap[key]) {
        dayMap[key].leads++;
      }
    }

    return Object.entries(dayMap).map(([name, data]) => ({ name, ...data }));
  }, [messages, leads, start, end]);

  // Lead sources
  const leadSourceData: LeadSourceData[] = useMemo(() => {
    if (leads.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const l of leads) {
      const src = (l.source || "manual").toLowerCase();
      counts[src] = (counts[src] || 0) + 1;
    }
    const total = leads.length;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Math.round((count / total) * 100),
        count,
        color: SOURCE_COLORS[name] || "#8B5CF6",
      }));
  }, [leads]);

  // Recent leads
  const recentLeads: RecentLead[] = useMemo(() => {
    return leads.slice(0, 5).map((l) => {
      const stage = stages.find((s) => s.id === l.stage_id);
      const src = (l.source || "manual").toLowerCase();
      const displayName = l.name && l.name.trim() ? l.name : formatPhone(l.phone);

      return {
        name: displayName,
        source: l.source ? l.source.charAt(0).toUpperCase() + l.source.slice(1) : "Manual",
        stage: stage?.name || "Novo",
        time: timeAgo(l.created_at),
        initials: displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
        sourceColor: SOURCE_COLORS[src] || "#94A3B8",
      };
    });
  }, [leads, stages]);

  // Team ranking
  const teamRanking: TeamMemberRanking[] = useMemo(() => {
    if (members.length < 2) return [];

    return members.map((member) => {
      const profile = profiles.find((p) => p.user_id === member.user_id);
      if (!profile) return null;

      const memberActiveLeads = activeLeads.filter(
        (l: any) => l.responsible_user === profile.id
      ).length;

      // Count sales in period for leads owned by this member
      const memberLeadIds = new Set(
        leads.filter((l) => l.responsible_user === profile.id).map((l) => l.id)
      );
      const allLeadIds = new Set(
        activeLeads.filter((l: any) => l.responsible_user === profile.id).map((l: any) => l.id)
      );
      // Include both period leads and active leads for sales matching
      const combinedIds = new Set([...memberLeadIds, ...allLeadIds]);
      const memberSales = sales.filter((s) => combinedIds.has(s.lead_id)).length;

      // Avg response time for this member's conversations - simplified
      const memberAvgTime = "—";

      const name = profile.full_name || "Sem nome";
      return {
        profileId: profile.id,
        name,
        initials: name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
        avatarUrl: profile.avatar_url,
        activeLeads: memberActiveLeads,
        salesCount: memberSales,
        avgResponseTime: memberAvgTime,
      };
    }).filter(Boolean).sort((a, b) => (b!.salesCount - a!.salesCount)) as TeamMemberRanking[];
  }, [members, profiles, activeLeads, leads, sales]);

  // Performance (kept for backward compat)
  const performanceMetrics: PerformanceMetric[] = useMemo(() => {
    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) =>
      stages.find((s) => s.id === l.stage_id)?.is_win_stage
    ).length;
    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
    const outbound = messages.filter((m) => m.direction === "outbound").length;
    const inbound = messages.filter((m) => m.direction === "inbound").length;
    const responseRate = inbound > 0 ? Math.min(100, Math.round((outbound / inbound) * 100)) : 0;

    return [
      { name: "Taxa de Resposta", value: responseRate, color: "bg-success" },
      { name: "Total de Leads", value: totalLeads, color: "bg-secondary" },
      { name: "Taxa de Conversão", value: conversionRate, color: "bg-primary" },
      { name: "Leads Ganhos", value: wonLeads, color: "bg-warning" },
    ];
  }, [leads, stages, messages]);

  return {
    loading,
    stats,
    messageChartData,
    leadSourceData,
    recentLeads,
    teamRanking,
    performanceMetrics,
    members,
    profiles,
  };
}

function formatPhone(phone: string): string {
  if (!phone) return "Sem nome";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
