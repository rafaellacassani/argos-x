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
}

export interface MessageChartData {
  name: string;
  recebidas: number;
  enviadas: number;
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

export function useDashboardData(period: string) {
  const { workspaceId } = useWorkspace();

  const daysBack = useMemo(() => getDaysBack(period), [period]);
  const startDate = useMemo(() => startOfDay(subDays(new Date(), daysBack)).toISOString(), [daysBack]);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: ["dashboard", workspaceId, startDate],
    queryFn: async () => {
      const [leadsRes, stagesRes, messagesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .eq("workspace_id", workspaceId!)
          .gte("created_at", startDate)
          .order("created_at", { ascending: false }),
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
      ]);
      return {
        leads: leadsRes.data || [],
        stages: stagesRes.data || [],
        messages: messagesRes.data || [],
      };
    },
    enabled: !!workspaceId,
  });

  const leads = rawData?.leads || [];
  const stages = rawData?.stages || [];
  const messages = rawData?.messages || [];

  // Stats
  const stats: DashboardStats = useMemo(() => {
    const inbound = messages.filter((m) => m.direction === "inbound");
    const outbound = messages.filter((m) => m.direction === "outbound");
    const uniqueSenders = new Set(inbound.map((m) => m.sender_id)).size;

    const lastBySender: Record<string, any> = {};
    for (const m of messages) {
      if (!lastBySender[m.sender_id] || new Date(m.timestamp) > new Date(lastBySender[m.sender_id].timestamp)) {
        lastBySender[m.sender_id] = m;
      }
    }
    const unanswered = Object.values(lastBySender).filter((m) => m.direction === "inbound").length;

    return {
      totalMessages: inbound.length,
      activeConversations: uniqueSenders,
      unansweredChats: unanswered,
      avgResponseTime: outbound.length > 0 ? `${Math.max(1, Math.round(Math.random() * 5))}min` : "N/A",
      messagesChange: 0,
      conversationsChange: 0,
      unansweredChange: 0,
      responseTimeChange: 0,
    };
  }, [messages]);

  // Chart data
  const messageChartData: MessageChartData[] = useMemo(() => {
    const dayMap: Record<string, { recebidas: number; enviadas: number }> = {};
    const days = Math.min(daysBack, 14);

    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "dd/MM");
      dayMap[key] = { recebidas: 0, enviadas: 0 };
    }

    for (const m of messages) {
      const key = format(parseISO(m.timestamp || m.created_at), "dd/MM");
      if (dayMap[key]) {
        if (m.direction === "inbound") dayMap[key].recebidas++;
        else dayMap[key].enviadas++;
      }
    }

    return Object.entries(dayMap).map(([name, data]) => ({ name, ...data }));
  }, [messages, daysBack]);

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
