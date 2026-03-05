import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, FolderOpen, Tag, UserRound, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

interface OnStartAction {
  type: "move_stage" | "add_tag" | "remove_tag" | "assign_responsible";
  value: string;
  label: string;
}

const availableTools = [
  { id: "atualizar_lead", label: "Atualizar Lead", description: "Salvar dados coletados no CRM (nome, email, notas, valor)" },
  { id: "aplicar_tag", label: "Aplicar Tag", description: "Classificar o lead com tags automáticas" },
  { id: "mover_etapa", label: "Mover Etapa", description: "Mover o lead para outra etapa do funil" },
  { id: "pausar_ia", label: "Pausar IA", description: "Transferir atendimento para um humano" },
  { id: "chamar_n8n", label: "Chamar Webhook", description: "Executar workflow externo via n8n/webhook" },
  { id: "agendar_followup", label: "Agendar Follow-up", description: "Agendar uma mensagem para ser enviada em um horário específico" },
];

const calendarSubOptions = [
  { id: "cal_agendar", label: "Agendar reunião", description: "Criar novos eventos no calendário" },
  { id: "cal_reagendar", label: "Reagendar reunião", description: "Alterar data/hora de reuniões existentes" },
  { id: "cal_cancelar", label: "Cancelar reunião", description: "Remover reuniões agendadas" },
  { id: "cal_consultar", label: "Consultar disponibilidade", description: "Verificar horários livres no calendário" },
  { id: "cal_lembrete", label: "Enviar lembretes", description: "Enviar lembretes automáticos antes da reunião" },
];

const reminderOptions = [
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "180", label: "3 horas antes" },
  { value: "360", label: "6 horas antes" },
  { value: "720", label: "12 horas antes" },
  { value: "1440", label: "24 horas antes" },
];

const actionTypes = [
  { value: "move_stage", label: "📁 Mover para etapa", icon: FolderOpen },
  { value: "add_tag", label: "🏷️ Adicionar tag", icon: Tag },
  { value: "remove_tag", label: "🏷️ Remover tag", icon: Tag },
  { value: "assign_responsible", label: "👤 Atribuir responsável", icon: UserRound },
];

const actionIcon: Record<string, string> = {
  move_stage: "📁",
  add_tag: "🏷️",
  remove_tag: "🏷️",
  assign_responsible: "👤",
};

const actionVerb: Record<string, string> = {
  move_stage: "Mover para →",
  add_tag: "Adicionar tag →",
  remove_tag: "Remover tag →",
  assign_responsible: "Atribuir →",
};

