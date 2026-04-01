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
import { Textarea } from "@/components/ui/textarea";
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
  Loader2,
  TrendingUp,
  Plus,
  Trash2,
  Wifi,
  BookOpen,
  HandHeart,
  Bell,
  Smartphone,
  Shield,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ConnectionModal } from "@/components/whatsapp/ConnectionModal";

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
  // Knowledge fields
  knowledge_products: string;
  knowledge_rules: string;
  knowledge_extra: string;
  // Greeting
  on_start_actions: any[];
  // Follow-up
  followup_enabled: boolean;
  followup_sequence: any[];
  // defaults
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

const TOTAL_STEPS = 8;

const objectives = [
  { id: "atendimento", icon: MessageCircle, label: "Atendimento geral", desc: "Responde dúvidas e qualifica leads", type: "sdr" },
  { id: "agendar", icon: Calendar, label: "Agendamento", desc: "Marca reuniões e consultas automaticamente", type: "scheduler" },
  { id: "sdr", icon: Target, label: "Pré-venda (SDR)", desc: "Qualifica e aquece leads para o time comercial", type: "sdr" },
  { id: "vendedora", icon: TrendingUp, label: "Vendedora", desc: "Fecha vendas com persuasão e urgência", type: "closer" },
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
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);

  // Step 1 — Objetivo e Nome
  const [selectedObjective, setSelectedObjective] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");

  // Step 2 — Empresa
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [site, setSite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isDigital, setIsDigital] = useState(true);
  const [address, setAddress] = useState("");

  // Step 3 — Comportamento
  const [agentRole, setAgentRole] = useState("");
  const [tone, setTone] = useState("consultivo");
  const [useEmojis, setUseEmojis] = useState(true);
  const [responseLength, setResponseLength] = useState("medium");
  const [responseDelay, setResponseDelay] = useState(-1);

  // Step 4 — Conhecimento
  const [knowledgeProducts, setKnowledgeProducts] = useState("");
  const [knowledgeRules, setKnowledgeRules] = useState("");
  const [knowledgeExtra, setKnowledgeExtra] = useState("");

  // Step 5 — Boas-vindas
  const [greetingMessage, setGreetingMessage] = useState("");

  // Step 6 — Follow-up
  const [followupEnabled, setFollowupEnabled] = useState(false);
  const [followupSequence, setFollowupSequence] = useState<{ delay_hours: number; message: string }[]>([
    { delay_hours: 2, message: "Oi! Vi que ficou alguma dúvida, posso ajudar? 😊" },
  ]);

  // Step 7 — Conexão
  const [instanceName, setInstanceName] = useState("__all__");

  // Step 8 — Ativação
  const [activateOnCreate, setActivateOnCreate] = useState(true);

  // Qualification (part of step 3 / collapsed)
  const [qualificationEnabled, setQualificationEnabled] = useState(false);
  const [qualificationFields, setQualificationFields] = useState(defaultQualificationFields);
  const [respondTo, setRespondTo] = useState("all");
  const [respondToStages, setRespondToStages] = useState<string[]>([]);

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
    setInstanceName("__all__");
    setQualificationEnabled(false);
    setQualificationFields(defaultQualificationFields);
    setActivateOnCreate(true);
    setCancelDialogOpen(false);
    setKnowledgeProducts("");
    setKnowledgeRules("");
    setKnowledgeExtra("");
    setGreetingMessage("");
    setFollowupEnabled(false);
    setFollowupSequence([{ delay_hours: 2, message: "Oi! Vi que ficou alguma dúvida, posso ajudar? 😊" }]);
    onOpenChange(false);
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return !!selectedObjective && agentName.trim().length >= 2;
      case 2: return companyName.trim().length >= 2 && niche.trim().length >= 2;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      case 7: return true;
      case 8: return true;
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
    let prompt = "";

    if (selectedObjective === "vendedora") {
      prompt += `Você é ${agentName}, ${agentRole || "Closer de Vendas"} da empresa ${companyName || "[Empresa]"}.\n`;
      prompt += `Tom: Persuasivo, confiante e enérgico — inspirado no estilo Jordan Belfort.\n`;
      prompt += `${useEmojis ? "Use emojis estrategicamente para criar conexão e urgência." : "Não use emojis."}\n\n`;
      prompt += `## MENTALIDADE VENDEDORA\n`;
      prompt += `- Sempre conduza a conversa com CONFIANÇA INABALÁVEL no produto/serviço.\n`;
      prompt += `- Use a técnica "Straight Line Selling": mantenha o lead na linha reta rumo ao fechamento.\n`;
      prompt += `- Crie URGÊNCIA real e ESCASSEZ genuína em cada interação.\n`;
      prompt += `- Quebre objeções rapidamente com empatia + lógica + emoção.\n`;
      prompt += `- Nunca aceite um "não" como resposta final — sempre tenha uma contra-argumentação.\n`;
      prompt += `- Use perguntas estratégicas para descobrir a dor real do cliente.\n`;
      prompt += `- Faça o lead SENTIR que está perdendo uma oportunidade única ao não agir agora.\n`;
      prompt += `- Seja assertivo mas nunca agressivo. A persuasão vem da convicção, não da pressão.\n`;
      prompt += `- Use storytelling e provas sociais para aumentar credibilidade.\n`;
      prompt += `- Sempre proponha o próximo passo concreto (agendar, comprar, testar).\n\n`;
    } else {
      prompt += `Você é ${agentRole || "Atendente"}, ${agentName}, da empresa ${companyName || "[Empresa]"}.\n`;
      prompt += `Tom: ${toneMap[tone] || tone}. ${useEmojis ? "Pode usar emojis com moderação." : "Não use emojis."}\n`;
    }

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

    if (knowledgeProducts.trim()) {
      prompt += `\n## PRODUTOS E SERVIÇOS\n${knowledgeProducts}\n`;
    }
    if (knowledgeRules.trim()) {
      prompt += `\n## REGRAS IMPORTANTES\n${knowledgeRules}\n`;
    }
    if (knowledgeExtra.trim()) {
      prompt += `\n## INFORMAÇÕES ADICIONAIS\n${knowledgeExtra}\n`;
    }

    return prompt;
  }, [agentName, agentRole, companyName, niche, tone, useEmojis, instagram, site, phone, email, isDigital, address, objectiveData, selectedObjective, knowledgeProducts, knowledgeRules, knowledgeExtra]);

  const handleCreate = () => {
    const onStartActions = greetingMessage.trim()
      ? [{ type: "send_message", message: greetingMessage.trim() }]
      : [];

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
      instance_name: instanceName === "__all__" ? "" : instanceName,
      qualification_enabled: qualificationEnabled,
      qualification_fields: qualificationFields.filter(f => f.active),
      is_active: activateOnCreate,
      system_prompt: generatedPrompt,
      knowledge_products: knowledgeProducts,
      knowledge_rules: knowledgeRules,
      knowledge_extra: knowledgeExtra,
      on_start_actions: onStartActions,
      followup_enabled: followupEnabled,
      followup_sequence: followupEnabled ? followupSequence : [],
      model: "openai/gpt-4o-mini",
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

  const stepTitles = [
    "O que sua IA vai fazer?",
    "Sobre sua empresa",
    "Como a IA deve se comportar?",
    "O que a IA precisa saber?",
    "Mensagem de boas-vindas",
    "Reengajar quem não respondeu",
    "Conectar ao WhatsApp",
    "Tudo pronto!",
  ];

  const stepIcons = [Target, BookOpen, HandHeart, BookOpen, MessageCircle, Bell, Smartphone, Shield];

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
            <p className="text-xs text-muted-foreground mt-2">{stepTitles[step - 1]}</p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 1 && (
              <StepObjective
                selectedObjective={selectedObjective}
                setSelectedObjective={setSelectedObjective}
                agentName={agentName}
                setAgentName={setAgentName}
              />
            )}
            {step === 2 && (
              <StepCompany
                companyName={companyName} setCompanyName={setCompanyName}
                niche={niche} setNiche={setNiche}
                site={site} setSite={setSite}
                instagram={instagram} setInstagram={setInstagram}
                phone={phone} setPhone={setPhone}
                email={email} setEmail={setEmail}
                isDigital={isDigital} setIsDigital={setIsDigital}
                address={address} setAddress={setAddress}
              />
            )}
            {step === 3 && (
              <StepBehavior
                agentRole={agentRole} setAgentRole={setAgentRole}
                tone={tone} setTone={setTone}
                useEmojis={useEmojis} setUseEmojis={setUseEmojis}
                responseLength={responseLength} setResponseLength={setResponseLength}
                responseDelay={responseDelay} setResponseDelay={setResponseDelay}
                respondTo={respondTo} setRespondTo={setRespondTo}
                respondToStages={respondToStages} toggleStage={toggleStage}
                stages={stages}
                qualificationEnabled={qualificationEnabled} setQualificationEnabled={setQualificationEnabled}
                qualificationFields={qualificationFields} toggleQualField={toggleQualField}
              />
            )}
            {step === 4 && (
              <StepKnowledge
                knowledgeProducts={knowledgeProducts} setKnowledgeProducts={setKnowledgeProducts}
                knowledgeRules={knowledgeRules} setKnowledgeRules={setKnowledgeRules}
                knowledgeExtra={knowledgeExtra} setKnowledgeExtra={setKnowledgeExtra}
              />
            )}
            {step === 5 && (
              <StepGreeting
                greetingMessage={greetingMessage}
                setGreetingMessage={setGreetingMessage}
              />
            )}
            {step === 6 && (
              <StepFollowup
                followupEnabled={followupEnabled} setFollowupEnabled={setFollowupEnabled}
                followupSequence={followupSequence} setFollowupSequence={setFollowupSequence}
              />
            )}
            {step === 7 && (
              <StepConnection
                instanceName={instanceName} setInstanceName={setInstanceName}
                instances={instances}
                onConnectNew={() => setConnectionModalOpen(true)}
              />
            )}
            {step === 8 && (
              <StepReview
                agentName={agentName}
                objectiveLabel={objectiveData?.label || ""}
                companyName={companyName}
                niche={niche}
                toneLabel={toneLabel}
                lengthLabel={lengthLabel}
                delayLabel={delayLabel}
                instanceName={instanceName}
                instances={instances}
                respondTo={respondTo}
                qualificationEnabled={qualificationEnabled}
                activeQualFields={activeQualFields}
                greetingMessage={greetingMessage}
                followupEnabled={followupEnabled}
                followupSequence={followupSequence}
                knowledgeProducts={knowledgeProducts}
                generatedPrompt={generatedPrompt}
                activateOnCreate={activateOnCreate}
                setActivateOnCreate={setActivateOnCreate}
              />
            )}
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
                {isLoading ? "Criando..." : activateOnCreate ? "Criar e Ativar" : "Criar Agente"}
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

      {/* Connection Modal for step 7 */}
      <ConnectionModal
        open={connectionModalOpen}
        onOpenChange={setConnectionModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-wizard"] });
          setConnectionModalOpen(false);
        }}
      />
    </>
  );
}

