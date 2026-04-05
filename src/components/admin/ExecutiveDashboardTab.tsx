import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DollarSign,
  Users,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface DrilldownItem {
  id?: string;
  name?: string;
  workspace_name?: string;
  plan_name?: string;
  email?: string;
  phone?: string;
  subscription_status?: string;
  created_at?: string;
  trial_end?: string;
  days_left?: number;
  blocked_at?: string;
  pack_size?: number;
  price_paid?: number;
  payment_provider?: string;
}

interface DashboardData {
  current_mrr: number;
  mrr_variation: number;
  active_clients: number;
  active_trials: number;
  past_due_count: number;
  churn_count: number;
  churn_value: number;
  trials_expiring: {
    id: string; name: string; email: string; phone: string; days_left: number; trial_end: string; plan_name?: string;
  }[];
  at_limit: {
    id: string; name: string; plan: string; email: string; phone: string; leads_used: number; lead_limit: number; ai_used: number; ai_limit: number;
  }[];
  mrr_history: { month: string; mrr: number; clients: number }[];
  plan_distribution: { plan: string; count: number; active: number; trialing: number; past_due: number; mrr: number }[];
  provider_distribution: { stripe: number; asaas: number; none: number };
  lead_packs: { total_active: number; total_extra_leads: number; total_mrr: number };
  funnel: { signups: number; trials: number; converted: number; conversion_rate: number };
  new_clients: { id: string; name: string; created_at: string; plan: string; status: string; email: string; phone: string; payment_provider?: string }[];
  total_workspaces: number;
  // Drill-down lists
  active_clients_list?: DrilldownItem[];
  active_trials_list?: DrilldownItem[];
  churn_list?: DrilldownItem[];
  past_due_list?: DrilldownItem[];
  lead_packs_list?: DrilldownItem[];
  provider_clients?: { stripe_list: DrilldownItem[]; asaas_list: DrilldownItem[]; none_list: DrilldownItem[] };
  plan_clients?: Record<string, { active_list: DrilldownItem[]; trial_list: DrilldownItem[]; past_due_list: DrilldownItem[] }>;
}

const PLAN_LABELS: Record<string, string> = {
  gratuito: "Gratuito", essencial: "Essencial", negocio: "Negócio", escala: "Escala", semente: "Semente", trial: "Trial",
};

const PLAN_COLORS: Record<string, string> = {
  gratuito: "#6B7280", essencial: "#10B981", negocio: "#3B82F6", escala: "#8B5CF6",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);

const openWhatsApp = (phone: string) => {
  const clean = phone.replace(/\D/g, "");
  const num = clean.startsWith("55") ? clean : `55${clean}`;
  window.open(`https://wa.me/${num}`, "_blank");
};

