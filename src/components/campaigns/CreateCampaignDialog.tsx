import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCampaigns, CreateCampaignData } from "@/hooks/useCampaigns";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  MessageSquare,
  Clock,
  Zap,
  Upload,
  X,
  Rocket,
  Calendar,
  Save,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCODES = [
  { label: "#nome#", value: "#nome#" },
  { label: "#empresa#", value: "#empresa#" },
  { label: "#telefone#", value: "#telefone#" },
  { label: "#email#", value: "#email#" },
];

const EXAMPLE_VALUES: Record<string, string> = {
  "#nome#": "João Silva",
  "#empresa#": "Empresa Exemplo",
  "#telefone#": "(11) 99999-9999",
  "#email#": "joao@exemplo.com",
};

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 segundos", icon: "⚡", desc: "Mais rápido" },
  { value: 30, label: "30 segundos", icon: "⏱️", desc: "Recomendado", recommended: true },
  { value: 60, label: "1 minuto", icon: "🕐", desc: "" },
  { value: 180, label: "3 minutos", icon: "🕒", desc: "" },
  { value: -1, label: "Personalizado", icon: "✏️", desc: "" },
];

const DAYS_OF_WEEK = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

export default function CreateCampaignDialog({ open, onOpenChange }: Props) {
  const { workspaceId } = useWorkspace();
  const { createCampaign, startCampaign, estimateRecipients } = useCampaigns();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [filterStageIds, setFilterStageIds] = useState<string[]>([]);
  const [filterResponsibleIds, setFilterResponsibleIds] = useState<string[]>([]);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Step 2
  const [instanceName, setInstanceName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Step 3
  const [intervalOption, setIntervalOption] = useState(30);
  const [customInterval, setCustomInterval] = useState(30);
  const [restrictTime, setRestrictTime] = useState(true);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("19:00");
  const [scheduleDays, setScheduleDays] = useState([1, 2, 3, 4, 5]);
  const [whenToStart, setWhenToStart] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  // Data
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; color: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [instances, setInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;

    // Find default funnel (or first available)
    let funnelId: string | null = null;
    const { data: defaultFunnel } = await supabase
      .from("funnels")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_default", true)
      .maybeSingle();
    
    if (defaultFunnel) {
      funnelId = defaultFunnel.id;
    } else {
      const { data: firstFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      funnelId = firstFunnel?.id || null;
    }

    const stagesQuery = funnelId
      ? supabase.from("funnel_stages").select("id, name, color").eq("workspace_id", workspaceId).eq("funnel_id", funnelId).order("position")
      : supabase.from("funnel_stages").select("id, name, color").eq("workspace_id", workspaceId).order("position").limit(0);

    const [tagsRes, stagesRes, membersRes, instancesRes] = await Promise.all([
      supabase.from("lead_tags").select("id, name, color").eq("workspace_id", workspaceId),
      stagesQuery,
      supabase.from("workspace_members").select("user_id, user_profiles(id, full_name)").eq("workspace_id", workspaceId),
      supabase.from("whatsapp_instances").select("instance_name, display_name").eq("workspace_id", workspaceId),
    ]);
    setTags(tagsRes.data || []);
    setStages(stagesRes.data || []);
    setMembers(
      (membersRes.data || [])
        .map((m: any) => m.user_profiles)
        .filter(Boolean)
        .map((p: any) => ({ id: p.id, full_name: p.full_name }))
    );
    setInstances(instancesRes.data || []);

    // Initial estimate (no filters = all leads with phone)
    const count = await estimateRecipients([], [], []);
    setEstimatedCount(count);
  }, [workspaceId, estimateRecipients]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    loadData();
  }, [open, workspaceId, loadData]);

  // Estimate recipients with debounce
  useEffect(() => {
    if (!open || !workspaceId) return;
    const timer = setTimeout(async () => {
      setEstimating(true);
      const count = await estimateRecipients(filterTagIds, filterStageIds, filterResponsibleIds);
      setEstimatedCount(count);
      setEstimating(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterTagIds, filterStageIds, filterResponsibleIds, open, workspaceId, estimateRecipients]);

  const insertShortcode = (code: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = messageText.substring(0, start) + code + messageText.substring(end);
    setMessageText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + code.length, start + code.length);
    }, 0);
  };

  const previewMessage = messageText.replace(/#\w+#/g, (match) => EXAMPLE_VALUES[match] || match);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${workspaceId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("campaign-attachments")
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("campaign-attachments")
        .getPublicUrl(path);

      setAttachmentUrl(urlData.publicUrl);
      setAttachmentName(file.name);

      if (file.type.startsWith("image/")) setAttachmentType("image");
      else if (file.type.startsWith("video/")) setAttachmentType("video");
      else if (file.type.startsWith("audio/")) setAttachmentType("audio");
      else setAttachmentType("document");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentType(null);
    setAttachmentName(null);
  };

  const toggleDay = (day: number) => {
    setScheduleDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleTag = (id: string) => {
    setFilterTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const toggleStage = (id: string) => {
    setFilterStageIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleResponsible = (id: string) => {
    setFilterResponsibleIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const getIntervalSeconds = () => {
    if (intervalOption === -1) return Math.max(10, customInterval);
    return intervalOption;
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return instanceName.length > 0 && messageText.trim().length > 0;
    return true;
  };

  const handleSave = async (startImmediately: boolean) => {
    setSaving(true);
    try {
      const data: CreateCampaignData = {
        name,
        instance_name: instanceName,
        message_text: messageText,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        filter_tag_ids: filterTagIds,
        filter_stage_ids: filterStageIds,
        filter_responsible_ids: filterResponsibleIds,
        interval_seconds: getIntervalSeconds(),
        schedule_start_time: restrictTime ? startTime : null,
        schedule_end_time: restrictTime ? endTime : null,
        schedule_days: scheduleDays,
        scheduled_at: whenToStart === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };

      const campaign = await createCampaign(data);
      if (!campaign) return;

      if (startImmediately) {
        await startCampaign(campaign.id);
      } else {
        toast.success("Rascunho salvo");
      }

      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setFilterTagIds([]);
    setFilterStageIds([]);
    setFilterResponsibleIds([]);
    setInstanceName("");
    setMessageText("");
    setAttachmentUrl(null);
    setAttachmentType(null);
    setAttachmentName(null);
    setIntervalOption(30);
    setCustomInterval(30);
    setRestrictTime(true);
    setStartTime("07:00");
    setEndTime("19:00");
    setScheduleDays([1, 2, 3, 4, 5]);
    setWhenToStart("now");
    setScheduledAt("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nova Campanha</DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          {[
            { num: 1, label: "Destinatários", icon: Users },
            { num: 2, label: "Mensagem", icon: MessageSquare },
            { num: 3, label: "Configurações", icon: Clock },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {s.num}
              </div>
              <span className={`text-sm hidden sm:inline ${step >= s.num ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <Progress value={(step / 3) * 100} className="h-1 mb-4" />

        {/* Step 1: Recipients */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label>Nome da campanha *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção de Janeiro" className="mt-1" />
            </div>

            <div>
              <h3 className="font-medium mb-1">Filtrar contatos</h3>
              <p className="text-sm text-muted-foreground mb-4">Deixe todos em branco para enviar para todos os leads com telefone</p>

              {/* Tags */}
              <div className="mb-4">
                <Label className="text-sm">Tags (leads com qualquer uma dessas tags)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={filterTagIds.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={filterTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                  {tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag encontrada</p>}
                </div>
              </div>

              {/* Stages */}
              <div className="mb-4">
                <Label className="text-sm">Etapas do funil</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stages.map((stage) => (
                    <Badge
                      key={stage.id}
                      variant={filterStageIds.includes(stage.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      style={filterStageIds.includes(stage.id) ? { backgroundColor: stage.color, color: "#fff" } : {}}
                      onClick={() => toggleStage(stage.id)}
                    >
                      {stage.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Responsible */}
              <div className="mb-4">
                <Label className="text-sm">Responsável</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {members.map((m) => (
                    <Badge
                      key={m.id}
                      variant={filterResponsibleIds.includes(m.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleResponsible(m.id)}
                    >
                      {m.full_name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimate */}
            <div className={`p-4 rounded-lg border ${estimatedCount === 0 ? "border-destructive/50 bg-destructive/5" : "border-secondary/30 bg-secondary/5"}`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-secondary" />
                <span className="font-medium">
                  {estimating ? "Calculando..." : `Estimativa: ${estimatedCount ?? 0} contatos`}
                </span>
              </div>
              {estimatedCount === 0 && !estimating && (
                <p className="text-sm text-destructive mt-1">Nenhum contato encontrado com esses filtros</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Message */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Instância WhatsApp *</Label>
              <Select value={instanceName} onValueChange={setInstanceName}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.instance_name} value={inst.instance_name}>
                      {inst.display_name || inst.instance_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Mensagem *</Label>
              {/* Shortcode chips */}
              <div className="flex flex-wrap gap-1 mt-2 mb-2">
                {SHORTCODES.map((sc) => (
                  <Badge
                    key={sc.value}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80"
                    onClick={() => insertShortcode(sc.value)}
                  >
                    {sc.label}
                  </Badge>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Oi #nome#, tudo bem? Vi que você é da #empresa#..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{messageText.length} caracteres</p>
            </div>

            {/* Preview */}
            {messageText && (
              <div>
                <Label>Preview</Label>
                <div className="mt-2 p-4 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap max-w-sm border">
                  {previewMessage}
                </div>
              </div>
            )}

            {/* Attachment */}
            <div>
              <Label>Anexo (opcional)</Label>
              {!attachmentUrl ? (
                <label className="mt-2 flex items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-secondary transition-colors">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Enviando..." : "Clique para adicionar arquivo (JPG, PNG, PDF, MP4 — máx 16MB)"}
                  </span>
                  <input type="file" className="hidden" accept="image/*,application/pdf,video/*,audio/*" onChange={handleFileUpload} disabled={uploading} />
                </label>
              ) : (
                <div className="mt-2 flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                  <span className="text-sm flex-1 truncate">{attachmentName}</span>
                  <Badge variant="secondary">{attachmentType}</Badge>
                  <Button variant="ghost" size="icon" onClick={removeAttachment}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Config */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Interval */}
            <div>
              <Label className="text-base font-medium">Intervalo entre mensagens</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIntervalOption(opt.value)}
                    className={`relative p-3 rounded-lg border text-left transition-all ${
                      intervalOption === opt.value
                        ? "border-secondary bg-secondary/10 ring-1 ring-secondary"
                        : "border-border hover:border-secondary/50"
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <p className="font-medium text-sm mt-1">{opt.label}</p>
                    {opt.desc && <p className="text-xs text-muted-foreground">{opt.desc}</p>}
                    {opt.recommended && (
                      <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">Recomendado</Badge>
                    )}
                  </button>
                ))}
              </div>
              {intervalOption === -1 && (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={3600}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">segundos (mín. 10)</span>
                </div>
              )}
            </div>

            {/* Time window */}
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Restringir horário de envio</Label>
                <Switch checked={restrictTime} onCheckedChange={setRestrictTime} />
              </div>
              {restrictTime && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <Label className="text-xs">Início</Label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-32" />
                    </div>
                    <div>
                      <Label className="text-xs">Fim</Label>
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-32" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">Dias da semana</Label>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            scheduleDays.includes(d.value)
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* When to start */}
            <div>
              <Label className="text-base font-medium">Quando iniciar?</Label>
              <div className="mt-3 space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  whenToStart === "now" ? "border-secondary bg-secondary/5" : "border-border"
                }`}>
                  <input type="radio" name="when" checked={whenToStart === "now"} onChange={() => setWhenToStart("now")} className="sr-only" />
                  <Rocket className={`w-5 h-5 ${whenToStart === "now" ? "text-secondary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-sm">Iniciar imediatamente ao salvar</p>
                  </div>
                  <div className={`ml-auto w-4 h-4 rounded-full border-2 ${
                    whenToStart === "now" ? "border-secondary bg-secondary" : "border-muted-foreground"
                  }`} />
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  whenToStart === "scheduled" ? "border-secondary bg-secondary/5" : "border-border"
                }`}>
                  <input type="radio" name="when" checked={whenToStart === "scheduled"} onChange={() => setWhenToStart("scheduled")} className="sr-only" />
                  <Calendar className={`w-5 h-5 ${whenToStart === "scheduled" ? "text-secondary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-sm">Agendar para data/hora específica</p>
                  </div>
                  <div className={`ml-auto w-4 h-4 rounded-full border-2 ${
                    whenToStart === "scheduled" ? "border-secondary bg-secondary" : "border-muted-foreground"
                  }`} />
                </label>
                {whenToStart === "scheduled" && (
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-2 w-64"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">Etapa {step} de 3</div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
            {step < 3 && (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                Próximo <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" /> Salvar rascunho
                </Button>
                <Button onClick={() => handleSave(whenToStart === "now")} disabled={saving}>
                  {whenToStart === "now" ? (
                    <><Rocket className="w-4 h-4 mr-1" /> Iniciar campanha</>
                  ) : (
                    <><Calendar className="w-4 h-4 mr-1" /> Agendar campanha</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
