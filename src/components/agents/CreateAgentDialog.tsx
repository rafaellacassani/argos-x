import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Calendar,
  Target,
  RefreshCw,
  DollarSign,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Zap,
  Clock,
  Dice5,
  Loader2,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface CreateAgentWizardData {
  name: string;
  type: string;
  main_objective: string;
  company_info: Record<string, any>;
  niche: string;
  agent_role: string;
  tone_of_voice: string;
  use_emojis: boolean;
  response_length: string;
  response_delay_seconds: number;
  respond_to: string;
  respond_to_stages: string[];
  instance_name: string;
  qualification_enabled: boolean;
  qualification_fields: any[];
  is_active: boolean;
  system_prompt: string;
  // defaults kept from old
  model: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  pause_code: string;
  resume_keyword: string;
  message_split_enabled: boolean;
  message_split_length: number;
}

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAgentWizardData) => void;
  isLoading?: boolean;
}

const TOTAL_STEPS = 5;

const objectives = [
  { id: "atendimento", icon: MessageCircle, label: "Atendimento geral", desc: "Responde dúvidas e qualifica leads", type: "sdr" },
  { id: "agendar", icon: Calendar, label: "Agendamento", desc: "Marca reuniões e consultas automaticamente", type: "scheduler" },
  { id: "sdr", icon: Target, label: "Pré-venda (SDR)", desc: "Qualifica e aquece leads para o time comercial", type: "sdr" },
  { id: "followup", icon: RefreshCw, label: "Follow-up", desc: "Reativa leads que pararam de responder", type: "followup" },
  { id: "cobranca", icon: DollarSign, label: "Cobrança", desc: "Envia lembretes de pagamento amigáveis", type: "collector" },
  { id: "personalizado", icon: Sparkles, label: "Personalizado", desc: "Definirei tudo manualmente", type: "custom" },
];

const tones = [
  { id: "descontraido", emoji: "😊", label: "Descontraído", desc: "Informal, próximo, usa gírias leves" },
  { id: "consultivo", emoji: "🤝", label: "Consultivo", desc: "Profissional mas acessível" },
  { id: "formal", emoji: "👔", label: "Formal", desc: "Sério e corporativo" },
  { id: "dinamico", emoji: "🚀", label: "Dinâmico", desc: "Energético e motivador" },
  { id: "premium", emoji: "💎", label: "Premium", desc: "Sofisticado e exclusivo" },
];

const responseLengths = [
  { id: "short", emoji: "📝", label: "Curta", desc: "1-2 frases, direto ao ponto" },
  { id: "medium", emoji: "📄", label: "Média", desc: "1 parágrafo equilibrado" },
  { id: "long", emoji: "📋", label: "Detalhada", desc: "Completo e explicativo" },
];

const delays = [
  { value: 0, emoji: "⚡", label: "Imediato" },
  { value: 30, emoji: "🕐", label: "~30 segundos" },
  { value: 60, emoji: "🕑", label: "~1 minuto" },
  { value: 120, emoji: "🕒", label: "~2 minutos" },
  { value: -1, emoji: "🎲", label: "Aleatório", hint: "Parece mais humano" },
];

const nicheSuggestions = [
  "Clínica odontológica", "Imobiliária", "E-commerce", "Consultoria",
  "Escola", "Academia", "Restaurante", "Agência de marketing",
];

const defaultQualificationFields = [
  { id: "name", field_type: "name", label: "Nome completo", question: "Antes de começar, pode me dizer seu nome? 😊", required: true, active: false, position: 0 },
  { id: "company", field_type: "company", label: "Empresa", question: "E qual empresa você representa?", required: false, active: false, position: 1 },
  { id: "role", field_type: "role", label: "Cargo", question: "Qual é seu cargo?", required: false, active: false, position: 2 },
  { id: "email", field_type: "email", label: "E-mail", question: "Pode me passar seu e-mail?", required: false, active: false, position: 3 },
];

