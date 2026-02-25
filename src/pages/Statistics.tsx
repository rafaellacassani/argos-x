import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Clock,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface FunnelStageData {
  name: string;
  value: number;
  fill: string;
}

interface MonthlyPoint {
  month: string;
  leads: number;
  fechados: number;
  receita: number;
}

interface SourceConversion {
  source: string;
  total: number;
  won: number;
  taxa: number;
}

interface TeamMember {
  name: string;
  userId: string;
  leads: number;
  fechados: number;
  receita: number;
}

export default function Statistics() {
  const { workspace } = useWorkspace();
  const [period, setPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);

  // Raw data
  const [totalLeads, setTotalLeads] = useState(0);
  const [wonLeads, setWonLeads] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgCloseDays, setAvgCloseDays] = useState<number | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStageData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([]);
  const [sourceData, setSourceData] = useState<SourceConversion[]>([]);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);

  // Variation
  const [prevTotalLeads, setPrevTotalLeads] = useState(0);
  const [prevWonLeads, setPrevWonLeads] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [prevAvgClose, setPrevAvgClose] = useState<number | null>(null);

  const periodDays = useMemo(() => {
    switch (period) {
      case "7d": return 7;
      case "30d": return 30;
      case "90d": return 90;
      case "year": return 365;
      default: return 30;
    }
  }, [period]);

  useEffect(() => {
    if (!workspace?.id) return;
    fetchAll();
  }, [workspace?.id, periodDays]);

  async function fetchAll() {
    if (!workspace?.id) return;
    setLoading(true);

    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 86400000);
    const prevStart = new Date(periodStart.getTime() - periodDays * 86400000);
    const periodStartISO = periodStart.toISOString();
    const prevStartISO = prevStart.toISOString();

    try {
      // 1. Fetch funnel stages
      const { data: stages } = await supabase
        .from("funnel_stages")
        .select("id, name, color, position, is_win_stage, is_loss_stage, funnel_id")
        .eq("workspace_id", workspace.id)
        .order("position");

      const winStageIds = (stages || []).filter(s => s.is_win_stage).map(s => s.id);

      // 2. Fetch all leads in period
      const { data: leadsInPeriod } = await supabase
        .from("leads")
        .select("id, stage_id, source, responsible_user, created_at, value")
        .eq("workspace_id", workspace.id)
        .gte("created_at", periodStartISO);

      // 3. Fetch leads in previous period
      const { data: leadsInPrev } = await supabase
        .from("leads")
        .select("id, stage_id, created_at, value")
        .eq("workspace_id", workspace.id)
        .gte("created_at", prevStartISO)
        .lt("created_at", periodStartISO);

      // 4. Fetch ALL leads (for funnel distribution)
      const { data: allLeads } = await supabase
        .from("leads")
        .select("id, stage_id, source, responsible_user, created_at")
        .eq("workspace_id", workspace.id);

      // 5. Fetch sales in period
      const { data: salesInPeriod } = await supabase
        .from("lead_sales")
        .select("id, lead_id, value, sale_date, created_by")
        .eq("workspace_id", workspace.id)
        .gte("sale_date", periodStart.toISOString().split("T")[0]);

      // 6. Fetch sales in previous period
      const { data: salesInPrev } = await supabase
        .from("lead_sales")
        .select("id, value")
        .eq("workspace_id", workspace.id)
        .gte("sale_date", prevStart.toISOString().split("T")[0])
        .lt("sale_date", periodStart.toISOString().split("T")[0]);

      // 7. Fetch user profiles for team names
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, user_id, full_name");

      const leads = leadsInPeriod || [];
      const prevLeads = leadsInPrev || [];
      const sales = salesInPeriod || [];
      const prevSales = salesInPrev || [];
      const allLeadsList = allLeads || [];
      const stagesList = stages || [];
      const profilesList = profiles || [];

      // ---- KPIs ----
      const tl = leads.length;
      const wl = leads.filter(l => winStageIds.includes(l.stage_id)).length;
      const rev = sales.reduce((s, sl) => s + (Number(sl.value) || 0), 0);

      setTotalLeads(tl);
      setWonLeads(wl);
      setTotalRevenue(rev);

      // Prev KPIs
      const ptl = prevLeads.length;
      const pwl = prevLeads.filter(l => winStageIds.includes(l.stage_id)).length;
      const prev = prevSales.reduce((s, sl) => s + (Number(sl.value) || 0), 0);
      setPrevTotalLeads(ptl);
      setPrevWonLeads(pwl);
      setPrevRevenue(prev);

      // Avg close days: for won leads, diff between created_at and now (approximation)
      // Better: use lead_history to find when they moved to win stage
      const { data: wonHistory } = await supabase
        .from("lead_history")
        .select("lead_id, created_at")
        .eq("workspace_id", workspace.id)
        .eq("action", "stage_change")
        .in("to_stage_id", winStageIds);

      if (wonHistory && wonHistory.length > 0) {
        // Map lead creation dates
        const leadCreationMap: Record<string, string> = {};
        allLeadsList.forEach(l => { leadCreationMap[l.id] = l.created_at; });

        const closeDays: number[] = [];
        const prevCloseDays: number[] = [];
        wonHistory.forEach(h => {
          const created = leadCreationMap[h.lead_id];
          if (!created) return;
          const days = Math.max(0, Math.floor((new Date(h.created_at).getTime() - new Date(created).getTime()) / 86400000));
          const histDate = new Date(h.created_at);
          if (histDate >= periodStart) {
            closeDays.push(days);
          } else if (histDate >= new Date(prevStartISO)) {
            prevCloseDays.push(days);
          }
        });
        setAvgCloseDays(closeDays.length > 0 ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length) : null);
        setPrevAvgClose(prevCloseDays.length > 0 ? Math.round(prevCloseDays.reduce((a, b) => a + b, 0) / prevCloseDays.length) : null);
      } else {
        setAvgCloseDays(null);
        setPrevAvgClose(null);
      }

      // ---- Funnel ----
      const funnelCounts: FunnelStageData[] = stagesList.map(s => ({
        name: s.name,
        value: allLeadsList.filter(l => l.stage_id === s.id).length,
        fill: s.color || "#6B7280",
      }));
      setFunnelData(funnelCounts);

      // ---- Monthly data (last 7 months) ----
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthly: MonthlyPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const mLeads = allLeadsList.filter(l => {
          const c = new Date(l.created_at);
          return c >= d && c <= mEnd;
        }).length;
        const mWon = allLeadsList.filter(l => {
          const c = new Date(l.created_at);
          return c >= d && c <= mEnd && winStageIds.includes(l.stage_id);
        }).length;
        // Revenue per month from sales
        const mRev = (salesInPeriod || []).filter(s => {
          const sd = new Date(s.sale_date);
          return sd >= d && sd <= mEnd;
        }).reduce((acc, s) => acc + (Number(s.value) || 0), 0);

        monthly.push({
          month: monthNames[d.getMonth()],
          leads: mLeads,
          fechados: mWon,
          receita: mRev,
        });
      }
      setMonthlyData(monthly);

      // ---- Conversion by source ----
      const sourceMap: Record<string, { total: number; won: number }> = {};
      allLeadsList.forEach(l => {
        const src = l.source || "manual";
        if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0 };
        sourceMap[src].total++;
        if (winStageIds.includes(l.stage_id)) sourceMap[src].won++;
      });
      const sourceConvArr: SourceConversion[] = Object.entries(sourceMap)
        .map(([source, { total, won }]) => ({
          source: formatSourceLabel(source),
          total,
          won,
          taxa: total > 0 ? parseFloat(((won / total) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.taxa - a.taxa);
      setSourceData(sourceConvArr);

      // ---- Team performance ----
      const teamMap: Record<string, { leads: number; userId: string }> = {};
      leads.forEach(l => {
        if (!l.responsible_user) return;
        if (!teamMap[l.responsible_user]) teamMap[l.responsible_user] = { leads: 0, userId: l.responsible_user };
        teamMap[l.responsible_user].leads++;
      });

      const teamArr: TeamMember[] = Object.entries(teamMap).map(([userId, data]) => {
        const profile = profilesList.find(p => p.user_id === userId || p.id === userId);
        const userSales = sales.filter(s => s.created_by === userId);
        const userRevenue = userSales.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
        const userWon = leads.filter(l => l.responsible_user === userId && winStageIds.includes(l.stage_id)).length;
        return {
          name: profile?.full_name || "Sem nome",
          userId,
          leads: data.leads,
          fechados: userWon,
          receita: userRevenue,
        };
      }).sort((a, b) => b.receita - a.receita);
      setTeamData(teamArr);

    } catch (err) {
      console.error("Statistics fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100) : 0;
  const prevConversionRate = prevTotalLeads > 0 ? ((prevWonLeads / prevTotalLeads) * 100) : 0;

  function calcVariation(curr: number, prev: number) {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
  }

  const stats = [
    {
      title: "Total de Leads",
      value: totalLeads.toLocaleString("pt-BR"),
      icon: Users,
      change: calcVariation(totalLeads, prevTotalLeads),
    },
    {
      title: "Taxa de Conversão",
      value: `${conversionRate.toFixed(1)}%`,
      icon: Target,
      change: calcVariation(conversionRate, prevConversionRate),
    },
    {
      title: "Receita Total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      change: calcVariation(totalRevenue, prevRevenue),
    },
    {
      title: "Tempo Médio de Fechamento",
      value: avgCloseDays !== null ? `${avgCloseDays} dias` : "N/A",
      icon: Clock,
      change: prevAvgClose !== null && avgCloseDays !== null
        ? calcVariation(prevAvgClose, avgCloseDays) // inverted: lower is better
        : 0,
    },
  ];

  const maxTeamRevenue = Math.max(...teamData.map(t => t.receita), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Estatísticas</h1>
          <p className="text-muted-foreground">Análises detalhadas do seu funil de vendas</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const isPositive = stat.change >= 0;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="inboxia-card p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-secondary" />
                </div>
                {stat.change !== 0 && (
                  <div className="flex items-center gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 text-success" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-destructive" />
                    )}
                    <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
                      {Math.abs(stat.change)}%
                    </span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Funnel Chart */}
      {funnelData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-6">Funil de Vendas</h3>
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${funnelData.length}, 1fr)` }}>
            {funnelData.map((stage, index) => {
              const maxVal = Math.max(...funnelData.map(s => s.value), 1);
              const prevValue = index > 0 ? funnelData[index - 1].value : stage.value;
              const convRate = index > 0 && prevValue > 0 ? ((stage.value / prevValue) * 100).toFixed(1) : "100";
              const width = (stage.value / maxVal) * 100;

              return (
                <div key={stage.name} className="text-center">
                  <div
                    className="h-32 rounded-lg flex items-center justify-center mx-auto mb-3 transition-all hover:scale-105"
                    style={{
                      width: `${Math.max(width, 30)}%`,
                      background: stage.fill,
                    }}
                  >
                    <span className="text-white font-bold text-lg">{stage.value}</span>
                  </div>
                  <p className="text-sm font-medium">{stage.name}</p>
                  {index > 0 && (
                    <p className="text-xs text-muted-foreground">{convRate}% conversão</p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area type="monotone" dataKey="leads" stroke="hsl(var(--secondary))" fill="hsl(var(--secondary) / 0.2)" strokeWidth={2} name="Leads" />
              <Area type="monotone" dataKey="fechados" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" strokeWidth={2} name="Fechados" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Conversion by Source */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Taxa de Conversão por Fonte</h3>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sourceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
                <YAxis dataKey="source" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Taxa"]}
                />
                <Bar dataKey="taxa" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados de fontes</p>
          )}
        </motion.div>
      </div>

      {/* Team Performance */}
      {teamData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Performance do Time</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vendedor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Leads</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Fechados</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Conversão</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Receita</th>
                  <th className="py-3 px-4 text-sm font-medium text-muted-foreground">Progresso</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map((member, index) => {
                  const conversion = member.leads > 0 ? ((member.fechados / member.leads) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={member.userId} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                            {member.name[0]}
                          </div>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-4 px-4">{member.leads}</td>
                      <td className="text-right py-4 px-4 text-success font-medium">{member.fechados}</td>
                      <td className="text-right py-4 px-4">{conversion}%</td>
                      <td className="text-right py-4 px-4 font-medium">
                        {formatCurrency(member.receita)}
                      </td>
                      <td className="py-4 px-4 w-40">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(member.receita / maxTeamRevenue) * 100}%` }}
                            transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                            className="h-full bg-secondary rounded-full"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSourceLabel(source: string): string {
  const map: Record<string, string> = {
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    instagram: "Instagram",
    manual: "Manual",
    import: "Importação",
    campaign: "Campanha",
  };
  return map[source.toLowerCase()] || source;
}
