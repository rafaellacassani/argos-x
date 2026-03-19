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
  Send,
  Users,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

export default function FollowupInteligenteTab() {
  const { workspaceId } = useWorkspace();
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

  // Load instances and agents
  useEffect(() => {
    if (!workspaceId) return;

    const loadData = async () => {
      const [evoRes, wabaRes, agentsRes] = await Promise.all([
        supabase
          .from("whatsapp_instances")
          .select("instance_name, display_name")
          .eq("workspace_id", workspaceId)
          .neq("instance_type", "alerts"),
        supabase
          .from("meta_pages")
          .select("id, page_name, platform")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
        supabase
          .from("ai_agents")
          .select("id, name")
          .eq("workspace_id", workspaceId),
      ]);

      const allInstances: Instance[] = [];

      (evoRes.data || []).forEach((i: any) => {
        allInstances.push({
          id: `evo:${i.instance_name}`,
          name: i.display_name || i.instance_name,
          type: "evolution",
          instance_name: i.instance_name,
        });
      });

      (wabaRes.data || []).forEach((p: any) => {
        allInstances.push({
          id: `meta:${p.id}`,
          name: `${p.page_name} (${p.platform === "whatsapp_business" ? "WABA" : p.platform})`,
          type: "waba",
          meta_page_id: p.id,
        });
      });

      setInstances(allInstances);
      setAgents((agentsRes.data || []) as Agent[]);
    };

    loadData();
  }, [workspaceId]);

  const getSelectedInstanceData = () => {
    return instances.find((i) => i.id === selectedInstance);
  };

  const handleScan = () => {
    const inst = getSelectedInstanceData();
    if (!inst) return;
    scanContacts(inst.type, inst.instance_name || null, inst.meta_page_id || null);
  };

  const handleStart = () => {
    const inst = getSelectedInstanceData();
    if (!inst || !selectedAgent || !contextPrompt.trim()) return;
    startFollowup(
      inst.type,
      inst.instance_name || null,
      inst.meta_page_id || null,
      selectedAgent,
      contextPrompt,
      scannedContacts
    );
  };

  const handlePauseToggle = () => {
    if (isPaused()) {
      resumeFollowup();
      setPaused(false);
    } else {
      pauseFollowup();
      setPaused(true);
    }
  };

  const sentCount = executionLog.filter((l) => l.status === "sent").length;
  const failedCount = executionLog.filter((l) => l.status === "failed").length;
  const totalContacts = scannedContacts.length;
  const progressPercent = totalContacts > 0 ? ((sentCount + failedCount) / totalContacts) * 100 : 0;

  // Recent campaign history
  const recentCampaigns = campaigns.slice(0, 5);

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
            <p className="text-sm text-muted-foreground">
              A IA lê o histórico de cada contato e gera mensagens 100% personalizadas
            </p>
          </div>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance} disabled={executing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    <span className="flex items-center gap-2">
                      {inst.name}
                      <Badge variant="outline" className="text-xs">
                        {inst.type === "waba" ? "WABA" : "Evolution"}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Agente de IA</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent} disabled={executing}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <Label>Contexto e objetivo do follow-up</Label>
          <Textarea
            placeholder="Ex: Convidar para fazer cadastro no Argos X, link: argosx.com.br/cadastro. Destacar que é gratuito por 14 dias."
            value={contextPrompt}
            onChange={(e) => setContextPrompt(e.target.value)}
            disabled={executing}
            className="min-h-[100px]"
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleScan}
            disabled={!selectedInstance || scanning || executing}
            variant="outline"
            className="gap-2"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Buscar contatos sem resposta
          </Button>

          {scannedContacts.length > 0 && !executing && (
            <Button
              onClick={handleStart}
              disabled={!selectedAgent || !contextPrompt.trim() || executing}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Iniciar Follow-up ({scannedContacts.length} contatos)
            </Button>
          )}

          {executing && (
            <>
              <Button variant="outline" onClick={handlePauseToggle} className="gap-2">
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {paused ? "Retomar" : "Pausar"}
              </Button>
              <Button variant="destructive" onClick={cancelFollowup} className="gap-2">
                <XCircle className="w-4 h-4" />
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Scan results preview */}
      {scannedContacts.length > 0 && !executing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">{scannedContacts.length} contatos sem resposta encontrados</h3>
          </div>
          <div className="text-sm text-muted-foreground mb-2">
            Prévia dos primeiros contatos:
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {scannedContacts.slice(0, 20).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                  <span className="font-medium">{c.name || c.phone}</span>
                  <span className="text-muted-foreground truncate max-w-[300px]">{c.last_message}</span>
                </div>
              ))}
              {scannedContacts.length > 20 && (
                <p className="text-sm text-muted-foreground pt-2">
                  ... e mais {scannedContacts.length - 20} contatos
                </p>
              )}
            </div>
          </ScrollArea>
        </motion.div>
      )}

      {/* Execution progress */}
      {executing && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <h3 className="font-semibold">
              {paused ? "Follow-up pausado" : "Executando Follow-up..."}
            </h3>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {sentCount + failedCount} de {totalContacts} processados
              </span>
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

      {/* Execution log */}
      {executionLog.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Log de execução</h3>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {[...executionLog].reverse().map((entry, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    entry.status === "sent"
                      ? "border-success/30 bg-success/5"
                      : entry.status === "skipped"
                      ? "border-warning/30 bg-warning/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      {entry.contact_name || entry.contact_phone}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        entry.status === "sent"
                          ? "text-success border-success/30"
                          : entry.status === "skipped"
                          ? "text-warning border-warning/30"
                          : "text-destructive border-destructive/30"
                      }
                    >
                      {entry.status === "sent" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {entry.status === "failed" && <AlertCircle className="w-3 h-3 mr-1" />}
                      {entry.status === "sent" ? "Enviado" : entry.status === "skipped" ? "Ignorado" : "Falha"}
                    </Badge>
                  </div>
                  {entry.message_sent && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {entry.message_sent}
                    </p>
                  )}
                  {entry.skip_reason && (
                    <p className="text-xs text-destructive mt-1">{entry.skip_reason}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </motion.div>
      )}

      {/* Campaign history */}
      {recentCampaigns.length > 0 && !executing && (
        <div className="inboxia-card p-6">
          <h3 className="font-semibold mb-4">Histórico de Follow-ups</h3>
          <div className="space-y-3">
            {recentCampaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")} — {c.total_contacts} contatos
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                    {c.context_prompt}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-success">{c.sent_count} ✓</span>
                  <span className="text-destructive">{c.failed_count} ✗</span>
                  <Badge variant="outline">
                    {c.status === "completed" ? "Concluído" : c.status === "running" ? "Executando" : c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