export function CreateAgentDialog({ open, onOpenChange, onSubmit, isLoading }: CreateAgentDialogProps) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState(1);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [activateOnCreate, setActivateOnCreate] = useState(false);

  // Form state
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [site, setSite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isDigital, setIsDigital] = useState(true);
  const [address, setAddress] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [tone, setTone] = useState("consultivo");
  const [useEmojis, setUseEmojis] = useState(true);
  const [responseLength, setResponseLength] = useState("medium");
  const [responseDelay, setResponseDelay] = useState(-1);
  const [respondTo, setRespondTo] = useState("all");
  const [respondToStages, setRespondToStages] = useState<string[]>([]);
  const [instanceName, setInstanceName] = useState("");
  const [qualificationEnabled, setQualificationEnabled] = useState(false);
  const [qualificationFields, setQualificationFields] = useState(defaultQualificationFields);

  // Fetch funnel stages
  const { data: stages = [] } = useQuery({
    queryKey: ["funnel-stages-wizard", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("funnel_stages")
        .select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("position");
      return data || [];
    },
    enabled: !!workspaceId && open,
  });

  // Fetch WhatsApp instances
  const { data: instances = [] } = useQuery({
    queryKey: ["whatsapp-instances-wizard", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, display_name")
        .eq("workspace_id", workspaceId);
      return data || [];
    },
    enabled: !!workspaceId && open,
  });

  const isDirty = step > 1 || !!agentName || !!selectedObjective;

  const handleClose = () => {
    if (isDirty) {
      setCancelDialogOpen(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setSelectedObjective(null);
    setAgentName("");
    setCompanyName("");
    setNiche("");
    setSite("");
    setInstagram("");
    setPhone("");
    setEmail("");
    setIsDigital(true);
    setAddress("");
    setAgentRole("");
    setTone("consultivo");
    setUseEmojis(true);
    setResponseLength("medium");
    setResponseDelay(-1);
    setRespondTo("all");
    setRespondToStages([]);
    setInstanceName("");
    setQualificationEnabled(false);
    setQualificationFields(defaultQualificationFields);
    setActivateOnCreate(false);
    setCancelDialogOpen(false);
    onOpenChange(false);
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!selectedObjective && agentName.trim().length >= 2;
      case 2: return companyName.trim().length >= 2 && niche.trim().length >= 2;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  }, [step, selectedObjective, agentName, companyName, niche]);

  const objectiveData = objectives.find(o => o.id === selectedObjective);

  const generatedPrompt = useMemo(() => {
    const toneMap: Record<string, string> = {
      formal: "Formal e profissional",
      consultivo: "Consultivo e acolhedor",
      descontraido: "Descontraído e simpático",
      dinamico: "Dinâmico e energético",
      premium: "Premium e exclusivo",
    };
    const objLabel = objectiveData?.label || "Atendimento";
    let prompt = `Você é ${agentRole || "Atendente"}, ${agentName}, da empresa ${companyName || "[Empresa]"}.\n`;
    prompt += `Tom: ${toneMap[tone] || tone}. ${useEmojis ? "Pode usar emojis com moderação." : "Não use emojis."}\n`;
    prompt += `Objetivo: ${objLabel}.\n`;
    if (niche) prompt += `Nicho: ${niche}.\n`;
    prompt += "\nInformações da empresa:\n";
    if (instagram) prompt += `- Instagram: ${instagram}\n`;
    if (site) prompt += `- Site: ${site}\n`;
    if (phone) prompt += `- Telefone: ${phone}\n`;
    if (email) prompt += `- E-mail: ${email}\n`;
    if (isDigital) {
      prompt += "- Atendimento 100% digital\n";
    } else if (address) {
      prompt += `- Endereço: ${address}\n`;
    }
    return prompt;
  }, [agentName, agentRole, companyName, niche, tone, useEmojis, instagram, site, phone, email, isDigital, address, objectiveData]);

  const handleCreate = () => {
    const data: CreateAgentWizardData = {
      name: agentName,
      type: objectiveData?.type || "custom",
      main_objective: selectedObjective || "atendimento",
      company_info: { name: companyName, instagram, site, phone, email, is_digital: isDigital, address: isDigital ? "" : address },
      niche,
      agent_role: agentRole,
      tone_of_voice: tone,
      use_emojis: useEmojis,
      response_length: responseLength,
      response_delay_seconds: responseDelay,
      respond_to: respondTo,
      respond_to_stages: respondToStages,
      instance_name: instanceName,
      qualification_enabled: qualificationEnabled,
      qualification_fields: qualificationFields.filter(f => f.active),
      is_active: activateOnCreate,
      system_prompt: generatedPrompt,
      model: "google/gemini-3-flash-preview",
      temperature: 0.7,
      max_tokens: 2048,
      tools: ["atualizar_lead", "aplicar_tag", "mover_etapa", "pausar_ia"],
      pause_code: "251213",
      resume_keyword: "Atendimento finalizado",
      message_split_enabled: true,
      message_split_length: 400,
    };
    onSubmit(data);
  };

  const toggleStage = (stageId: string) => {
    setRespondToStages(prev =>
      prev.includes(stageId) ? prev.filter(s => s !== stageId) : [...prev, stageId]
    );
  };

  const toggleQualField = (fieldId: string) => {
    setQualificationFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, active: !f.active } : f)
    );
  };

  const delayLabel = delays.find(d => d.value === responseDelay)?.label || "Imediato";
  const toneLabel = tones.find(t => t.id === tone)?.label || tone;
  const lengthLabel = responseLengths.find(r => r.id === responseLength)?.label || responseLength;
  const activeQualFields = qualificationFields.filter(f => f.active);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg text-foreground">Criar novo Agente de IA</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Etapa {step} de {TOTAL_STEPS}</span>
              <Progress value={(step / TOTAL_STEPS) * 100} className="h-2 flex-1" />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && <Step1 selectedObjective={selectedObjective} setSelectedObjective={setSelectedObjective} agentName={agentName} setAgentName={setAgentName} />}
            {step === 2 && <Step2 companyName={companyName} setCompanyName={setCompanyName} niche={niche} setNiche={setNiche} site={site} setSite={setSite} instagram={instagram} setInstagram={setInstagram} phone={phone} setPhone={setPhone} email={email} setEmail={setEmail} isDigital={isDigital} setIsDigital={setIsDigital} address={address} setAddress={setAddress} />}
            {step === 3 && <Step3 agentRole={agentRole} setAgentRole={setAgentRole} tone={tone} setTone={setTone} useEmojis={useEmojis} setUseEmojis={setUseEmojis} responseLength={responseLength} setResponseLength={setResponseLength} responseDelay={responseDelay} setResponseDelay={setResponseDelay} />}
            {step === 4 && <Step4 respondTo={respondTo} setRespondTo={setRespondTo} respondToStages={respondToStages} toggleStage={toggleStage} stages={stages} instanceName={instanceName} setInstanceName={setInstanceName} instances={instances} qualificationEnabled={qualificationEnabled} setQualificationEnabled={setQualificationEnabled} qualificationFields={qualificationFields} toggleQualField={toggleQualField} />}
            {step === 5 && <Step5 agentName={agentName} objectiveLabel={objectiveData?.label || ""} companyName={companyName} niche={niche} toneLabel={toneLabel} lengthLabel={lengthLabel} delayLabel={delayLabel} instanceName={instanceName} respondTo={respondTo} qualificationEnabled={qualificationEnabled} activeQualFields={activeQualFields} generatedPrompt={generatedPrompt} activateOnCreate={activateOnCreate} setActivateOnCreate={setActivateOnCreate} />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
            <Button variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()} className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              {step > 1 ? "Voltar" : "Cancelar"}
            </Button>
            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance} className="gap-2">
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isLoading ? "Criando..." : "Criar Agente"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar criação?</AlertDialogTitle>
            <AlertDialogDescription>As informações preenchidas serão perdidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={resetAndClose}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ──────────────── STEP 1 ──────────────── */
