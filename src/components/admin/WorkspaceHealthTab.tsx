import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Search, RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle,
  Bot, MessageSquare, Wifi, WifiOff, Activity, Users, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentHealth {
  id: string;
  name: string;
  model: string;
  is_active: boolean;
  interactions_24h: number;
  responded_24h: boolean;
}

interface InstanceHealth {
  instance_name: string;
  display_name: string | null;
  type: "evolution" | "waba";
  status: "connected" | "disconnected" | "error";
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
  agents: AgentHealth[];
  instances: InstanceHealth[];
  alerts: string[];
}

export default function WorkspaceHealthTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkspaceHealth[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

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
    if (pct > 90) return "bg-destructive";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getUsagePct = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getTrialDaysLeft = (trialEnd: string | null) => {
    if (!trialEnd) return null;
    const diff = Math.ceil((new Date(trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const filtered = data.filter(ws => {
    if (search && !ws.name.toLowerCase().includes(search.toLowerCase())) return false;
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
          <Input
            placeholder="Buscar workspace..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="alerts">Com alertas</SelectItem>
            <SelectItem value="trial-expiring">Trial expirando (7d)</SelectItem>
            <SelectItem value="critical">Consumo crítico</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchHealth} className="gap-1.5">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
        <span className="text-sm text-muted-foreground">{filtered.length} workspaces</span>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(ws => {
          const trialDays = getTrialDaysLeft(ws.trial_end);
          const totalLeadLimit = ws.lead_limit + ws.extra_leads;
          const hasAlerts = ws.alerts.length > 0;

          return (
            <Card key={ws.id} className={hasAlerts ? "border-destructive/50" : ""}>
              <Accordion type="single" collapsible>
                <AccordionItem value="details" className="border-none">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{ws.name}</span>
                          <Badge variant="outline" className="text-xs">{ws.plan_name || ws.plan_type}</Badge>
                          {ws.subscription_status === "trialing" && trialDays !== null && (
                            <Badge variant={trialDays <= 3 ? "destructive" : "secondary"} className="text-xs">
                              Trial: {trialDays}d restantes
                            </Badge>
                          )}
                          {ws.blocked_at && (
                            <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {ws.members_count} usuários</span>
                          <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {ws.agents.length} agentes</span>
                          <span className="flex items-center gap-1"><Wifi className="w-3 h-3" /> {ws.instances.length} instâncias</span>
                        </div>
                      </div>
                      {hasAlerts && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {ws.alerts.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 space-y-4">
                    {/* Consumption bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span>Leads</span>
                          <span className="text-muted-foreground">{ws.leads_used} / {totalLeadLimit}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getUsageColor(ws.leads_used, totalLeadLimit)}`}
                            style={{ width: `${getUsagePct(ws.leads_used, totalLeadLimit)}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span>Interações IA</span>
                          <span className="text-muted-foreground">{ws.ai_used} / {ws.ai_limit}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getUsageColor(ws.ai_used, ws.ai_limit)}`}
                            style={{ width: `${getUsagePct(ws.ai_used, ws.ai_limit)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Alerts */}
                    {ws.alerts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-destructive">Alertas</span>
                        <div className="flex flex-wrap gap-2">
                          {ws.alerts.map((alert, i) => (
                            <Badge key={i} variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" /> {alert}
                            </Badge>
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
                            <div key={agent.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm">
                              <Bot className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate flex-1">{agent.name}</span>
                              <Badge variant="outline" className="text-xs font-mono">{agent.model}</Badge>
                              <Badge variant={agent.is_active ? "default" : "secondary"} className="text-xs">
                                {agent.is_active ? "Ativo" : "Inativo"}
                              </Badge>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                <Zap className="w-3 h-3 inline mr-0.5" />{agent.interactions_24h} (24h)
                              </span>
                              {agent.is_active && (
                                agent.responded_24h ? (
                                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 gap-1">
                                    <Activity className="w-3 h-3" /> Saudável
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300 gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Sem atividade
                                  </Badge>
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
                            <div key={inst.instance_name} className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm">
                              <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{inst.display_name || inst.instance_name}</span>
                              <Badge variant="outline" className="text-xs">{inst.type === "waba" ? "WABA" : "Evolution"}</Badge>
                              {inst.status === "connected" ? (
                                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 gap-1">
                                  <Wifi className="w-3 h-3" /> Conectado
                                </Badge>
                              ) : inst.status === "error" ? (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <XCircle className="w-3 h-3" /> Erro
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1">
                                  <WifiOff className="w-3 h-3" /> Desconectado
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum workspace encontrado.</p>
        )}
      </div>
    </div>
  );
}
