import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Send, MessageSquare, Mail, TrendingUp, Trophy, Target, BarChart3,
} from "lucide-react";

// All cadence days we want to show rows for
const ALL_CADENCE_DAYS = [-7, -2, -1, 0, 3, 6, 7];

const DAY_LABELS: Record<number, string> = {
  [-7]: "Signup (Dia -7)",
  [-2]: "Dia -2",
  [-1]: "Dia -1",
  [0]: "Vencimento (Dia 0)",
  [3]: "Dia +3",
  [6]: "Dia +6",
  [7]: "Dia +7",
};

function getDayLabel(day: number) {
  return DAY_LABELS[day] || `Dia ${day > 0 ? "+" : ""}${day}`;
}

interface LogEntry {
  id: string;
  workspace_id: string;
  cadence_day: number;
  channel: string;
  status: string;
  sent_at: string;
}

interface WorkspaceInfo {
  id: string;
  subscription_status: string | null;
  plan_name: string | null;
}

export default function CadenceMetricsPanel() {
  const [period, setPeriod] = useState("all");

  const startDate = useMemo(() => {
    if (period === "all") return null;
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    return subDays(new Date(), days).toISOString();
  }, [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["cadence-metrics", period],
    queryFn: async () => {
      let query = supabase
        .from("reactivation_log")
        .select("*")
        .order("sent_at", { ascending: false });

      if (startDate) {
        query = query.gte("sent_at", startDate);
      }

      const { data: logs, error } = await query;
      if (error) throw error;

      const entries = (logs || []) as LogEntry[];
      const wsIds = [...new Set(entries.map((e) => e.workspace_id))];

      let workspaces: WorkspaceInfo[] = [];
      if (wsIds.length > 0) {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("id, subscription_status, plan_name")
          .in("id", wsIds);
        workspaces = (ws || []) as WorkspaceInfo[];
      }

      return { entries, workspaces };
    },
    staleTime: 60_000,
  });

  const entries = data?.entries || [];
  const workspaces = data?.workspaces || [];

  const convertedWsIds = useMemo(
    () => new Set(workspaces.filter((w) => w.subscription_status === "active").map((w) => w.id)),
    [workspaces]
  );

  const allTargetedWsIds = useMemo(
    () => new Set(entries.map((e) => e.workspace_id)),
    [entries]
  );

  // Per-day stats
  const dayStats = useMemo(() => {
    const uniqueDays = [...new Set(entries.map((e) => e.cadence_day))];
    const allDays = [...new Set([...ALL_CADENCE_DAYS, ...uniqueDays])].sort((a, b) => a - b);

    return allDays.map((day) => {
      const dayEntries = entries.filter((e) => e.cadence_day === day);
      const waSent = dayEntries.filter((e) => e.channel === "whatsapp" && e.status === "sent").length;
      const waFailed = dayEntries.filter((e) => e.channel === "whatsapp" && e.status === "failed").length;
      const emSent = dayEntries.filter((e) => e.channel === "email" && e.status === "sent").length;
      const emFailed = dayEntries.filter((e) => e.channel === "email" && e.status === "failed").length;

      // Workspaces that received this day and converted
      const dayWsIds = new Set(dayEntries.map((e) => e.workspace_id));
      const waWsIds = new Set(dayEntries.filter((e) => e.channel === "whatsapp" && e.status === "sent").map((e) => e.workspace_id));
      const emWsIds = new Set(dayEntries.filter((e) => e.channel === "email" && e.status === "sent").map((e) => e.workspace_id));

      const waConverted = [...waWsIds].filter((id) => convertedWsIds.has(id)).length;
      const emConverted = [...emWsIds].filter((id) => convertedWsIds.has(id)).length;
      const totalConverted = [...dayWsIds].filter((id) => convertedWsIds.has(id)).length;

      const totalSent = waSent + emSent;
      const convRate = dayWsIds.size > 0 ? Math.round((totalConverted / dayWsIds.size) * 100) : 0;

      return {
        day,
        label: getDayLabel(day),
        waSent,
        waFailed,
        waConverted,
        waConvRate: waWsIds.size > 0 ? Math.round((waConverted / waWsIds.size) * 100) : 0,
        emSent,
        emFailed,
        emConverted,
        emConvRate: emWsIds.size > 0 ? Math.round((emConverted / emWsIds.size) * 100) : 0,
        totalSent,
        totalConverted,
        convRate,
      };
    });
  }, [entries, convertedWsIds]);

  // Overview stats
  const overview = useMemo(() => {
    const totalDisparos = entries.filter((e) => e.status === "sent").length;
    const totalFailed = entries.filter((e) => e.status === "failed").length;
    const totalTargeted = allTargetedWsIds.size;
    const totalConverted = [...allTargetedWsIds].filter((id) => convertedWsIds.has(id)).length;
    const convRate = totalTargeted > 0 ? Math.round((totalConverted / totalTargeted) * 100) : 0;

    // Best channel
    const waWsIds = new Set(entries.filter((e) => e.channel === "whatsapp" && e.status === "sent").map((e) => e.workspace_id));
    const emWsIds = new Set(entries.filter((e) => e.channel === "email" && e.status === "sent").map((e) => e.workspace_id));
    const waConv = [...waWsIds].filter((id) => convertedWsIds.has(id)).length;
    const emConv = [...emWsIds].filter((id) => convertedWsIds.has(id)).length;
    const waConvRate = waWsIds.size > 0 ? Math.round((waConv / waWsIds.size) * 100) : 0;
    const emConvRate = emWsIds.size > 0 ? Math.round((emConv / emWsIds.size) * 100) : 0;
    const bestChannel = waConvRate >= emConvRate ? "WhatsApp" : "E-mail";
    const bestChannelRate = Math.max(waConvRate, emConvRate);

    // Best day
    const bestDay = dayStats.reduce((best, d) => (d.convRate > best.convRate ? d : best), dayStats[0] || { label: "—", convRate: 0 });

    return {
      totalDisparos,
      totalFailed,
      totalConverted,
      totalTargeted,
      convRate,
      bestChannel,
      bestChannelRate,
      bestDayLabel: bestDay?.label || "—",
      bestDayRate: bestDay?.convRate || 0,
    };
  }, [entries, allTargetedWsIds, convertedWsIds, dayStats]);

  // Chart data
  const chartData = useMemo(() => {
    return dayStats
      .filter((d) => d.totalSent > 0)
      .map((d) => ({
        name: getDayLabel(d.day).replace("Vencimento (Dia 0)", "Dia 0"),
        WhatsApp: d.waConvRate,
        "E-mail": d.emConvRate,
      }));
  }, [dayStats]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-64" /></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Métricas de Conversão da Cadência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum disparo de cadência registrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Métricas de Conversão da Cadência
            </CardTitle>
            <CardDescription>
              Acompanhe a performance dos disparos por canal e momento
            </CardDescription>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Overview Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Send className="w-4 h-4" />
              <span className="text-xs font-medium">Total Disparos</span>
            </div>
            <p className="text-2xl font-bold">{overview.totalDisparos}</p>
            {overview.totalFailed > 0 && (
              <p className="text-[11px] text-destructive mt-1">{overview.totalFailed} falha(s)</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Taxa Conversão</span>
            </div>
            <p className="text-2xl font-bold">{overview.convRate}%</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {overview.totalConverted} de {overview.totalTargeted} workspaces
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="w-4 h-4" />
              <span className="text-xs font-medium">Melhor Canal</span>
            </div>
            <div className="flex items-center gap-2">
              {overview.bestChannel === "WhatsApp" ? (
                <MessageSquare className="w-5 h-5 text-emerald-500" />
              ) : (
                <Mail className="w-5 h-5 text-blue-500" />
              )}
              <p className="text-lg font-bold">{overview.bestChannel}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{overview.bestChannelRate}% conversão</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-xs font-medium">Melhor Momento</span>
            </div>
            <p className="text-lg font-bold">{overview.bestDayLabel}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{overview.bestDayRate}% conversão</p>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="align-bottom border-r">Momento</TableHead>
                <TableHead colSpan={3} className="text-center border-r bg-emerald-500/5">
                  <div className="flex items-center justify-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </div>
                </TableHead>
                <TableHead colSpan={3} className="text-center border-r bg-blue-500/5">
                  <div className="flex items-center justify-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> E-mail
                  </div>
                </TableHead>
                <TableHead className="text-center">Conv. Total</TableHead>
              </TableRow>
              <TableRow>
                <TableHead className="text-center text-[11px] bg-emerald-500/5">Enviados</TableHead>
                <TableHead className="text-center text-[11px] bg-emerald-500/5">Convertidos</TableHead>
                <TableHead className="text-center text-[11px] bg-emerald-500/5 border-r">Taxa</TableHead>
                <TableHead className="text-center text-[11px] bg-blue-500/5">Enviados</TableHead>
                <TableHead className="text-center text-[11px] bg-blue-500/5">Convertidos</TableHead>
                <TableHead className="text-center text-[11px] bg-blue-500/5 border-r">Taxa</TableHead>
                <TableHead className="text-center text-[11px]">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayStats.map((d) => (
                <TableRow key={d.day}>
                  <TableCell className="font-medium border-r whitespace-nowrap">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {d.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center bg-emerald-500/[0.02]">
                    {d.waSent > 0 ? d.waSent : "—"}
                    {d.waFailed > 0 && <span className="text-destructive text-[10px] ml-1">({d.waFailed}✗)</span>}
                  </TableCell>
                  <TableCell className="text-center bg-emerald-500/[0.02] font-semibold">
                    {d.waConverted > 0 ? d.waConverted : "—"}
                  </TableCell>
                  <TableCell className="text-center bg-emerald-500/[0.02] border-r">
                    {d.waSent > 0 ? (
                      <Badge variant="outline" className={d.waConvRate > 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : ""}>
                        {d.waConvRate}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center bg-blue-500/[0.02]">
                    {d.emSent > 0 ? d.emSent : "—"}
                    {d.emFailed > 0 && <span className="text-destructive text-[10px] ml-1">({d.emFailed}✗)</span>}
                  </TableCell>
                  <TableCell className="text-center bg-blue-500/[0.02] font-semibold">
                    {d.emConverted > 0 ? d.emConverted : "—"}
                  </TableCell>
                  <TableCell className="text-center bg-blue-500/[0.02] border-r">
                    {d.emSent > 0 ? (
                      <Badge variant="outline" className={d.emConvRate > 0 ? "bg-blue-500/10 text-blue-600 border-blue-200" : ""}>
                        {d.emConvRate}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {d.totalSent > 0 ? (
                      <Badge variant={d.convRate > 0 ? "default" : "outline"} className={d.convRate > 0 ? "bg-primary/10 text-primary border-primary/20" : ""}>
                        {d.convRate}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── Bar Chart ── */}
        {chartData.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Conversão por canal e momento (%)
            </h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={50} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}%`, undefined]}
                />
                <Legend />
                <Bar dataKey="WhatsApp" fill="#25D366" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="E-mail" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
