import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAgentData } from "@/hooks/useAIAgents";
import { Brain, MessageSquare, Calendar, DollarSign, RefreshCw, Sparkles } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  description: z.string().optional(),
  type: z.string(),
  system_prompt: z.string().min(10, "Prompt muito curto"),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().min(100).max(8000),
  tools: z.array(z.string()),
  pause_code: z.string(),
  resume_keyword: z.string(),
  message_split_enabled: z.boolean(),
  message_split_length: z.number().min(100).max(1000),
});

type FormData = z.infer<typeof formSchema>;

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateAgentData) => void;
  isLoading?: boolean;
}

const agentTemplates: Record<string, Partial<FormData>> = {
  sdr: {
    type: "sdr",
    system_prompt: `Você é um assistente de vendas especializado em pré-qualificação de leads. Seu objetivo é:

1. Responder rapidamente às mensagens dos clientes
2. Identificar o que o cliente precisa
3. Coletar informações: nome, email, telefone, empresa
4. Classificar urgência (baixa, média, alta)
5. Encaminhar para humano quando necessário

Regras:
- Seja cordial e objetivo
- Faça uma pergunta por vez
- Nunca invente informações sobre produtos
- Use a tool 'atualizar_lead' para salvar dados coletados
- Use a tool 'aplicar_tag' para classificar o lead`,
    tools: ["atualizar_lead", "aplicar_tag", "mover_etapa", "pausar_ia"],
    temperature: 0.7,
  },
  scheduler: {
    type: "scheduler",
    system_prompt: `Você é um assistente de agendamento. Seu objetivo é:

1. Identificar se o cliente quer agendar, cancelar ou reagendar
2. Coletar nome, email e data/horário desejado
3. Confirmar disponibilidade
4. Confirmar agendamento e enviar detalhes

Regras:
- Sempre confirme a data no formato DD/MM/YYYY HH:MM
- Reuniões duram 50 minutos por padrão
- Ofereça 2-3 opções de horário
- Confirme timezone (Brasil - Brasília)`,
    tools: ["atualizar_lead", "chamar_n8n"],
    temperature: 0.5,
  },
  followup: {
    type: "followup",
    system_prompt: `Você é um assistente de reativação de leads. Seu objetivo é:

1. Retomar contato com leads que pararam de responder
2. Oferecer ajuda ou novas informações
3. Identificar objeções e tentar contorná-las
4. Registrar motivos de não-interesse

Regras:
- Seja gentil e não insistente
- Máximo 3 tentativas de follow-up
- Registre feedback do cliente
- Não pressione para compra imediata`,
    tools: ["atualizar_lead", "aplicar_tag", "mover_etapa"],
    temperature: 0.8,
  },
  collector: {
    type: "collector",
    system_prompt: `Você é um assistente de cobrança amigável. Seu objetivo é:

1. Lembrar sobre faturas em aberto de forma educada
2. Oferecer segunda via de boleto
3. Apresentar opções de parcelamento
4. Registrar acordos ou feedback

Regras:
- Seja respeitoso e profissional
- NUNCA ameace ou pressione
- Ofereça soluções flexíveis
- Encaminhe para humano em casos complexos`,
    tools: ["atualizar_lead", "pausar_ia"],
    temperature: 0.6,
  },
  custom: {
    type: "custom",
    system_prompt: `Você é um assistente virtual. Defina seu comportamento aqui.

Exemplos de instruções:
- Qual é seu papel
- Quais informações coletar
- Como responder perguntas comuns
- Quando encaminhar para humano`,
    tools: [],
    temperature: 0.7,
  },
};

const availableTools = [
  { id: "atualizar_lead", label: "Atualizar Lead", description: "Salvar dados no CRM" },
  { id: "aplicar_tag", label: "Aplicar Tag", description: "Classificar lead" },
  { id: "mover_etapa", label: "Mover Etapa", description: "Mover no funil" },
  { id: "pausar_ia", label: "Pausar IA", description: "Transferir para humano" },
  { id: "chamar_n8n", label: "Chamar n8n", description: "Executar workflow externo" },
];

const models = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Rápido)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanceado)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Avançado)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (Eficiente)" },
  { id: "openai/gpt-5", label: "GPT-5 (Premium)" },
];

