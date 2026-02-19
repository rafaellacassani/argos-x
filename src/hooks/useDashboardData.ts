import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, parseISO } from "date-fns";

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
  enviadas: number;
  leads: number;
}

export interface LeadSourceData {
  name: string;
  value: number;
  color: string;
}

export interface RecentLead {
  name: string;
  source: string;
  status: string;
  time: string;
  initials: string;
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
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getDaysBack(period: string): number {
  switch (period) {
    case "today": return 1;
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    default: return 7;
  }
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function calcAvgResponseTime(messages: any[]): string {
  // Group messages by sender_id, sort by timestamp
  const bySender: Record<string, any[]> = {};
  for (const m of messages) {
    if (!bySender[m.sender_id]) bySender[m.sender_id] = [];
    bySender[m.sender_id].push(m);
  }

  const responseTimes: number[] = [];

  for (const msgs of Object.values(bySender)) {
    const sorted = msgs.sort((a: any, b: any) =>
      new Date(a.timestamp || a.created_at).getTime() - new Date(b.timestamp || b.created_at).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].direction === "inbound") {
        // Find next outbound to same sender
        for (let j = i + 1; j < sorted.length; j++) {
          if (sorted[j].direction === "outbound") {
            const inTime = new Date(sorted[i].timestamp || sorted[i].created_at).getTime();
            const outTime = new Date(sorted[j].timestamp || sorted[j].created_at).getTime();
            const diffMin = (outTime - inTime) / 60000;
            if (diffMin > 0 && diffMin < 1440) { // ignore > 24h gaps
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
    if (!lastBySender[m.sender_id] || new Date(m.timestamp) > new Date(lastBySender[m.sender_id].timestamp)) {
      lastBySender[m.sender_id] = m;
    }
  }
  return Object.values(lastBySender).filter((m) => m.direction === "inbound").length;
}

export function useDashboardData(period: string) {
  const { workspaceId } = useWorkspace();

  const daysBack = useMemo(() => getDaysBack(period), [period]);
  const startDate = useMemo(() => startOfDay(subDays(new Date(), daysBack)).toISOString(), [daysBack]);
  const prevStartDate = useMemo(() => startOfDay(subDays(new Date(), daysBack * 2)).toISOString(), [daysBack]);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: ["dashboard", workspaceId, startDate],
    queryFn: async () => {
      const [leadsRes, prevLeadsRes, stagesRes, messagesRes, prevMessagesRes, allActiveLeadsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", startDate)
          .order("created_at", { ascending: false }),
        supabase
          .from("leads")
          .select("id, created_at")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", prevStartDate)
          .lt("created_at", startDate),
        supabase
          .from("funnel_stages")
          .select("*")
          .eq("workspace_id", workspaceId!),
        supabase
          .from("meta_conversations")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", startDate)
          .order("timestamp", { ascending: false }),
        supabase
          .from("meta_conversations")
          .select("id, direction, sender_id, timestamp, created_at")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", prevStartDate)
          .lt("created_at", startDate),
        supabase
          .from("leads")
          .select("id, value, status")
          .eq("workspace_id", workspaceId!)
          .eq("status", "active"),
      ]);
      return {
        leads: leadsRes.data || [],
        prevLeads: prevLeadsRes.data || [],
        stages: stagesRes.data || [],
        messages: messagesRes.data || [],
        prevMessages: prevMessagesRes.data || [],
        allActiveLeads: allActiveLeadsRes.data || [],
      };
    },
    enabled: !!workspaceId,
  });

  const leads = rawData?.leads || [];
  const prevLeads = rawData?.prevLeads || [];
  const stages = rawData?.stages || [];
  const messages = rawData?.messages || [];
  const prevMessages = rawData?.prevMessages || [];
  const allActiveLeads = rawData?.allActiveLeads || [];

  // Stats
  const stats: DashboardStats = useMemo(() => {
    const inbound = messages.filter((m) => m.direction === "inbound");
    const prevInbound = prevMessages.filter((m: any) => m.direction === "inbound");
    const uniqueSenders = new Set(inbound.map((m) => m.sender_id)).size;
    const prevUniqueSenders = new Set(prevInbound.map((m: any) => m.sender_id)).size;
    const unanswered = calcUnanswered(messages);
    const prevUnanswered = calcUnanswered(prevMessages);

    const pipelineValue = allActiveLeads.reduce((sum: number, l: any) => sum + (Number(l.value) || 0), 0);

    return {
      totalMessages: inbound.length,
      activeConversations: uniqueSenders,
      unansweredChats: unanswered,
      avgResponseTime: calcAvgResponseTime(messages),
      messagesChange: calcChange(inbound.length, prevInbound.length),
      conversationsChange: calcChange(uniqueSenders, prevUniqueSenders),
      unansweredChange: calcChange(unanswered, prevUnanswered),
      responseTimeChange: 0, // no simple way to compare avg response time direction
      leadsInPeriod: leads.length,
      leadsChange: calcChange(leads.length, prevLeads.length),
      pipelineValue,
    };
  }, [messages, prevMessages, leads, prevLeads, allActiveLeads]);

  // Chart data
  const messageChartData: MessageChartData[] = useMemo(() => {
    const dayMap: Record<string, { recebidas: number; enviadas: number; leads: number }> = {};
    const days = Math.min(daysBack, 14);

    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "dd/MM");
      dayMap[key] = { recebidas: 0, enviadas: 0, leads: 0 };
    }

    for (const m of messages) {
      const key = format(parseISO(m.timestamp || m.created_at), "dd/MM");
      if (dayMap[key]) {
        if (m.direction === "inbound") dayMap[key].recebidas++;
        else dayMap[key].enviadas++;
      }
    }

    // Add leads created per day as activity proxy
    for (const l of leads) {
      const key = format(parseISO(l.created_at), "dd/MM");
      if (dayMap[key]) {
        dayMap[key].leads++;
      }
    }

    return Object.entries(dayMap).map(([name, data]) => ({ name, ...data }));
  }, [messages, leads, daysBack]);

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
        color: SOURCE_COLORS[name] || "#94A3B8",
      }));
  }, [leads]);

  // Recent leads
  const recentLeads: RecentLead[] = useMemo(() => {
    return leads.slice(0, 5).map((l) => {
      const stage = stages.find((s) => s.id === l.stage_id);
      let status = "Novo";
      if (stage?.is_win_stage) status = "Fechado";
      else if (stage?.is_loss_stage) status = "Perdido";
      else if (stage) status = stage.name;

      return {
        name: l.name,
        source: l.source || "Manual",
        status,
        time: timeAgo(l.created_at),
        initials: l.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2),
      };
    });
  }, [leads, stages]);

  // Performance
  const performanceMetrics: PerformanceMetric[] = useMemo(() => {
    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) => stages.find((s) => s.id === l.stage_id)?.is_win_stage).length;
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
    performanceMetrics,
  };
}
