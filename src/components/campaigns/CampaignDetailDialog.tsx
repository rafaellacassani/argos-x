import { useState, useEffect } from "react";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Campaign, CampaignRecipient, useCampaigns } from "@/hooks/useCampaigns";
import { useEvolutionAPI } from "@/hooks/useEvolutionAPI";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWhatsAppTemplates, WhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Download, Send, CheckCircle2, XCircle, Clock, Users, AlertTriangle, RotateCcw, Pencil, Save, X, FileText, Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  scheduled: { label: "Agendada", color: "bg-secondary/10 text-secondary" },
  running: { label: "Em execução", color: "bg-success/10 text-success" },
  paused: { label: "Pausada", color: "bg-warning/10 text-warning" },
  completed: { label: "Concluída", color: "bg-primary/10 text-primary" },
  canceled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
};

const recipientStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-muted-foreground" },
  sent: { label: "Enviado", color: "text-success" },
  failed: { label: "Falhou", color: "text-destructive" },
  skipped: { label: "Ignorado", color: "text-warning" },
};

export default function CampaignDetailDialog({ open, onOpenChange, campaign }: Props) {
  const { fetchRecipients, retryCampaign, updateCampaign } = useCampaigns();
  const { canExportData } = useMemberPermissions();
  const { listInstances } = useEvolutionAPI();
  const { workspaceId } = useWorkspace();
  const { templates, fetchTemplates, syncTemplates, syncing: syncingTemplates } = useWhatsAppTemplates();
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [retryInstance, setRetryInstance] = useState(campaign.instance_name);
  const [retrying, setRetrying] = useState(false);
  const [availableInstances, setAvailableInstances] = useState<string[]>([]);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editInstanceName, setEditInstanceName] = useState(campaign.instance_name);
  const [editInstanceNames, setEditInstanceNames] = useState<string[]>(campaign.instance_names || []);
  const [editInterval, setEditInterval] = useState(String(campaign.interval_seconds));
  const [editMessage, setEditMessage] = useState(campaign.message_text);
  const [editStartTime, setEditStartTime] = useState(campaign.schedule_start_time || "");
  const [editEndTime, setEditEndTime] = useState(campaign.schedule_end_time || "");
  const [saving, setSaving] = useState(false);

  // WABA state
  const isWaba = !!campaign.template_id;
  const [cloudConnections, setCloudConnections] = useState<{ id: string; inbox_name: string; phone_number: string }[]>([]);
  const [editTemplateId, setEditTemplateId] = useState(campaign.template_id || "");
  const [editTemplateVariables, setEditTemplateVariables] = useState<Record<string, string>>({});
  const [wabaConnectionName, setWabaConnectionName] = useState("");

  useEffect(() => {
    if (open && campaign.id) {
      loadRecipients();
      setRetryInstance(campaign.instance_name);
      setEditing(false);
      // Reset edit fields to current campaign values
      setEditInstanceName(campaign.instance_name);
      setEditInstanceNames(campaign.instance_names || []);
      setEditInterval(String(campaign.interval_seconds));
      setEditMessage(campaign.message_text);
      setEditStartTime(campaign.schedule_start_time || "");
      setEditEndTime(campaign.schedule_end_time || "");
      setEditTemplateId(campaign.template_id || "");
      // Parse template variables into a map
      const varMap: Record<string, string> = {};
      if (campaign.template_variables) {
        for (const tv of campaign.template_variables) {
          varMap[tv.key] = tv.value;
        }
      }
      setEditTemplateVariables(varMap);

      // Load instances for retry/edit selector (Evolution API)
      if (!isWaba) {
        listInstances().then(insts => {
          setAvailableInstances(insts.map((i: any) => i.instanceName));
        });
      }

      // Load WABA data
      if (isWaba && workspaceId) {
        supabase
          .from("whatsapp_cloud_connections")
          .select("id, inbox_name, phone_number")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .then(({ data }) => {
            const conns = (data || []) as { id: string; inbox_name: string; phone_number: string }[];
            setCloudConnections(conns);
            // Find connection name for this template
            if (campaign.template_id) {
              supabase
                .from("whatsapp_templates")
                .select("cloud_connection_id")
                .eq("id", campaign.template_id)
                .maybeSingle()
                .then(({ data: tplData }) => {
                  if (tplData) {
                    const conn = conns.find(c => c.id === tplData.cloud_connection_id);
                    setWabaConnectionName(conn ? `${conn.inbox_name} (${conn.phone_number})` : "—");
                    fetchTemplates(tplData.cloud_connection_id);
                  }
                });
            }
          });
      }
    }
  }, [open, campaign.id]);

  const loadRecipients = async () => {
    setLoading(true);
    const data = await fetchRecipients(campaign.id);
    setRecipients(data);
    setLoading(false);
  };

  const handleRetry = async () => {
    setRetrying(true);
    const result = await retryCampaign(
      campaign.id,
      retryInstance !== campaign.instance_name ? retryInstance : undefined
    );
    setRetrying(false);
    if (result) {
      onOpenChange(false);
    }
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    const updates: Record<string, any> = {};

    if (isWaba) {
      if (editTemplateId !== campaign.template_id) {
        updates.template_id = editTemplateId;
        // Update message_text to the new template name
        const tpl = templates.find(t => t.id === editTemplateId);
        if (tpl) updates.message_text = tpl.template_name;
      }
      const newVars = Object.entries(editTemplateVariables).map(([key, value]) => ({ key, value }));
      if (JSON.stringify(newVars) !== JSON.stringify(campaign.template_variables)) {
        updates.template_variables = newVars;
      }
    } else {
      if (editInstanceName !== campaign.instance_name) updates.instance_name = editInstanceName;
      if (JSON.stringify(editInstanceNames) !== JSON.stringify(campaign.instance_names)) updates.instance_names = editInstanceNames;
      if (editMessage !== campaign.message_text) updates.message_text = editMessage;
    }

    if (Number(editInterval) !== campaign.interval_seconds) updates.interval_seconds = Number(editInterval);
    if (editStartTime !== (campaign.schedule_start_time || "")) updates.schedule_start_time = editStartTime || null;
    if (editEndTime !== (campaign.schedule_end_time || "")) updates.schedule_end_time = editEndTime || null;

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      setSaving(false);
      return;
    }

    const success = await updateCampaign(campaign.id, updates);
    setSaving(false);
    if (success) {
      toast.success("Campanha atualizada!");
      setEditing(false);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditInstanceName(campaign.instance_name);
    setEditInstanceNames(campaign.instance_names || []);
    setEditInterval(String(campaign.interval_seconds));
    setEditMessage(campaign.message_text);
    setEditStartTime(campaign.schedule_start_time || "");
    setEditEndTime(campaign.schedule_end_time || "");
    setEditTemplateId(campaign.template_id || "");
    const varMap: Record<string, string> = {};
    if (campaign.template_variables) {
      for (const tv of campaign.template_variables) {
        varMap[tv.key] = tv.value;
      }
    }
    setEditTemplateVariables(varMap);
  };

  const canEdit = ["draft", "paused", "completed", "canceled"].includes(campaign.status);

  const filteredRecipients = recipients.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (r.lead?.name || "").toLowerCase().includes(s) ||
        r.phone.includes(s)
      );
    }
    return true;
  });

  const pending = campaign.total_recipients - campaign.sent_count - campaign.failed_count;
  const progress = campaign.total_recipients > 0 ? (campaign.sent_count / campaign.total_recipients) * 100 : 0;
  const sc = statusConfig[campaign.status] || statusConfig.draft;

  // Get the current template for preview
  const currentTemplate = templates.find(t => t.id === (editing ? editTemplateId : campaign.template_id));
  const templateBody = currentTemplate?.components?.find((c: any) => c.type === "BODY");
  const templateHeader = currentTemplate?.components?.find((c: any) => c.type === "HEADER");
  const templateFooter = currentTemplate?.components?.find((c: any) => c.type === "FOOTER");
  const templateButtons = currentTemplate?.components?.find((c: any) => c.type === "BUTTONS");
  const templateVarMatches = templateBody?.text?.match(/\{\{[^}]+\}\}/g) || [];

  const exportCSV = () => {
    const headers = ["Nome", "Telefone", "Status", "Enviado em", "Erro"];
    const rows = filteredRecipients.map((r) => [
      r.lead?.name || "",
      r.phone,
      recipientStatusConfig[r.status]?.label || r.status,
      r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "",
      r.error_message || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-${campaign.name}-destinatarios.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-display text-xl">{campaign.name}</DialogTitle>
            <Badge className={sc.color}>{sc.label}</Badge>
            {isWaba && (
              <Badge variant="outline" className="gap-1">
                <FileText className="w-3 h-3" />
                WABA
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="recipients">Destinatários ({campaign.total_recipients})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: campaign.total_recipients, icon: Users, color: "text-foreground" },
                { label: "Enviadas", value: campaign.sent_count, icon: Send, color: "text-success" },
                { label: "Falhas", value: campaign.failed_count, icon: XCircle, color: "text-destructive" },
                { label: "Pendentes", value: Math.max(0, pending), icon: Clock, color: "text-muted-foreground" },
              ].map((m) => (
                <div key={m.label} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <p className={`text-2xl font-display font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{campaign.sent_count} de {campaign.total_recipients} enviadas</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Retry Failed */}
            {campaign.failed_count > 0 && ["completed", "paused", "canceled"].includes(campaign.status) && (
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <p className="font-medium text-destructive">{campaign.failed_count} mensagens falharam</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Você pode reenviar apenas as mensagens que falharam. Se a conexão caiu, reconecte a instância antes de reenviar.
                </p>
                {!isWaba && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Instância para reenvio</p>
                      <Select value={retryInstance} onValueChange={setRetryInstance}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableInstances.filter(n => n).length > 0 ? (
                            availableInstances.filter(n => n).map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))
                          ) : campaign.instance_name ? (
                            <SelectItem value={campaign.instance_name}>{campaign.instance_name}</SelectItem>
                          ) : (
                            <SelectItem value="__none">Nenhuma instância</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={handleRetry} 
                      disabled={retrying}
                      className="gap-2"
                    >
                      <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
                      {retrying ? "Reenviando..." : `Reenviar ${campaign.failed_count} falhas`}
                    </Button>
                  </div>
                )}
                {isWaba && (
                  <Button 
                    onClick={handleRetry} 
                    disabled={retrying}
                    className="gap-2"
                  >
                    <RotateCcw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} />
                    {retrying ? "Reenviando..." : `Reenviar ${campaign.failed_count} falhas`}
                  </Button>
                )}
              </div>
            )}

            {/* Config Section - View / Edit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Configurações</p>
                {canEdit && !editing && (
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setEditing(true)}>
                    <Pencil className="w-3 h-3" />
                    Editar
                  </Button>
                )}
                {editing && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={cancelEditing}>
                      <X className="w-3 h-3" />
                      Cancelar
                    </Button>
                    <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={handleSaveEdits} disabled={saving}>
                      <Save className="w-3 h-3" />
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                )}
              </div>

              {editing ? (
                <div className="grid grid-cols-2 gap-4">
                  {/* Instance / WABA connection — conditional */}
                  {!isWaba && (
                    <div className="p-3 rounded-lg border space-y-1.5">
                      <p className="text-xs text-muted-foreground">Instância principal</p>
                      <Select value={editInstanceName} onValueChange={setEditInstanceName}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableInstances.filter(n => n).length > 0 ? (
                            availableInstances.filter(n => n).map(name => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))
                          ) : editInstanceName ? (
                            <SelectItem value={editInstanceName}>{editInstanceName}</SelectItem>
                          ) : (
                            <SelectItem value="__none">Nenhuma instância</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {isWaba && (
                    <div className="p-3 rounded-lg border space-y-1.5">
                      <p className="text-xs text-muted-foreground">Conexão WABA</p>
                      <p className="text-sm font-medium">{wabaConnectionName || "—"}</p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg border space-y-1.5">
                    <p className="text-xs text-muted-foreground">Intervalo (segundos)</p>
                    <Input
                      type="number"
                      min={5}
                      max={300}
                      value={editInterval}
                      onChange={(e) => setEditInterval(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  {(editStartTime || campaign.schedule_start_time) && (
                    <>
                      <div className="p-3 rounded-lg border space-y-1.5">
                        <p className="text-xs text-muted-foreground">Horário início</p>
                        <Input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="p-3 rounded-lg border space-y-1.5">
                        <p className="text-xs text-muted-foreground">Horário fim</p>
                        <Input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {!isWaba && (
                    <div className="p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">
                        {campaign.instance_names && campaign.instance_names.length >= 2 ? "Instâncias (Round Robin)" : "Instância"}
                      </p>
                      <p className="font-medium">
                        {campaign.instance_names && campaign.instance_names.length >= 2
                          ? campaign.instance_names.join(" → ")
                          : campaign.instance_name || "—"}
                      </p>
                    </div>
                  )}
                  {isWaba && (
                    <div className="p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Conexão WABA</p>
                      <p className="font-medium">{wabaConnectionName || "—"}</p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg border">
                    <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                    <p className="font-medium">{campaign.interval_seconds}s entre mensagens</p>
                  </div>
                  {campaign.schedule_start_time && (
                    <div className="p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Janela de envio</p>
                      <p className="font-medium">{campaign.schedule_start_time} — {campaign.schedule_end_time}</p>
                    </div>
                  )}
                  {campaign.scheduled_at && (
                    <div className="p-3 rounded-lg border">
                      <p className="text-xs text-muted-foreground mb-1">Agendada para</p>
                      <p className="font-medium">{new Date(campaign.scheduled_at).toLocaleString("pt-BR")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message / Template preview & edit */}
            <div>
              <p className="text-sm font-medium mb-2">
                {isWaba ? "Template" : "Mensagem"}
              </p>

              {isWaba ? (
                editing ? (
                  <div className="space-y-4">
                    {/* Template selector */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Template WABA *</Label>
                        {cloudConnections.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                            // Find current template's connection to sync
                            const tpl = templates.find(t => t.id === editTemplateId);
                            const connId = tpl?.cloud_connection_id || cloudConnections[0]?.id;
                            if (connId) syncTemplates(connId);
                          }} disabled={syncingTemplates}>
                            {syncingTemplates ? "Sincronizando..." : "Sincronizar"}
                          </Button>
                        )}
                      </div>
                      <Select value={editTemplateId} onValueChange={(v) => {
                        setEditTemplateId(v);
                        const tpl = templates.find(t => t.id === v);
                        if (tpl) {
                          const body = tpl.components.find((c: any) => c.type === "BODY");
                          const vars: Record<string, string> = {};
                          const matches = body?.text?.match(/\{\{[^}]+\}\}/g) || [];
                          for (const m of matches) {
                            vars[m] = editTemplateVariables[m] || "";
                          }
                          setEditTemplateVariables(vars);
                        }
                      }}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Selecione o template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.filter(t => t.status === "APPROVED").map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.template_name} ({t.language})
                            </SelectItem>
                          ))}
                          {templates.filter(t => t.status === "APPROVED").length === 0 && (
                            <SelectItem value="none" disabled>Nenhum template aprovado</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template preview */}
                    {currentTemplate && (
                      <div className="space-y-2">
                        {templateHeader?.text && (
                          <div className="p-2 rounded bg-muted text-xs font-medium">{templateHeader.text}</div>
                        )}
                        <div className="p-3 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap max-w-sm border">
                          {templateBody?.text || ""}
                        </div>
                        {templateFooter?.text && (
                          <p className="text-xs text-muted-foreground italic">{templateFooter.text}</p>
                        )}
                        {templateButtons?.buttons && (
                          <div className="flex flex-wrap gap-1">
                            {(templateButtons.buttons as any[]).map((btn: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{btn.text}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Variable mapping */}
                    {templateVarMatches.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Mapeamento de variáveis</Label>
                        <p className="text-xs text-muted-foreground">Associe cada variável a um campo do lead</p>
                        {templateVarMatches.map((v: string) => (
                          <div key={v} className="flex items-center gap-2">
                            <Badge variant="outline" className="min-w-[50px] justify-center">{v}</Badge>
                            <Select
                              value={editTemplateVariables[v] || ""}
                              onValueChange={(val) => setEditTemplateVariables(prev => ({ ...prev, [v]: val }))}
                            >
                              <SelectTrigger className="flex-1 h-8 text-xs">
                                <SelectValue placeholder="Selecione o campo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="#nome#">Nome do lead</SelectItem>
                                <SelectItem value="#empresa#">Empresa</SelectItem>
                                <SelectItem value="#telefone#">Telefone</SelectItem>
                                <SelectItem value="#email#">Email</SelectItem>
                                <SelectItem value="custom">Texto fixo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* WABA view mode */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">{campaign.message_text}</Badge>
                    </div>
                    {currentTemplate ? (
                      <>
                        {templateHeader?.text && (
                          <div className="p-2 rounded bg-muted text-xs font-medium">{templateHeader.text}</div>
                        )}
                        <div className="p-3 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap max-w-sm border">
                          {templateBody?.text || ""}
                        </div>
                        {templateFooter?.text && (
                          <p className="text-xs text-muted-foreground italic">{templateFooter.text}</p>
                        )}
                        {templateButtons?.buttons && (
                          <div className="flex flex-wrap gap-1">
                            {(templateButtons.buttons as any[]).map((btn: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{btn.text}</Badge>
                            ))}
                          </div>
                        )}
                        {campaign.template_variables && campaign.template_variables.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Variáveis:</p>
                            {campaign.template_variables.map((tv, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className="text-[10px]">{tv.key}</Badge>
                                <span className="text-muted-foreground">→</span>
                                <span>{tv.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Template: {campaign.message_text}</p>
                    )}
                  </div>
                )
              ) : (
                /* Non-WABA message */
                editing ? (
                  <Textarea
                    value={editMessage}
                    onChange={(e) => setEditMessage(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="Texto da mensagem..."
                  />
                ) : (
                  <div className="p-4 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap max-w-md border">
                    {campaign.message_text}
                  </div>
                )
              )}

              {campaign.attachment_url && (
                <div className="mt-2 p-2 rounded border inline-flex items-center gap-2 text-sm">
                  {campaign.attachment_type === "audio" ? (
                    <audio src={campaign.attachment_url} controls className="h-8" />
                  ) : (
                    <>📎 Anexo: <a href={campaign.attachment_url} target="_blank" rel="noreferrer" className="text-secondary underline">Ver arquivo</a></>
                  )}
                </div>
              )}

              {campaign.include_all_contacts && (
                <div className="mt-2">
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    Inclui todos os contatos do WhatsApp
                  </Badge>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recipients" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="skipped">Ignorados</SelectItem>
                </SelectContent>
              </Select>
              {canExportData && (
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
              )}
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">Telefone</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Enviado em</th>
                      <th className="text-left p-3 font-medium">Mensagem</th>
                      <th className="text-left p-3 font-medium">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.slice(0, 100).map((r) => {
                      const rs = recipientStatusConfig[r.status] || recipientStatusConfig.pending;
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="p-3">{r.lead?.name || "—"}</td>
                          <td className="p-3 font-mono text-xs">{r.phone}</td>
                          <td className="p-3">
                            <span className={`font-medium ${rs.color}`}>{rs.label}</span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="p-3">
                            {r.personalized_message ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                                    <Eye className="w-3 h-3" />
                                    Ver
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-h-60 overflow-y-auto">
                                  <p className="text-xs font-medium mb-2">Mensagem enviada:</p>
                                  <div className="p-3 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap border">
                                    {r.personalized_message}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-destructive truncate max-w-[200px]">{r.error_message || ""}</td>
                        </tr>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum destinatário encontrado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredRecipients.length > 100 && (
                  <p className="p-3 text-sm text-muted-foreground text-center border-t">
                    Mostrando 100 de {filteredRecipients.length} destinatários. Exporte o CSV para ver todos.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
