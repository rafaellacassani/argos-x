import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAIAgents, AIAgent } from "@/hooks/useAIAgents";
import { Save, Loader2, Bot, BookOpen, HelpCircle, Settings, Target, Wrench, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonalityTab } from "./tabs/PersonalityTab";
import { KnowledgeTab } from "./tabs/KnowledgeTab";
import { FaqTab } from "./tabs/FaqTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { QualificationTab } from "./tabs/QualificationTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { AdvancedTab } from "./tabs/AdvancedTab";

interface AgentDetailDialogProps {
  agent: AIAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabs = [
  { id: "personality", label: "Personalidade", icon: Bot },
  { id: "knowledge", label: "Base de Conhecimento", icon: BookOpen },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "behavior", label: "Comportamento", icon: Settings },
  { id: "qualification", label: "Qualificação", icon: Target },
  { id: "tools", label: "Ferramentas", icon: Wrench },
  { id: "advanced", label: "Avançado", icon: FlaskConical },
];

export function AgentDetailDialog({ agent, open, onOpenChange }: AgentDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("personality");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  const { updateAgent, toggleAgent } = useAIAgents();
  const { toast } = useToast();

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name || "",
        description: agent.description || "",
        agent_role: (agent as any).agent_role || "",
        tone_of_voice: (agent as any).tone_of_voice || "consultivo",
        use_emojis: (agent as any).use_emojis ?? true,
        main_objective: (agent as any).main_objective || "vender",
        niche: (agent as any).niche || "",
        company_info: (agent as any).company_info || {},
        knowledge_products: (agent as any).knowledge_products || "",
        knowledge_faq: (agent as any).knowledge_faq || [],
        knowledge_rules: (agent as any).knowledge_rules || "",
        knowledge_extra: (agent as any).knowledge_extra || "",
        respond_to: (agent as any).respond_to || "all",
        respond_to_stages: (agent as any).respond_to_stages || [],
        response_delay_seconds: (agent as any).response_delay_seconds ?? 0,
        response_length: (agent as any).response_length || "medium",
        instance_name: (agent as any).instance_name || "",
        pause_code: agent.pause_code || "251213",
        resume_keyword: agent.resume_keyword || "Atendimento finalizado",
        qualification_enabled: (agent as any).qualification_enabled ?? false,
        qualification_fields: (agent as any).qualification_fields || [],
        tools: agent.tools || [],
        trainer_phone: (agent as any).trainer_phone || "",
        model: agent.model || "google/gemini-3-flash-preview",
        temperature: agent.temperature ?? 0.7,
        max_tokens: agent.max_tokens ?? 2048,
        message_split_enabled: agent.message_split_enabled ?? true,
        message_split_length: agent.message_split_length ?? 400,
        system_prompt: agent.system_prompt || "",
        type: agent.type || "sdr",
      });
      setIsDirty(false);
    }
  }, [agent]);

  const updateField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const generateSystemPrompt = () => {
    const ci = formData.company_info || {};
    const toneMap: Record<string, string> = {
      formal: "Formal e profissional",
      consultivo: "Consultivo e acolhedor",
      descontraido: "Descontraído e simpático",
      tecnico: "Técnico e preciso",
      premium: "Premium e exclusivo",
    };
    const objMap: Record<string, string> = {
      vender: "Vender produtos/serviços",
      agendar: "Agendar reuniões/consultas",
      qualificar: "Qualificar leads",
      suporte: "Oferecer suporte ao cliente",
      cobranca: "Cobranças amigáveis",
      onboarding: "Onboarding de novos clientes",
      personalizado: "Personalizado",
    };

    let prompt = `Você é ${formData.agent_role || "Atendente"}, ${formData.name}, da empresa ${ci.name || "[Nome da empresa]"}.\n`;
    prompt += `Tom: ${toneMap[formData.tone_of_voice] || formData.tone_of_voice}. ${formData.use_emojis ? "Pode usar emojis com moderação." : "Não use emojis."}\n`;
    prompt += `Objetivo: ${objMap[formData.main_objective] || formData.main_objective}.\n`;
    if (formData.niche) prompt += `Nicho: ${formData.niche}.\n`;
    prompt += "\nInformações da empresa:\n";
    if (ci.instagram) prompt += `- Instagram: ${ci.instagram}\n`;
    if (ci.site) prompt += `- Site: ${ci.site}\n`;
    if (ci.phone) prompt += `- Telefone: ${ci.phone}\n`;
    if (ci.email) prompt += `- E-mail: ${ci.email}\n`;
    if (ci.is_digital) {
      prompt += "- Atendimento 100% digital\n";
    } else if (ci.address) {
      prompt += `- Endereço: ${ci.address}\n`;
    }
    if (formData.knowledge_products) prompt += `\nProdutos/Serviços:\n${formData.knowledge_products}\n`;
    if (formData.knowledge_rules) prompt += `\nRegras:\n${formData.knowledge_rules}\n`;
    if (formData.knowledge_extra) prompt += `\n${formData.knowledge_extra}\n`;

    return prompt;
  };

  const handleSave = async () => {
    if (!agent) return;

    const autoPrompt = generateSystemPrompt();
    const payload: any = {
      id: agent.id,
      name: formData.name,
      description: formData.description,
      agent_role: formData.agent_role,
      tone_of_voice: formData.tone_of_voice,
      use_emojis: formData.use_emojis,
      main_objective: formData.main_objective,
      niche: formData.niche,
      company_info: formData.company_info,
      knowledge_products: formData.knowledge_products,
      knowledge_faq: formData.knowledge_faq,
      knowledge_rules: formData.knowledge_rules,
      knowledge_extra: formData.knowledge_extra,
      respond_to: formData.respond_to,
      respond_to_stages: formData.respond_to_stages,
      response_delay_seconds: formData.response_delay_seconds,
      response_length: formData.response_length,
      instance_name: formData.instance_name || null,
      pause_code: formData.pause_code,
      resume_keyword: formData.resume_keyword,
      qualification_enabled: formData.qualification_enabled,
      qualification_fields: formData.qualification_fields,
      tools: formData.tools,
      trainer_phone: formData.trainer_phone,
      model: formData.model,
      temperature: formData.temperature,
      max_tokens: formData.max_tokens,
      message_split_enabled: formData.message_split_enabled,
      message_split_length: formData.message_split_length,
      system_prompt: formData.system_prompt || autoPrompt,
      type: formData.type,
    };

    updateAgent.mutate(payload, {
      onSuccess: () => setIsDirty(false),
    });
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-foreground">
                  {formData.name || agent.name}
                </h2>
                <Badge variant={agent.is_active ? "default" : "secondary"} className="text-xs">
                  {agent.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{formData.description || agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={agent.is_active}
              onCheckedChange={(checked) => toggleAgent.mutate({ id: agent.id, is_active: checked })}
            />
            <Button onClick={handleSave} disabled={!isDirty || updateAgent.isPending} className="gap-2">
              {updateAgent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="w-56 border-r border-border py-4 px-2 space-y-1 shrink-0 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "personality" && (
              <PersonalityTab formData={formData} updateField={updateField} generatePrompt={generateSystemPrompt} />
            )}
            {activeTab === "knowledge" && (
              <KnowledgeTab formData={formData} updateField={updateField} />
            )}
            {activeTab === "faq" && (
              <FaqTab formData={formData} updateField={updateField} />
            )}
            {activeTab === "behavior" && (
              <BehaviorTab formData={formData} updateField={updateField} />
            )}
            {activeTab === "qualification" && (
              <QualificationTab formData={formData} updateField={updateField} />
            )}
            {activeTab === "tools" && (
              <ToolsTab formData={formData} updateField={updateField} />
            )}
            {activeTab === "advanced" && (
              <AdvancedTab formData={formData} updateField={updateField} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