function Step1({ selectedObjective, setSelectedObjective, agentName, setAgentName }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Qual é o objetivo principal desta agente?</h3>
        <p className="text-sm text-muted-foreground">Selecione o tipo de atendimento que ela fará</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {objectives.map(obj => {
          const Icon = obj.icon;
          const selected = selectedObjective === obj.id;
          return (
            <button
              key={obj.id}
              type="button"
              onClick={() => setSelectedObjective(obj.id)}
              className={cn(
                "relative p-4 rounded-xl border-2 text-left transition-all",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
              <Icon className={cn("w-6 h-6 mb-2", selected ? "text-primary" : "text-muted-foreground")} />
              <h4 className="font-medium text-sm">{obj.label}</h4>
              <p className="text-xs text-muted-foreground mt-1">{obj.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="space-y-2">
        <Label>Nome desta agente</Label>
        <Input placeholder="Ex: Sofia, Assistente Virtual, Atendente ECX" value={agentName} onChange={e => setAgentName(e.target.value)} />
      </div>
    </div>
  );
}

/* ──────────────── STEP 2 ──────────────── */
function Step2({ companyName, setCompanyName, niche, setNiche, site, setSite, instagram, setInstagram, phone, setPhone, email, setEmail, isDigital, setIsDigital, address, setAddress }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Vamos apresentar sua empresa para a agente</h3>
        <p className="text-sm text-muted-foreground">Ela usará estas informações automaticamente nas conversas</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da empresa *</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Sua empresa" />
        </div>
        <div className="space-y-2">
          <Label>Nicho/Segmento *</Label>
          <Input value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ex: Clínica odontológica" list="niche-suggestions" />
          <datalist id="niche-suggestions">
            {nicheSuggestions.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label>Site</Label>
          <Input value={site} onChange={e => setSite(e.target.value)} placeholder="https://seusite.com" />
        </div>
        <div className="space-y-2">
          <Label>Instagram</Label>
          <Input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@suaempresa" />
        </div>
        <div className="space-y-2">
          <Label>Telefone de contato</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox checked={isDigital} onCheckedChange={(v) => setIsDigital(!!v)} id="is-digital" />
          <Label htmlFor="is-digital" className="cursor-pointer">Negócio 100% digital — sem endereço físico</Label>
        </div>
        {!isDigital && (
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, cidade" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── STEP 3 ──────────────── */
function Step3({ agentRole, setAgentRole, tone, setTone, useEmojis, setUseEmojis, responseLength, setResponseLength, responseDelay, setResponseDelay }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Como sua agente deve se comportar?</h3>
      </div>

      <div className="space-y-2">
        <Label>Cargo/função</Label>
        <Input value={agentRole} onChange={e => setAgentRole(e.target.value)} placeholder="Ex: Consultora de Vendas, Atendente, Especialista" />
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label>Tom de voz</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {tones.map(t => (
            <button key={t.id} type="button" onClick={() => setTone(t.id)}
              className={cn("p-3 rounded-lg border text-center transition-all text-sm",
                tone === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
              )}
            >
              <span className="text-lg block mb-1">{t.emoji}</span>
              <span className="font-medium text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Emojis */}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <Label className="cursor-pointer">Pode usar emojis nas respostas</Label>
        <Switch checked={useEmojis} onCheckedChange={setUseEmojis} />
      </div>

      {/* Response Length */}
      <div className="space-y-2">
        <Label>Tamanho das respostas</Label>
        <div className="grid grid-cols-3 gap-2">
          {responseLengths.map(r => (
            <button key={r.id} type="button" onClick={() => setResponseLength(r.id)}
              className={cn("p-3 rounded-lg border text-center transition-all",
                responseLength === r.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
              )}
            >
              <span className="text-lg block mb-1">{r.emoji}</span>
              <span className="font-medium text-xs block">{r.label}</span>
              <span className="text-[10px] text-muted-foreground">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Response Delay */}
      <div className="space-y-2">
        <Label>Tempo de resposta</Label>
        <p className="text-xs text-muted-foreground">Respostas com pequeno atraso parecem mais naturais</p>
        <RadioGroup value={String(responseDelay)} onValueChange={v => setResponseDelay(Number(v))} className="space-y-1">
          {delays.map(d => (
            <label key={d.value} className={cn("flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
              responseDelay === d.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}>
              <RadioGroupItem value={String(d.value)} />
              <span className="text-base">{d.emoji}</span>
              <span className="text-sm font-medium">{d.label}</span>
              {d.hint && <span className="text-xs text-muted-foreground ml-auto">({d.hint})</span>}
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

/* ──────────────── STEP 4 ──────────────── */
function Step4({ respondTo, setRespondTo, respondToStages, toggleStage, stages, instanceName, setInstanceName, instances, qualificationEnabled, setQualificationEnabled, qualificationFields, toggleQualField }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Quando e para quem ela deve responder?</h3>
      </div>

      {/* Respond to */}
      <div className="space-y-2">
        <Label>Quem ela responde</Label>
        <RadioGroup value={respondTo} onValueChange={setRespondTo} className="space-y-1">
          {[
            { value: "all", emoji: "👥", label: "Todos os contatos" },
            { value: "new_leads", emoji: "🆕", label: "Apenas novos leads (primeiro contato)" },
            { value: "specific_stages", emoji: "🎯", label: "Leads em etapas específicas" },
          ].map(opt => (
            <label key={opt.value} className={cn("flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
              respondTo === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}>
              <RadioGroupItem value={opt.value} />
              <span>{opt.emoji}</span>
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ))}
        </RadioGroup>
        {respondTo === "specific_stages" && stages.length > 0 && (
          <div className="ml-8 mt-2 space-y-1">
            {stages.map((s: any) => (
              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={respondToStages.includes(s.id)} onCheckedChange={() => toggleStage(s.id)} />
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Instance */}
      <div className="space-y-2">
        <Label>Em qual número ela vai atender?</Label>
        <Select value={instanceName} onValueChange={setInstanceName}>
          <SelectTrigger><SelectValue placeholder="Todas as instâncias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as instâncias</SelectItem>
            {instances.map((i: any) => (
              <SelectItem key={i.instance_name} value={i.instance_name}>
                {i.display_name || i.instance_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Qualification */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Qualificação inicial</Label>
            <p className="text-xs text-muted-foreground">Fazer perguntas antes de responder livremente?</p>
          </div>
          <Switch checked={qualificationEnabled} onCheckedChange={setQualificationEnabled} />
        </div>
        {qualificationEnabled && (
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">A agente coletará esses dados em sequência antes de entrar no atendimento livre</p>
            {qualificationFields.map((f: any) => (
              <label key={f.id} className="flex items-center gap-3 text-sm cursor-pointer p-2 rounded border border-border">
                <Checkbox checked={f.active} onCheckedChange={() => toggleQualField(f.id)} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground block truncate">"{f.question}"</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── STEP 5 ──────────────── */
function Step5({ agentName, objectiveLabel, companyName, niche, toneLabel, lengthLabel, delayLabel, instanceName, respondTo, qualificationEnabled, activeQualFields, generatedPrompt, activateOnCreate, setActivateOnCreate }: any) {
  const [promptOpen, setPromptOpen] = useState(false);

  const respondToLabel = respondTo === "all" ? "Todos" : respondTo === "new_leads" ? "Apenas novos leads" : "Etapas específicas";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Tudo certo! Revise antes de criar</h3>
      </div>

      <div className="rounded-xl border border-border p-5 space-y-3 text-sm">
        <div className="flex items-start gap-2"><span>🤖</span><span><strong>{agentName}</strong> — {objectiveLabel}</span></div>
        <div className="flex items-start gap-2"><span>🏢</span><span>{companyName} ({niche})</span></div>
        <div className="flex items-start gap-2"><span>🎭</span><span>Tom: {toneLabel} — Respostas: {lengthLabel} — Delay: {delayLabel}</span></div>
        <div className="flex items-start gap-2"><span>📱</span><span>Instância: {instanceName || "Todas"}</span></div>
        <div className="flex items-start gap-2"><span>👥</span><span>Responde para: {respondToLabel}</span></div>
        <div className="flex items-start gap-2"><span>📋</span><span>Qualificação: {qualificationEnabled ? `Ativa — ${activeQualFields.length} campo(s)` : "Inativa"}</span></div>
      </div>

      <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-start">
            <ChevronDown className={cn("w-4 h-4 transition-transform", promptOpen && "rotate-180")} />
            Ver prompt gerado automaticamente
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 p-4 rounded-lg bg-muted text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
            {generatedPrompt}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={activateOnCreate} onCheckedChange={(v) => setActivateOnCreate(!!v)} />
        Ativar agente imediatamente após criar
      </label>
    </div>
  );
}
