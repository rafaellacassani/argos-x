import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Search, RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Bot, MessageSquare, Wifi, WifiOff, Activity, Users, Zap, MessageCircle, Coins, Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentHealth {
  id: string;
  name: string;
  model: string;
  is_active: boolean;
  interactions_24h: number;
  responded_24h: boolean;
  tokens_total: number;
  cost_brl: number;
}

interface InstanceHealth {
  instance_name: string;
  display_name: string | null;
  type: "evolution" | "waba";
  status: "connected" | "disconnected" | "error";
}

interface WorkspaceOwner {
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface WorkspaceHealth {
  id: string;
  name: string;
  plan_type: string;
  plan_name: string | null;
  subscription_status: string;
  trial_end: string | null;
  blocked_at: string | null;
  leads_used: number;
  lead_limit: number;
  extra_leads: number;
  ai_used: number;
  ai_limit: number;
  members_count: number;
  owner: WorkspaceOwner | null;
  agents: AgentHealth[];
  instances: InstanceHealth[];
  alerts: string[];
  tokens_total: number;
  tokens_30d: number;
  executions_30d: number;
  cost_estimate_brl: number;
}

export default function WorkspaceHealthTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkspaceHealth[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedWs, setSelectedWs] = useState<WorkspaceHealth | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("admin-clients", {
        body: { action: "health-monitoring" },
      });
      if (error) throw error;
      setData(result?.workspaces || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  const getUsageColor = (used: number, limit: number) => {
    if (limit <= 0) return "bg-muted";
    const pct = (used / limit) * 100;
    if (pct > 90) return "text-destructive";
    if (pct >= 70) return "text-yellow-600";
    return "text-emerald-600";
  };

  const getUsagePct = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getTrialDaysLeft = (trialEnd: string | null) => {
    if (!trialEnd) return null;
    return Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (ws: WorkspaceHealth) => {
    if (ws.blocked_at) return <Badge variant="destructive" className="text-xs">Bloqueado</Badge>;
    if (ws.subscription_status === "trialing") {
      const days = getTrialDaysLeft(ws.trial_end);
      return <Badge variant={days !== null && days <= 3 ? "destructive" : "secondary"} className="text-xs">Trial {days}d</Badge>;
    }
    if (ws.alerts.length > 0) return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" />{ws.alerts.length}</Badge>;
    return <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">OK</Badge>;
  };

  const connectedCount = (ws: WorkspaceHealth) => ws.instances.filter(i => i.status === "connected").length;

  const filtered = data.filter(ws => {
    if (search && !ws.name.toLowerCase().includes(search.toLowerCase()) && !ws.owner?.name?.toLowerCase().includes(search.toLowerCase()) && !ws.owner?.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "alerts" && ws.alerts.length === 0) return false;
    if (filter === "trial-expiring") {
      const days = getTrialDaysLeft(ws.trial_end);
      if (days === null || days > 7 || days < 0) return false;
    }
    if (filter === "critical") {
      const leadPct = ws.lead_limit > 0 ? (ws.leads_used / (ws.lead_limit + ws.extra_leads)) * 100 : 0;
      const aiPct = ws.ai_limit > 0 ? (ws.ai_used / ws.ai_limit) * 100 : 0;
      if (leadPct <= 90 && aiPct <= 90) return false;
    }
    if (filter === "with-agents" && ws.agents.length === 0) return false;
    if (filter === "with-active-agents" && !ws.agents.some(a => a.is_active)) return false;
    if (filter === "no-agents" && ws.agents.length > 0) return false;
    if (filter === "with-instances" && !ws.instances.some(i => i.status === "connected")) return false;
    if (filter === "no-instances" && ws.instances.length > 0) return false;
    if (filter === "disconnected-instances" && !ws.instances.some(i => i.status !== "connected")) return false;
    if (filter === "high-tokens" && (ws.tokens_30d || 0) < 10000) return false;
    if (filter === "blocked" && !ws.blocked_at) return false;
    if (filter === "inactive") {
      const hasActivity = ws.agents.some(a => a.interactions_24h > 0);
      if (hasActivity || ws.agents.length === 0) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar workspace ou dono..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="alerts">⚠️ Com alertas</SelectItem>
            <SelectItem value="critical">🔴 Consumo crítico</SelectItem>
            <SelectItem value="high-tokens">🔥 Tokens alto 30d</SelectItem>
            <SelectItem value="trial-expiring">⏰ Trial expirando</SelectItem>
            <SelectItem value="blocked">🚫 Bloqueados</SelectItem>
            <SelectItem value="with-active-agents">✅ Agente ativo</SelectItem>
            <SelectItem value="no-agents">❌ Sem agentes</SelectItem>
            <SelectItem value="disconnected-instances">⛔ Instância off</SelectItem>
            <SelectItem value="inactive">💤 Inativos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchHealth} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} workspaces</span>
      </div>

      {/* Compact Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Exec. 30d</TableHead>
              <TableHead className="text-center">Tokens 30d</TableHead>
              <TableHead className="text-center">Instâncias</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(ws => {
              const totalLeadLimit = ws.lead_limit + ws.extra_leads;
              return (
                <TableRow key={ws.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedWs(ws)}>
                  <TableCell>
                    <div className="min-w-0">
                      <span className="font-medium text-sm truncate block">{ws.name}</span>
                      {ws.owner?.name && <span className="text-xs text-muted-foreground truncate block">{ws.owner.name}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{ws.plan_name || ws.plan_type}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs font-medium ${getUsageColor(ws.leads_used, totalLeadLimit)}`}>
                      {ws.leads_used}/{totalLeadLimit}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-medium">{(ws.executions_30d || 0).toLocaleString("pt-BR")}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-medium">{(ws.tokens_30d || 0).toLocaleString("pt-BR")}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs">
                      {connectedCount(ws)}/{ws.instances.length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{getStatusBadge(ws)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setSelectedWs(ws); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum workspace encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedWs} onOpenChange={(open) => !open && setSelectedWs(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedWs && <WorkspaceDetailPanel ws={selectedWs} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function WorkspaceDetailPanel({ ws }: { ws: WorkspaceHealth }) {
  const totalLeadLimit = ws.lead_limit + ws.extra_leads;
  const trialDays = ws.trial_end ? Math.ceil((new Date(ws.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const getBarColor = (used: number, limit: number) => {
    if (limit <= 0) return "bg-muted";
    const pct = (used / limit) * 100;
    if (pct > 90) return "bg-destructive";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const pct = (used: number, limit: number) => limit <= 0 ? 0 : Math.min((used / limit) * 100, 100);

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 flex-wrap">
          {ws.name}
          <Badge variant="outline" className="text-xs">{ws.plan_name || ws.plan_type}</Badge>
          {ws.blocked_at && <Badge variant="destructive" className="text-xs">Bloqueado</Badge>}
          {ws.subscription_status === "trialing" && trialDays !== null && (
            <Badge variant={trialDays <= 3 ? "destructive" : "secondary"} className="text-xs">Trial: {trialDays}d</Badge>
          )}
        </SheetTitle>
      </SheetHeader>

      {/* Owner */}
      {ws.owner && (
        <div className="flex items-center justify-between text-sm">
          <div>
            <p className="font-medium">{ws.owner.name}</p>
            <p className="text-xs text-muted-foreground">{ws.owner.email}</p>
          </div>
          {ws.owner.phone && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
              const clean = ws.owner!.phone!.replace(/\D/g, "");
              const phone = clean.startsWith("55") ? clean : `55${clean}`;
              window.open(`https://web.whatsapp.com/send?phone=${phone}`, "_blank", "noopener,noreferrer");
            }}>
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </Button>
          )}
        </div>
      )}