export function ToolsTab({ formData, updateField }: Props) {
  const tools: string[] = formData.tools || [];
  const onStartActions: OnStartAction[] = formData.on_start_actions || [];
  const { workspaceId } = useWorkspace();

  const [calendarOpen, setCalendarOpen] = useState(true);

  // Calendar sub-config
  const calendarConfig = formData.calendar_config || { permissions: ["cal_agendar", "cal_reagendar", "cal_cancelar", "cal_consultar", "cal_lembrete"], reminders: ["180", "30"] };
  const calendarPermissions: string[] = calendarConfig.permissions || [];
  const calendarReminders: string[] = calendarConfig.reminders || [];

  const updateCalendarConfig = (key: string, value: any) => {
    updateField("calendar_config", { ...calendarConfig, [key]: value });
  };

  const toggleCalendarPermission = (id: string) => {
    const next = calendarPermissions.includes(id)
      ? calendarPermissions.filter((p) => p !== id)
      : [...calendarPermissions, id];
    updateCalendarConfig("permissions", next);
  };

  const toggleReminder = (value: string) => {
    const next = calendarReminders.includes(value)
      ? calendarReminders.filter((r) => r !== value)
      : [...calendarReminders, value];
    updateCalendarConfig("reminders", next);
  };

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [newActionType, setNewActionType] = useState<string>("");
  const [newActionValue, setNewActionValue] = useState<string>("");

  // Fetch stages
  const { data: stages = [] } = useQuery({
    queryKey: ["funnel-stages-for-tools", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("funnel_stages")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("position");
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ["lead-tags-for-tools", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("lead_tags")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name");
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Fetch workspace members
  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members-for-tools", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .not("accepted_at", "is", null);
      if (!data || data.length === 0) return [];
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, user_id")
        .in("user_id", userIds);
      return profiles || [];
    },
    enabled: !!workspaceId,
  });

  const toggleTool = (toolId: string) => {
    const next = tools.includes(toolId) ? tools.filter((t) => t !== toolId) : [...tools, toolId];
    updateField("tools", next);
  };

  const addAction = () => {
    if (!newActionType || !newActionValue) return;
    let label = newActionValue;
    if (newActionType === "move_stage") {
      label = stages.find((s) => s.id === newActionValue)?.name || newActionValue;
    } else if (newActionType === "add_tag" || newActionType === "remove_tag") {
      label = tags.find((t) => t.id === newActionValue)?.name || newActionValue;
    } else if (newActionType === "assign_responsible") {
      label = members.find((m) => m.id === newActionValue)?.full_name || newActionValue;
    }
    const action: OnStartAction = { type: newActionType as OnStartAction["type"], value: newActionValue, label };
    updateField("on_start_actions", [...onStartActions, action]);
    setNewActionType("");
    setNewActionValue("");
    setPopoverOpen(false);
  };

  const removeAction = (index: number) => {
    updateField("on_start_actions", onStartActions.filter((_, i) => i !== index));
  };

  const getValueOptions = () => {
    switch (newActionType) {
      case "move_stage":
        return stages.map((s) => ({ value: s.id, label: s.name }));
      case "add_tag":
      case "remove_tag":
        return tags.map((t) => ({ value: t.id, label: t.name }));
      case "assign_responsible":
        return members.map((m) => ({ value: m.id, label: m.full_name }));
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* On Start Actions */}
      <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
        <div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-0.5">⚡ Ações ao iniciar atendimento</h3>
          <p className="text-sm text-muted-foreground">Executadas automaticamente quando a agente começa a atender um lead.</p>
        </div>

        {onStartActions.length > 0 && (
          <div className="space-y-1.5">
            {onStartActions.map((action, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm">
                <span>{actionIcon[action.type]}</span>
                <span className="text-muted-foreground">{actionVerb[action.type]}</span>
                <span className="font-medium text-foreground">{action.label}</span>
                <button onClick={() => removeAction(i)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar ação
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-3" align="start">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ação</Label>
              <Select value={newActionType} onValueChange={(v) => { setNewActionType(v); setNewActionValue(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {actionTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newActionType && (
              <div className="space-y-1.5">
                <Label className="text-xs">Valor</Label>
                <Select value={newActionValue} onValueChange={setNewActionValue}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {getValueOptions().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button size="sm" className="w-full" disabled={!newActionType || !newActionValue} onClick={addAction}>
              Adicionar
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <Separator />

      {/* Existing tools */}
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Ferramentas</h3>
        <p className="text-sm text-muted-foreground">Ações que a agente pode executar durante a conversa.</p>
      </div>

      <div className="space-y-2">
        {availableTools.map((tool) => (
          <div
            key={tool.id}
            className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <Checkbox checked={tools.includes(tool.id)} onCheckedChange={() => toggleTool(tool.id)} />
            <div className="flex-1">
              <p className="text-sm font-medium">{tool.label}</p>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
          </div>
        ))}

        {/* Calendar tool with sub-options */}
        <Collapsible open={calendarOpen} onOpenChange={setCalendarOpen}>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
              <Checkbox
                checked={tools.includes("gerenciar_calendario")}
                onCheckedChange={() => toggleTool("gerenciar_calendario")}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">📅 Gerenciar Calendário</p>
                <p className="text-xs text-muted-foreground">Agendar, reagendar, cancelar reuniões e enviar lembretes</p>
              </div>
              {tools.includes("gerenciar_calendario") && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <ChevronDown className={`w-4 h-4 transition-transform ${calendarOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>

            {tools.includes("gerenciar_calendario") && (
              <CollapsibleContent>
                <div className="border-t border-border bg-muted/10 p-3 space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissões do agente</Label>
                    <div className="mt-2 space-y-1.5">
                      {calendarSubOptions.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2.5 pl-2 py-1.5">
                          <Checkbox
                            checked={calendarPermissions.includes(sub.id)}
                            onCheckedChange={() => toggleCalendarPermission(sub.id)}
                          />
                          <div>
                            <p className="text-sm">{sub.label}</p>
                            <p className="text-xs text-muted-foreground">{sub.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {calendarPermissions.includes("cal_lembrete") && (
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lembretes automáticos</Label>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-2">Selecione quando os lembretes devem ser enviados</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {reminderOptions.map((opt) => (
                          <div key={opt.value} className="flex items-center gap-2 pl-2 py-1">
                            <Checkbox
                              checked={calendarReminders.includes(opt.value)}
                              onCheckedChange={() => toggleReminder(opt.value)}
                            />
                            <span className="text-sm">{opt.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </div>
        </Collapsible>
      </div>

      <Separator />

      {/* Training mode */}
      <div>
        <h3 className="font-display font-semibold text-foreground mb-1">Modo Treinamento</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Quando o número de treinador enviar mensagens, a agente propõe respostas para aprovação.
        </p>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Número do treinador</Label>
            <Input
              value={formData.trainer_phone || ""}
              onChange={(e) => updateField("trainer_phone", e.target.value)}
              placeholder="Ex: 5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              Sem @s.whatsapp.net — apenas os dígitos do número.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