export default function ExecutiveDashboardTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [drilldown, setDrilldown] = useState<{ title: string; items: DrilldownItem[]; type: string } | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-clients", { body: { action: "executive-dashboard" } });
      if (error) throw error;
      setData(result as DashboardData);
      setLastUpdated(new Date());
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Erro ao carregar dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Carregando dashboard...</span>
      </div>
    );
  }

  if (!data) return null;

  const mrrUp = data.mrr_variation >= 0;

  const openDrilldown = (title: string, items: DrilldownItem[], type: string) => {
    setDrilldown({ title, items, type });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard Executivo</h2>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR */}
        <Card
          className="border-none bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => data.active_clients_list && openDrilldown("MRR Atual — Clientes Pagos", data.active_clients_list, "clients")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">MRR Atual</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(data.current_mrr)}</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-sm ${mrrUp ? "text-emerald-600" : "text-destructive"}`}>
              {mrrUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span className="font-medium">{Math.abs(data.mrr_variation).toFixed(1)}%</span>
              <span className="text-muted-foreground">vs mês anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Clients */}
        <Card
          className="border-none bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 cursor-pointer hover:ring-2 hover:ring-emerald-500/30 transition-all"
          onClick={() => data.active_clients_list && openDrilldown("Clientes Ativos", data.active_clients_list, "clients")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Clientes Ativos</p>
                <p className="text-2xl font-bold mt-1">{data.active_clients}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Com plano pago ativo · Clique para ver</p>
          </CardContent>
        </Card>

        {/* Active Trials */}
        <Card
          className="border-none bg-gradient-to-br from-amber-500/10 to-amber-500/5 cursor-pointer hover:ring-2 hover:ring-amber-500/30 transition-all"
          onClick={() => data.active_trials_list && openDrilldown("Trials Ativos", data.active_trials_list, "trials")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Trials Ativos</p>
                <p className="text-2xl font-bold mt-1">{data.active_trials}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Em período de teste · Clique para ver</p>
          </CardContent>
        </Card>

        {/* Churn */}
        <Card
          className="border-none bg-gradient-to-br from-destructive/10 to-destructive/5 cursor-pointer hover:ring-2 hover:ring-destructive/30 transition-all"
          onClick={() => data.churn_list && openDrilldown("Churn do Mês", data.churn_list, "churn")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Churn do Mês</p>
                <p className="text-2xl font-bold mt-1">{data.churn_count}</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
            </div>
            <p className="text-xs text-destructive mt-2 font-medium">
              {formatCurrency(data.churn_value)} perdidos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Alert Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trials expiring */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              🔴 Trials expirando em 7 dias ({data.trials_expiring.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.trials_expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum trial expirando.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.trials_expiring.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-background/80 text-sm">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.email} · {t.days_left} dia(s) restante(s)</p>
                    </div>
                    {t.phone && (
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openWhatsApp(t.phone)}>
                        <MessageSquare className="w-3 h-3" /> WhatsApp
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At plan limit */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <Zap className="w-4 h-4" />
              🟠 Clientes no limite do plano ({data.at_limit.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.at_limit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente no limite.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {data.at_limit.map((c) => {
                  const leadPct = c.lead_limit > 0 ? Math.round((c.leads_used / c.lead_limit) * 100) : 0;
                  const aiPct = c.ai_limit > 0 ? Math.round((c.ai_used / c.ai_limit) * 100) : 0;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-background/80 text-sm">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {PLAN_LABELS[c.plan] || c.plan} · Leads: {leadPct}% · IA: {aiPct}%
                        </p>
                      </div>
                      {c.phone && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openWhatsApp(c.phone)}>
                          <TrendingUp className="w-3 h-3" /> Oferecer upgrade
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Crescimento MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.mrr_history}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="mrr" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="clients" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number, name: string) => name === "MRR" ? formatCurrency(value) : `${value} clientes`} />
                <Line yAxisId="mrr" type="monotone" dataKey="mrr" name="MRR" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                <Line yAxisId="clients" type="monotone" dataKey="clients" name="Clientes" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Funil de Conversão — Mês Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[
                  { name: "Cadastros", value: data.funnel.signups, fill: "#6B7280" },
                  { name: "Trials", value: data.funnel.trials, fill: "#F59E0B" },
                  { name: "Pagos", value: data.funnel.converted, fill: "#10B981" },
                ]}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" name="Total" radius={[0, 6, 6, 0]}>
                  {[{ fill: "#6B7280" }, { fill: "#F59E0B" }, { fill: "#10B981" }].map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <Badge variant="outline" className="text-primary border-primary/30 text-sm font-semibold px-3">
                Taxa de conversão: {data.funnel.conversion_rate.toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Distribution — detailed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Distribuição por Plano (Total: {data.total_workspaces} workspaces)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.plan_distribution}
                  dataKey="count"
                  nameKey="plan"
                  cx="50%" cy="50%"
                  outerRadius={90} innerRadius={50}
                  label={({ plan, count }) => `${PLAN_LABELS[plan] || plan}: ${count}`}
                >
                  {data.plan_distribution.map((entry) => (
                    <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] || "#6B7280"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [value, PLAN_LABELS[name] || name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {data.plan_distribution.map((p) => (
                <div key={p.plan} className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.plan] || "#6B7280" }} />
                      <span className="font-medium text-sm">{PLAN_LABELS[p.plan] || p.plan}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{p.count} total</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(p.mrr)}/mês</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    {p.active > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20"
                        onClick={() => data.plan_clients?.[p.plan] && openDrilldown(`${PLAN_LABELS[p.plan] || p.plan} — Pagos`, data.plan_clients[p.plan].active_list, "clients")}
                      >
                        {p.active} pagos
                      </Badge>
                    )}
                    {p.trialing > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30 cursor-pointer hover:bg-amber-500/20"
                        onClick={() => data.plan_clients?.[p.plan] && openDrilldown(`${PLAN_LABELS[p.plan] || p.plan} — Trial`, data.plan_clients[p.plan].trial_list, "trials")}
                      >
                        {p.trialing} trial
                      </Badge>
                    )}
                    {p.past_due > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-destructive/10 text-destructive border-destructive/30 cursor-pointer hover:bg-destructive/20"
                        onClick={() => data.plan_clients?.[p.plan] && openDrilldown(`${PLAN_LABELS[p.plan] || p.plan} — Inadimplentes`, data.plan_clients[p.plan].past_due_list, "clients")}
                      >
                        {p.past_due} inadimplente
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead Packs + Provider Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          onClick={() => data.lead_packs_list && openDrilldown("Pacotes de Leads Ativos", data.lead_packs_list, "packs")}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Pacotes de Leads · Clique para ver</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pacotes ativos</span>
                <span className="font-bold">{data.lead_packs?.total_active || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Leads extras totais</span>
                <span className="font-bold">{(data.lead_packs?.total_extra_leads || 0).toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">MRR pacotes</span>
                <span className="font-bold">{formatCurrency(data.lead_packs?.total_mrr || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Distribuição por Provedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                onClick={() => data.provider_clients?.stripe_list && openDrilldown("Clientes Stripe (legado)", data.provider_clients.stripe_list, "clients")}
              >
                <span className="text-sm text-muted-foreground">Stripe (legado)</span>
                <Badge variant="outline">{data.provider_distribution?.stripe || 0}</Badge>
              </div>
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                onClick={() => data.provider_clients?.asaas_list && openDrilldown("Clientes Asaas", data.provider_clients.asaas_list, "clients")}
              >
                <span className="text-sm text-muted-foreground">Asaas</span>
                <Badge variant="outline">{data.provider_distribution?.asaas || 0}</Badge>
              </div>
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                onClick={() => data.provider_clients?.none_list && openDrilldown("Sem provedor", data.provider_clients.none_list, "clients")}
              >
                <span className="text-sm text-muted-foreground">Sem provedor</span>
                <Badge variant="outline">{data.provider_distribution?.none || 0}</Badge>
              </div>
              {data.past_due_count > 0 && (
                <div
                  className="flex items-center justify-between pt-2 border-t border-border cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  onClick={() => data.past_due_list && openDrilldown("Inadimplentes", data.past_due_list, "clients")}
                >
                  <span className="text-sm text-destructive font-medium">Inadimplentes</span>
                  <Badge variant="destructive">{data.past_due_count}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New clients this month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Novos Clientes do Mês ({data.new_clients.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.new_clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Nenhum novo cliente neste mês.
                  </TableCell>
                </TableRow>
              ) : (
                data.new_clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline">{PLAN_LABELS[c.plan] || c.plan}</Badge></TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "active" ? "default" : "secondary"}
                        className={c.status === "active" ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : ""}
                      >
                        {c.status === "active" ? "Pago" : c.status === "trialing" ? "Trial" : c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{c.email}</TableCell>
                    <TableCell className="text-right">
                      {c.phone && (
                        <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => openWhatsApp(c.phone)}>
                          <MessageSquare className="w-3 h-3" /> Contatar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Drill-down Sheet ── */}
      <Sheet open={!!drilldown} onOpenChange={(open) => !open && setDrilldown(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drilldown?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {drilldown && drilldown.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum registro encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    {drilldown?.type === "packs" ? (
                      <>
                        <TableHead>Leads</TableHead>
                        <TableHead>Valor</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>Plano</TableHead>
                        {drilldown?.type === "trials" && <TableHead>Dias restantes</TableHead>}
                        {drilldown?.type === "churn" && <TableHead>Bloqueado em</TableHead>}
                        <TableHead>E-mail</TableHead>
                        <TableHead className="text-right">WhatsApp</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldown?.items.map((item, idx) => (
                    <TableRow key={item.id || idx}>
                      <TableCell className="font-medium">{item.name || item.workspace_name}</TableCell>
                      {drilldown.type === "packs" ? (
                        <>
                          <TableCell>{(item.pack_size || 0).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{formatCurrency(item.price_paid || 0)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <Badge variant="outline">{PLAN_LABELS[item.plan_name || ""] || item.plan_name || "—"}</Badge>
                          </TableCell>
                          {drilldown.type === "trials" && (
                            <TableCell>
                              <Badge variant={item.days_left && item.days_left <= 3 ? "destructive" : "secondary"}>
                                {item.days_left} dia(s)
                              </Badge>
                            </TableCell>
                          )}
                          {drilldown.type === "churn" && (
                            <TableCell className="text-xs text-muted-foreground">
                              {item.blocked_at ? new Date(item.blocked_at).toLocaleDateString("pt-BR") : "—"}
                            </TableCell>
                          )}
                          <TableCell className="text-xs text-muted-foreground">{item.email || "—"}</TableCell>
                          <TableCell className="text-right">
                            {item.phone ? (
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => openWhatsApp(item.phone!)}>
                                <ExternalLink className="w-3 h-3" /> WhatsApp
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
