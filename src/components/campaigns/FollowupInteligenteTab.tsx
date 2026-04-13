import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Search,
  Play,
  Pause,
  XCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  MessageSquare,
  ChevronUp,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useFollowupCampaigns, FollowupContact } from "@/hooks/useFollowupCampaigns";

interface Instance {
  id: string;
  name: string;
  type: "evolution" | "waba";
  meta_page_id?: string;
  instance_name?: string;
}

interface Agent {
  id: string;
  name: string;
}

const MASTER_WORKSPACE_IDS = new Set([
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X
  "6a8540c9-6eb5-42ce-8d20-960002d85bac", // ECX Company
]);

export default function FollowupInteligenteTab() {
  const { workspaceId } = useWorkspace();

  // Only master workspaces can use this feature
  if (workspaceId && !MASTER_WORKSPACE_IDS.has(workspaceId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
        <Brain className="w-12 h-12 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold text-foreground">Follow-up Inteligente</h2>
        <p className="text-sm text-center max-w-md">
          Esta funcionalidade está em fase de testes e disponível apenas para workspaces selecionados.
        </p>
      </div>
    );
  }
  const {
    campaigns,
    scanning,
    scannedContacts,
    executing,
    executionLog,
    scanContacts,
    startFollowup,
    pauseFollowup,
    resumeFollowup,
    cancelFollowup,
    isPaused,
  } = useFollowupCampaigns();

  const [instances, setInstances] = useState<Instance[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [contextPrompt, setContextPrompt] = useState("");
  const [paused, setPaused] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignContacts, setCampaignContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [audienceType, setAudienceType] = useState<"no_reply_from_lead" | "no_reply_from_us">("no_reply_from_lead");
  const [contactLimit, setContactLimit] = useState(50);

  useEffect(() => {
    if (!workspaceId) return;
    const loadData = async () => {
      const [evoRes, wabaRes, agentsRes] = await Promise.all([
        supabase.from("whatsapp_instances").select("instance_name, display_name").eq("workspace_id", workspaceId).neq("instance_type", "alerts"),
        supabase.from("meta_pages").select("id, page_name, platform").eq("workspace_id", workspaceId).eq("is_active", true),
        supabase.from("ai_agents").select("id, name").eq("workspace_id", workspaceId),
      ]);
      const allInstances: Instance[] = [];
      (evoRes.data || []).forEach((i: any) => {
        allInstances.push({ id: `evo:${i.instance_name}`, name: i.display_name || i.instance_name, type: "evolution", instance_name: i.instance_name });
      });
      (wabaRes.data || []).forEach((p: any) => {
        allInstances.push({ id: `meta:${p.id}`, name: `${p.page_name} (${p.platform === "whatsapp_business" ? "WABA" : p.platform})`, type: "waba", meta_page_id: p.id });
      });
      setInstances(allInstances);
      setAgents((agentsRes.data || []) as Agent[]);
    };
    loadData();
  }, [workspaceId]);

  const getSelectedInstanceData = () => instances.find((i) => i.id === selectedInstance);

  const handleScan = () => {
    const inst = getSelectedInstanceData();
    if (!inst) return;
    scanContacts(inst.type, inst.instance_name || null, inst.meta_page_id || null, audienceType);
  };

  const effectiveContacts = scannedContacts.slice(0, contactLimit);

  const handleStart = () => {
    const inst = getSelectedInstanceData();
    if (!inst || !selectedAgent || !contextPrompt.trim()) return;
    startFollowup(inst.type, inst.instance_name || null, inst.meta_page_id || null, selectedAgent, contextPrompt, effectiveContacts);
  };

  const handlePauseToggle = () => {
    if (isPaused()) { resumeFollowup(); setPaused(false); } else { pauseFollowup(); setPaused(true); }
  };

  const handleCampaignClick = async (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      setCampaignContacts([]);
      return;
    }
    setExpandedCampaignId(campaignId);
    setLoadingContacts(true);
    try {
      const { data, error } = await supabase
        .from("followup_campaign_contacts")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setCampaignContacts(data || []);
    } catch (err) {
      console.error("Error loading campaign contacts:", err);
      setCampaignContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  };

  const sentCount = executionLog.filter((l) => l.status === "sent").length;
  const failedCount = executionLog.filter((l) => l.status === "failed").length;
  const totalContacts = scannedContacts.length;
  const progressPercent = totalContacts > 0 ? ((sentCount + failedCount) / totalContacts) * 100 : 0;
  const recentCampaigns = campaigns.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="inboxia-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg">Follow-up Inteligente</h2>
            <p className="text-sm text-muted-foreground">A IA lê o histórico de cada contato e gera mensagens 100% personalizadas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance} disabled={executing}>
              <SelectTrigger><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <span className="flex items-center gap-2">
                      {inst.name}
                      <Badge variant="outline" className="text-xs">{inst.type === "waba" ? "WABA" : "Evolution"}</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Agente de IA</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={executing}>
              <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Tipo de público</Label>
            <Select value={audienceType} onValueChange={(v) => setAudienceType(v as any)} disabled={executing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_reply_from_lead">Sem resposta do lead</SelectItem>
                <SelectItem value="no_reply_from_us">Lead respondeu mas está sem resposta nossa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Limite de contatos nesta execução</Label>
            <Input
              type="number"
              min={1}
              max={500}
              value={contactLimit}
              onChange={(e) => setContactLimit(Math.max(1, parseInt(e.target.value) || 50))}
              disabled={executing}
            />
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <Label>Contexto e objetivo do follow-up</Label>
          <Textarea placeholder="Ex: Convidar para fazer cadastro no Argos X, link: argosx.com.br/cadastro." value={contextPrompt} onChange={(e) => setContextPrompt(e.target.value)} disabled={executing} className="min-h-[100px]" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleScan} disabled={!selectedInstance || scanning || executing} variant="outline" className="gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar contatos
          </Button>
          {scannedContacts.length > 0 && !executing && (
            <Button onClick={handleStart} disabled={!selectedAgent || !contextPrompt.trim() || executing} className="gap-2">
              <Play className="w-4 h-4" />
              Iniciar Follow-up ({effectiveContacts.length} contatos)
            </Button>
          )}
          {executing && (
            <>
              <Button variant="outline" onClick={handlePauseToggle} className="gap-2">
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {paused ? "Retomar" : "Pausar"}
              </Button>
              <Button variant="destructive" onClick={() => void cancelFollowup()} className="gap-2">
                <XCircle className="w-4 h-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scan results */}
      {scannedContacts.length > 0 && !executing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">
              {scannedContacts.length} contatos encontrados
              {scannedContacts.length > contactLimit && (
                <span className="text-muted-foreground font-normal text-sm ml-2">(limitado a {contactLimit})</span>
              )}
            </h3>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {scannedContacts.slice(0, 20).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                  <span className="font-medium">{c.name || c.phone}</span>
                  <span className="text-muted-foreground truncate max-w-[300px]">{c.last_message}</span>
                </div>
              ))}
              {scannedContacts.length > 20 && <p className="text-sm text-muted-foreground pt-2">... e mais {scannedContacts.length - 20} contatos</p>}
            </div>
          </ScrollArea>
        </motion.div>
      )}

      {/* Execution progress */}
      {executing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <h3 className="font-semibold">{paused ? "Follow-up pausado" : "Executando Follow-up..."}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePauseToggle} className="gap-1.5">
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {paused ? "Retomar" : "Pausar"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void cancelFollowup()} className="gap-1.5">
                <XCircle className="w-4 h-4" />
                Cancelar
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{sentCount + failedCount} de {totalContacts} processados</span>
              <span className="font-medium">{progressPercent.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-semibold text-success">{sentCount}</p>
              <p className="text-xs text-muted-foreground">Enviados</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-semibold text-destructive">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-lg font-semibold">{totalContacts - sentCount - failedCount}</p>
              <p className="text-xs text-muted-foreground">Restantes</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Live execution log */}
      {executionLog.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Log de execução</h3>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {[...executionLog].reverse().map((entry, i) => (
                <div key={i} className={`p-3 rounded-lg border ${entry.status === "sent" ? "border-success/30 bg-success/5" : entry.status === "skipped" ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{entry.contact_name || entry.contact_phone}</span>
                    <Badge variant="outline" className={entry.status === "sent" ? "text-success border-success/30" : entry.status === "skipped" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}>
                      {entry.status === "sent" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {entry.status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
                      {entry.status === "sent" ? "Enviado" : entry.status === "skipped" ? "Ignorado" : "Falha"}
                    </Badge>
                  </div>
                  {entry.message_sent && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{entry.message_sent}</p>}
                  {entry.skip_reason && <p className="text-xs text-destructive mt-1">{entry.skip_reason}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      )}

      {/* Campaign history - CLICKABLE */}
      {recentCampaigns.length > 0 && !executing && (
        <div className="inboxia-card p-6">
          <h3 className="font-semibold mb-4">Histórico de Follow-ups</h3>
          <div className="space-y-3">
            {recentCampaigns.map((c) => (
              <div key={c.id}>
                <div className="w-full flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <button
                    onClick={() => handleCampaignClick(c.id)}
                    className="flex-1 flex items-center justify-between cursor-pointer text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")} — {c.total_contacts} contatos
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[400px]">{c.context_prompt}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-success">{c.sent_count} ✓</span>
                      <span className="text-destructive">{c.failed_count} ✗</span>
                      <Badge variant="outline">
                        {c.status === "completed" ? "Concluído" : c.status === "running" ? "Executando" : c.status}
                      </Badge>
                      {expandedCampaignId === c.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {c.status === "running" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        void cancelFollowup(c.id);
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </Button>
                  )}
                </div>

                {expandedCampaignId === c.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 mx-2">
                    {loadingContacts ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Carregando logs...</span>
                      </div>
                    ) : campaignContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de contato encontrado.</p>
                    ) : (
                      <ScrollArea className="h-[350px]">
                        <div className="space-y-2 p-2">
                          {campaignContacts.map((contact: any) => (
                            <div key={contact.id} className={`p-3 rounded-lg border text-sm ${contact.status === "sent" ? "border-success/30 bg-success/5" : contact.status === "pending" ? "border-border bg-muted/20" : "border-destructive/30 bg-destructive/5"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{contact.contact_name || contact.contact_phone}</span>
                                <div className="flex items-center gap-2">
                                  {contact.sent_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(contact.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  )}
                                  <Badge variant="outline" className={contact.status === "sent" ? "text-success border-success/30" : contact.status === "pending" ? "text-muted-foreground" : "text-destructive border-destructive/30"}>
                                    {contact.status === "sent" && <CheckCircle className="w-3 h-3 mr-1" />}
                                    {contact.status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
                                    {contact.status === "sent" ? "Enviado" : contact.status === "pending" ? "Pendente" : "Falha"}
                                  </Badge>
                                </div>
                              </div>
                              {contact.message_sent && <p className="text-muted-foreground mt-1 whitespace-pre-wrap text-xs">{contact.message_sent}</p>}
                              {contact.skip_reason && <p className="text-xs text-destructive mt-1">Motivo: {contact.skip_reason}</p>}
                              {contact.last_message_preview && <p className="text-xs text-muted-foreground mt-1 italic">Última msg: {contact.last_message_preview}</p>}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}