/* ──────────────── STEP 1: Objetivo e Nome ──────────────── */
function StepObjective({ selectedObjective, setSelectedObjective, agentName, setAgentName }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Qual é o objetivo principal desta IA?</h3>
        <p className="text-sm text-muted-foreground">Escolha o que ela vai fazer por você</p>
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
        <Label>Dê um nome para sua IA</Label>
        <Input placeholder="Ex: Sofia, Atendente Virtual, Assistente" value={agentName} onChange={e => setAgentName(e.target.value)} />
        <p className="text-xs text-muted-foreground">Esse é o nome que os clientes vão ver nas conversas</p>
      </div>
    </div>
  );
}

/* ──────────────── STEP 2: Empresa ──────────────── */
function StepCompany({ companyName, setCompanyName, niche, setNiche, site, setSite, instagram, setInstagram, phone, setPhone, email, setEmail, isDigital, setIsDigital, address, setAddress }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Conte sobre sua empresa</h3>
        <p className="text-sm text-muted-foreground">A IA vai usar essas informações para responder melhor</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome da empresa *</Label>
          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Sua empresa" />
        </div>
        <div className="space-y-2">
          <Label>Tipo de negócio *</Label>
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
          <Label>Telefone</Label>
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

/* ──────────────── STEP 3: Comportamento ──────────────── */
function StepBehavior({ agentRole, setAgentRole, tone, setTone, useEmojis, setUseEmojis, responseLength, setResponseLength, responseDelay, setResponseDelay, respondTo, setRespondTo, respondToStages, toggleStage, stages, qualificationEnabled, setQualificationEnabled, qualificationFields, toggleQualField }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Como a IA deve se comportar?</h3>
        <p className="text-sm text-muted-foreground">Defina a personalidade e o jeito de responder</p>
      </div>

      <div className="space-y-2">
        <Label>Qual o cargo da IA?</Label>
        <Input value={agentRole} onChange={e => setAgentRole(e.target.value)} placeholder="Ex: Consultora de Vendas, Atendente" />
        <p className="text-xs text-muted-foreground">Isso aparece no perfil da IA</p>
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
        <Label>Velocidade de resposta</Label>
        <p className="text-xs text-muted-foreground">Um pequeno atraso faz parecer mais humano</p>
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

      {/* Respond To */}
      <div className="space-y-2">
        <Label>Quem a IA deve responder?</Label>
        <RadioGroup value={respondTo} onValueChange={setRespondTo} className="space-y-1">
          {[
            { value: "all", emoji: "👥", label: "Todos os contatos" },
            { value: "new_leads", emoji: "🆕", label: "Apenas novos (primeiro contato)" },
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

      {/* Qualification */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Fazer perguntas antes de atender</Label>
            <p className="text-xs text-muted-foreground">A IA coleta dados antes de responder livremente</p>
          </div>
          <Switch checked={qualificationEnabled} onCheckedChange={setQualificationEnabled} />
        </div>
        {qualificationEnabled && (
          <div className="space-y-2 mt-2">
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

/* ──────────────── STEP 4: Conhecimento ──────────────── */
function StepKnowledge({ knowledgeProducts, setKnowledgeProducts, knowledgeRules, setKnowledgeRules, knowledgeExtra, setKnowledgeExtra }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">O que a IA precisa saber?</h3>
        <p className="text-sm text-muted-foreground">
          Quanto mais informação você colocar aqui, melhor ela vai responder seus clientes.
          Pode preencher depois também.
        </p>
      </div>

      <div className="space-y-2">
        <Label>📦 Produtos e serviços</Label>
        <Textarea
          value={knowledgeProducts}
          onChange={e => setKnowledgeProducts(e.target.value)}
          placeholder={"Cole aqui seus produtos, preços e descrições.\n\nExemplo:\n- Limpeza dental: R$ 150\n- Clareamento: R$ 800\n- Implante: a partir de R$ 2.500\n- Consulta de avaliação: grátis"}
          className="min-h-[120px]"
        />
      </div>

      <div className="space-y-2">
        <Label>📋 Regras da IA</Label>
        <Textarea
          value={knowledgeRules}
          onChange={e => setKnowledgeRules(e.target.value)}
          placeholder={"O que a IA pode e não pode fazer?\n\nExemplo:\n- Nunca dar desconto acima de 10%\n- Sempre pedir o nome antes de agendar\n- Não falar sobre concorrentes\n- Horário de atendimento: seg a sex, 8h às 18h"}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label>💡 Informações extras</Label>
        <Textarea
          value={knowledgeExtra}
          onChange={e => setKnowledgeExtra(e.target.value)}
          placeholder={"Qualquer informação adicional importante.\n\nExemplo:\n- Aceitamos cartão, pix e boleto\n- Temos estacionamento gratuito\n- Trabalhamos com convênios X, Y e Z"}
          className="min-h-[100px]"
        />
      </div>
    </div>
  );
}

/* ──────────────── STEP 5: Boas-vindas ──────────────── */
function StepGreeting({ greetingMessage, setGreetingMessage }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Mensagem de boas-vindas</h3>
        <p className="text-sm text-muted-foreground">
          Quando alguém mandar a primeira mensagem, a IA envia essa saudação antes de tudo.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Mensagem inicial (opcional)</Label>
        <Textarea
          value={greetingMessage}
          onChange={e => setGreetingMessage(e.target.value)}
          placeholder={"Olá! 👋 Bem-vindo à [sua empresa]!\nComo posso te ajudar hoje?"}
          className="min-h-[100px]"
        />
        <p className="text-xs text-muted-foreground">
          💡 Se deixar em branco, a IA vai cumprimentar automaticamente de acordo com as informações da empresa.
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Como funciona?</p>
        <p>Essa mensagem é enviada assim que o cliente manda a primeira mensagem. Depois disso, a IA segue a conversa normalmente.</p>
      </div>
    </div>
  );
}

/* ──────────────── STEP 6: Follow-up ──────────────── */
function StepFollowup({ followupEnabled, setFollowupEnabled, followupSequence, setFollowupSequence }: any) {
  const addStep = () => {
    setFollowupSequence((prev: any[]) => [
      ...prev,
      { delay_hours: 24, message: "" },
    ]);
  };

  const removeStep = (index: number) => {
    setFollowupSequence((prev: any[]) => prev.filter((_: any, i: number) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    setFollowupSequence((prev: any[]) =>
      prev.map((item: any, i: number) => i === index ? { ...item, [field]: value } : item)
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Reengajar quem não respondeu</h3>
        <p className="text-sm text-muted-foreground">
          Se o cliente parar de responder, a IA pode enviar mensagens automáticas para tentar retomar a conversa.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <Label className="text-sm font-medium">Ativar reengajamento automático</Label>
          <p className="text-xs text-muted-foreground">A IA manda mensagens se o cliente sumir</p>
        </div>
        <Switch checked={followupEnabled} onCheckedChange={setFollowupEnabled} />
      </div>

      {followupEnabled && (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>📌 <strong>Como funciona:</strong> Se o cliente não responder, a IA espera o tempo que você definir e manda a mensagem. Se ele continuar sem responder, manda a próxima, e assim por diante.</p>
          </div>

          {followupSequence.map((item: any, index: number) => (
            <div key={index} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Mensagem {index + 1}</span>
                {followupSequence.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStep(index)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Esperar quanto tempo?</Label>
                <Select value={String(item.delay_hours)} onValueChange={v => updateStep(index, "delay_hours", Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hora</SelectItem>
                    <SelectItem value="2">2 horas</SelectItem>
                    <SelectItem value="4">4 horas</SelectItem>
                    <SelectItem value="8">8 horas</SelectItem>
                    <SelectItem value="12">12 horas</SelectItem>
                    <SelectItem value="24">1 dia</SelectItem>
                    <SelectItem value="48">2 dias</SelectItem>
                    <SelectItem value="72">3 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">O que a IA vai mandar?</Label>
                <Textarea
                  value={item.message}
                  onChange={e => updateStep(index, "message", e.target.value)}
                  placeholder="Ex: Oi! Vi que ficou alguma dúvida, posso ajudar? 😊"
                  className="min-h-[60px]"
                />
              </div>
            </div>
          ))}

          {followupSequence.length < 5 && (
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={addStep}>
              <Plus className="w-4 h-4" />
              Adicionar outra mensagem
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────── STEP 7: Conexão ──────────────── */
function StepConnection({ instanceName, setInstanceName, instances, onConnectNew }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Conectar ao WhatsApp</h3>
        <p className="text-sm text-muted-foreground">
          Escolha em qual número de WhatsApp essa IA vai atender.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Número de WhatsApp</Label>
        <Select value={instanceName} onValueChange={setInstanceName}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha um número" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">✅ Atender em todos os números</SelectItem>
            {instances.map((i: any) => (
              <SelectItem key={i.instance_name} value={i.instance_name}>
                {i.display_name || i.instance_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {instances.length === 0 && (
        <div className="rounded-lg bg-muted/50 border border-border p-4 text-center space-y-3">
          <Wifi className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            Você ainda não tem nenhum WhatsApp conectado.
          </p>
        </div>
      )}

      <Button variant="outline" className="w-full gap-2" onClick={onConnectNew}>
        <Plus className="w-4 h-4" />
        Conectar novo número de WhatsApp
      </Button>

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        <p>💡 Se preferir, pode pular essa etapa e conectar depois em <strong>Configurações → Conexões</strong>.</p>
      </div>
    </div>
  );
}

/* ──────────────── STEP 8: Revisão e Ativação ──────────────── */
function StepReview({
  agentName, objectiveLabel, companyName, niche, toneLabel, lengthLabel, delayLabel,
  instanceName, instances, respondTo, qualificationEnabled, activeQualFields,
  greetingMessage, followupEnabled, followupSequence, knowledgeProducts,
  generatedPrompt, activateOnCreate, setActivateOnCreate,
}: any) {
  const [promptOpen, setPromptOpen] = useState(false);

  const respondToLabel = respondTo === "all" ? "Todos" : respondTo === "new_leads" ? "Apenas novos leads" : "Etapas específicas";
  const instanceLabel = instanceName === "__all__"
    ? "Todos os números"
    : (instances.find((i: any) => i.instance_name === instanceName)?.display_name || instanceName);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg mb-1">Tudo pronto! Confira o resumo</h3>
        <p className="text-sm text-muted-foreground">Revise as informações e ative sua IA</p>
      </div>

      <div className="rounded-xl border border-border p-5 space-y-3 text-sm">
        <div className="flex items-start gap-2"><span>🤖</span><span><strong>{agentName}</strong> — {objectiveLabel}</span></div>
        <div className="flex items-start gap-2"><span>🏢</span><span>{companyName} ({niche})</span></div>
        <div className="flex items-start gap-2"><span>🎭</span><span>Tom: {toneLabel} — Respostas: {lengthLabel} — Delay: {delayLabel}</span></div>
        <div className="flex items-start gap-2"><span>📱</span><span>WhatsApp: {instanceLabel}</span></div>
        <div className="flex items-start gap-2"><span>👥</span><span>Responde para: {respondToLabel}</span></div>
        <div className="flex items-start gap-2"><span>📋</span><span>Perguntas iniciais: {qualificationEnabled ? `Sim — ${activeQualFields.length} campo(s)` : "Não"}</span></div>
        <div className="flex items-start gap-2"><span>📦</span><span>Base de conhecimento: {knowledgeProducts.trim() ? "Preenchida ✅" : "Em branco (pode editar depois)"}</span></div>
        <div className="flex items-start gap-2"><span>👋</span><span>Boas-vindas: {greetingMessage.trim() ? "Definida ✅" : "Automática"}</span></div>
        <div className="flex items-start gap-2"><span>🔔</span><span>Reengajamento: {followupEnabled ? `Ativo — ${followupSequence.length} mensagem(ns)` : "Desativado"}</span></div>
      </div>

      <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground w-full justify-start">
            <ChevronDown className={cn("w-4 h-4 transition-transform", promptOpen && "rotate-180")} />
            Ver instruções geradas automaticamente
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 p-4 rounded-lg bg-muted text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
            {generatedPrompt}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
        <div>
          <Label className="text-sm font-semibold">Ativar IA agora</Label>
          <p className="text-xs text-muted-foreground">Ela começa a responder automaticamente</p>
        </div>
        <Switch checked={activateOnCreate} onCheckedChange={setActivateOnCreate} />
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground text-center">
        💡 Você pode <strong>pausar, editar ou testar</strong> sua IA a qualquer momento no painel.
      </div>
    </div>
  );
}
