import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CadenceLogEntry {
  id: string;
  workspace_id: string;
  cadence_day: number;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

export interface CadenceDayStat {
  day: number;
  label: string;
  whatsapp: { sent: number; failed: number };
  email: { sent: number; failed: number };
  total: number;
}

export interface CadenceOverview {
  totalSent: number;
  totalFailed: number;
  whatsappSent: number;
  whatsappFailed: number;
  emailSent: number;
  emailFailed: number;
  convertedWorkspaces: number;
  totalTargeted: number;
  conversionRate: number;
  byDay: CadenceDayStat[];
}

const DAY_LABELS: Record<number, string> = {
  "-7": "Boas-vindas",
  "-2": "Dia -2",
  "-1": "Dia -1",
  "0": "Vencimento",
  "3": "Dia +3",
  "6": "Dia +6",
  "7": "Dia +7",
};

export function useCadenceStats() {
  return useQuery({
    queryKey: ["cadence-stats"],
    queryFn: async () => {
      // Fetch all reactivation logs (admin-only via RLS)
      const { data: logs, error } = await supabase
        .from("reactivation_log")
        .select("*")
        .order("sent_at", { ascending: false });

      if (error) throw error;
      const entries = (logs || []) as CadenceLogEntry[];

      // Get unique workspace IDs that received cadence messages
      const targetedWsIds = [...new Set(entries.map((e) => e.workspace_id))];

      // Check which of those workspaces converted (have active subscription)
      let convertedCount = 0;
      if (targetedWsIds.length > 0) {
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id, subscription_status, plan_name")
          .in("id", targetedWsIds);

        convertedCount = (workspaces || []).filter(
          (w) => w.subscription_status === "active" || w.subscription_status === "trialing"
        ).length;
      }

      // Aggregate stats
      const whatsappSent = entries.filter((e) => e.channel === "whatsapp" && e.status === "sent").length;
      const whatsappFailed = entries.filter((e) => e.channel === "whatsapp" && e.status === "failed").length;
      const emailSent = entries.filter((e) => e.channel === "email" && e.status === "sent").length;
      const emailFailed = entries.filter((e) => e.channel === "email" && e.status === "failed").length;

      // Group by day
      const dayMap = new Map<number, CadenceDayStat>();
      for (const entry of entries) {
        if (!dayMap.has(entry.cadence_day)) {
          dayMap.set(entry.cadence_day, {
            day: entry.cadence_day,
            label: DAY_LABELS[entry.cadence_day] || `Dia ${entry.cadence_day > 0 ? "+" : ""}${entry.cadence_day}`,
            whatsapp: { sent: 0, failed: 0 },
            email: { sent: 0, failed: 0 },
            total: 0,
          });
        }
        const stat = dayMap.get(entry.cadence_day)!;
        const channelStat = entry.channel === "whatsapp" ? stat.whatsapp : stat.email;
        if (entry.status === "sent") channelStat.sent++;
        else channelStat.failed++;
        stat.total++;
      }

      const byDay = [...dayMap.values()].sort((a, b) => a.day - b.day);

      const overview: CadenceOverview = {
        totalSent: whatsappSent + emailSent,
        totalFailed: whatsappFailed + emailFailed,
        whatsappSent,
        whatsappFailed,
        emailSent,
        emailFailed,
        convertedWorkspaces: convertedCount,
        totalTargeted: targetedWsIds.length,
        conversionRate: targetedWsIds.length > 0
          ? Math.round((convertedCount / targetedWsIds.length) * 100)
          : 0,
        byDay,
      };

      return overview;
    },
    staleTime: 60_000,
  });
}