export function CreateAgentDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateAgentDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "sdr",
      system_prompt: "",
      model: "google/gemini-3-flash-preview",
      temperature: 0.7,
      max_tokens: 2048,
      tools: ["atualizar_lead", "aplicar_tag"],
      pause_code: "251213",
      resume_keyword: "Atendimento finalizado",
      message_split_enabled: true,
      message_split_length: 400,
    },
  });

  const applyTemplate = (templateKey: string) => {
    const template = agentTemplates[templateKey];
    if (template) {
      setSelectedTemplate(templateKey);
      Object.entries(template).forEach(([key, value]) => {
        form.setValue(key as keyof FormData, value as any);
      });
    }
  };

  const handleSubmit = (data: FormData) => {
    onSubmit({
      name: data.name,
      description: data.description,
      type: data.type,
      system_prompt: data.system_prompt,
      model: data.model,
      temperature: data.temperature,
      max_tokens: data.max_tokens,
      tools: data.tools,
      pause_code: data.pause_code,
      resume_keyword: data.resume_keyword,
      message_split_enabled: data.message_split_enabled,
      message_split_length: data.message_split_length,
    });
    form.reset();
    setSelectedTemplate(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Criar Agente de IA
          </DialogTitle>
          <DialogDescription>
            Configure um assistente inteligente para atender seus leads automaticamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="template" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="template">Template</TabsTrigger>
                <TabsTrigger value="config">Configuração</TabsTrigger>
                <TabsTrigger value="advanced">Avançado</TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <TemplateCard
                    icon={<MessageSquare className="w-5 h-5" />}
                    title="SDR / Pré-venda"
                    description="Qualifica leads automaticamente"
                    selected={selectedTemplate === "sdr"}
                    onClick={() => applyTemplate("sdr")}
                  />
                  <TemplateCard
                    icon={<Calendar className="w-5 h-5" />}
                    title="Agendamento"
                    description="Marca reuniões automaticamente"
                    selected={selectedTemplate === "scheduler"}
                    onClick={() => applyTemplate("scheduler")}
                  />
                  <TemplateCard
                    icon={<RefreshCw className="w-5 h-5" />}
                    title="Follow-up"
                    description="Reativa leads inativos"
                    selected={selectedTemplate === "followup"}
                    onClick={() => applyTemplate("followup")}
                  />
                  <TemplateCard
                    icon={<DollarSign className="w-5 h-5" />}
                    title="Cobrança"
                    description="Envia lembretes de pagamento"
                    selected={selectedTemplate === "collector"}
                    onClick={() => applyTemplate("collector")}
                  />
                  <TemplateCard
                    icon={<Sparkles className="w-5 h-5" />}
                    title="Personalizado"
                    description="Crie do zero"
                    selected={selectedTemplate === "custom"}
                    onClick={() => applyTemplate("custom")}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Agente</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Atendente Virtual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Responde dúvidas e qualifica leads"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="config" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="system_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prompt do Sistema</FormLabel>
                      <FormDescription>
                        Instruções que definem como o agente deve se comportar
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          placeholder="Você é um assistente..."
                          className="min-h-[200px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tools"
                  render={() => (
                    <FormItem>
                      <FormLabel>Ferramentas Habilitadas</FormLabel>
                      <FormDescription>
                        Ações que o agente pode executar durante a conversa
                      </FormDescription>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {availableTools.map((tool) => (
                          <FormField
                            key={tool.id}
                            control={form.control}
                            name="tools"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0 rounded-lg border p-3">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(tool.id)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([...current, tool.id]);
                                      } else {
                                        field.onChange(
                                          current.filter((v) => v !== tool.id)
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <div className="space-y-0.5">
                                  <FormLabel className="text-sm font-medium cursor-pointer">
                                    {tool.label}
                                  </FormLabel>
                                  <FormDescription className="text-xs">
                                    {tool.description}
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo de IA</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Temperatura: {field.value}
                      </FormLabel>
                      <FormDescription>
                        Controla a criatividade das respostas (0 = preciso, 2 = criativo)
                      </FormDescription>
                      <FormControl>
                        <Slider
                          min={0}
                          max={2}
                          step={0.1}
                          value={[field.value]}
                          onValueChange={(v) => field.onChange(v[0])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pause_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Pausa</FormLabel>
                        <FormDescription>
                          Código para pausar o agente
                        </FormDescription>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="resume_keyword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Palavra para Retomar</FormLabel>
                        <FormDescription>
                          Frase para reativar o agente
                        </FormDescription>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="message_split_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel>Dividir mensagens longas</FormLabel>
                        <FormDescription>
                          Divide respostas em partes menores para WhatsApp
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar Agente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-4 rounded-lg border text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <div className={`mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <h4 className="font-medium text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