      {/* Usage bars */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm"><span>Leads</span><span className="text-muted-foreground">{ws.leads_used} / {totalLeadLimit}</span></div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${getBarColor(ws.leads_used, totalLeadLimit)}`} style={{ width: `${pct(ws.leads_used, totalLeadLimit)}%` }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm"><span>Interações IA</span><span className="text-muted-foreground">{ws.ai_used} / {ws.ai_limit}</span></div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${getBarColor(ws.ai_used, ws.ai_limit)}`} style={{ width: `${pct(ws.ai_used, ws.ai_limit)}%` }} />
          </div>
        </div>
      </div>

      {/* 30d Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{(ws.executions_30d || 0).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Execuções 30d</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">{(ws.tokens_30d || 0).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Tokens 30d</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold">R$ {ws.cost_estimate_brl?.toFixed(2) || "0.00"}</p>
          <p className="text-xs text-muted-foreground">Custo est.</p>
        </div>
      </div>

      {/* Alerts */}
      {ws.alerts.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-destructive">Alertas</span>
          <div className="flex flex-wrap gap-2">
            {ws.alerts.map((alert, i) => (
              <Badge key={i} variant="destructive" className="text-xs gap-1"><AlertTriangle className="w-3 h-3" /> {alert}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Agents */}
      {ws.agents.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Agentes de IA</span>
          <div className="grid gap-2">
            {ws.agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                <Bot className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate flex-1">{agent.name}</span>
                <Badge variant="outline" className="text-xs font-mono">{agent.model}</Badge>
                <Badge variant={agent.is_active ? "default" : "secondary"} className="text-xs">
                  {agent.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  <Zap className="w-3 h-3 inline mr-0.5" />{agent.interactions_24h}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  <Coins className="w-3 h-3 inline mr-0.5" />{agent.tokens_total?.toLocaleString("pt-BR") || 0}
                </span>
                {agent.is_active && (
                  agent.responded_24h ? (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 gap-1"><Activity className="w-3 h-3" />OK</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 gap-1"><AlertTriangle className="w-3 h-3" />Sem ativ.</Badge>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instances */}
      {ws.instances.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">Instâncias WhatsApp</span>
          <div className="grid gap-2">
            {ws.instances.map(inst => (
              <div key={inst.instance_name} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{inst.display_name || inst.instance_name}</span>
                <Badge variant="outline" className="text-xs">{inst.type === "waba" ? "WABA" : "Evolution"}</Badge>
                {inst.status === "connected" ? (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 gap-1"><Wifi className="w-3 h-3" />OK</Badge>
                ) : inst.status === "error" ? (
                  <Badge variant="destructive" className="text-xs gap-1"><XCircle className="w-3 h-3" />Erro</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1"><WifiOff className="w-3 h-3" />Off</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p><Users className="w-3 h-3 inline mr-1" />{ws.members_count} membros</p>
        <p>ID: <code className="text-[10px]">{ws.id}</code></p>
      </div>
    </div>
  );
}
