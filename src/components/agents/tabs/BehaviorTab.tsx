import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Zap, Clock, Timer, Hourglass, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export function BehaviorTab({ formData, updateField }: Props) {
  const { workspaceId } = useWorkspace();
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [instances, setInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("funnel_stages").select("id, name").eq("workspace_id", workspaceId).then(({ data }) => {
      if (data) setStages(data);
    });
    supabase.from("whatsapp_instances").select("instance_name, display_name").eq("workspace_id", workspaceId).neq("instance_type", "alerts").then(({ data }) => {
      if (data) setInstances(data);
    });
  }, [workspaceId]);

  const selectedStages: string[] = formData.respond_to_stages || [];
  const toggleStage = (stageId: string) => {
    const next = selectedStages.includes(stageId) ? selectedStages.filter((s) => s !== stageId) : [...selectedStages, stageId];
    updateField("respond_to_stages", next);
  };

  const delayOptions = [
    { value: 0, label: "Imediato", icon: Zap, desc: "Resposta instantânea" },
    { value: 30, label: "~30s", icon: Clock, desc: "Pequeno atraso" },
    { value: 60, label: "~1 min", icon: Timer, desc: "Atraso moderado" },
    { value: 120, label: "~2 min", icon: Hourglass, desc: "Atraso natural" },
    { value: -1, label: "Aleatório", icon: Shuffle, desc: "Parece mais humano" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Comportamento</h3>
        <p className="text-sm text-muted-foreground">Configure quando e como a agente responde.</p>
      </div>

      {/* Who to respond */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Quem ela responde</Label>
        <RadioGroup value={formData.respond_to || "all"} onValueChange={(v) => updateField("respond_to", v)}>
          <div className="flex items-center gap-2"><RadioGroupItem value="all" id="rt-all" /><Label htmlFor="rt-all">Todos os contatos</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="new_leads" id="rt-new" /><Label htmlFor="rt-new">Apenas novos leads (primeiro contato)</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="specific_stages" id="rt-stages" /><Label htmlFor="rt-stages">Leads em etapas específicas</Label></div>
        </RadioGroup>
        {formData.respond_to === "specific_stages" && (
          <div className="ml-6 space-y-2 p-3 border border-border rounded-lg bg-muted/30">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-2">
                <Checkbox checked={selectedStages.includes(stage.id)} onCheckedChange={() => toggleStage(stage.id)} />
                <Label className="text-sm">{stage.name}</Label>
              </div>
            ))}
            {stages.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma etapa encontrada.</p>}
          </div>
        )}
      </div>

      <Separator />

      {/* Response delay */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Tempo de resposta</Label>
        <p className="text-xs text-muted-foreground">Respostas com pequeno atraso parecem mais naturais e humanas.</p>
        <div className="grid grid-cols-5 gap-2">
          {delayOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = formData.response_delay_seconds === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateField("response_delay_seconds", opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors",
                  selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Response length */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Tamanho das respostas</Label>
        <RadioGroup value={formData.response_length || "medium"} onValueChange={(v) => updateField("response_length", v)}>
          <div className="flex items-center gap-2"><RadioGroupItem value="short" id="rl-short" /><Label htmlFor="rl-short">Curta (1-2 frases) — Direto ao ponto</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="medium" id="rl-med" /><Label htmlFor="rl-med">Média (1 parágrafo) — Equilibrado</Label></div>
          <div className="flex items-center gap-2"><RadioGroupItem value="long" id="rl-long" /><Label htmlFor="rl-long">Longa (detalhada) — Completo e explicativo</Label></div>
        </RadioGroup>
      </div>

      <Separator />

      {/* WhatsApp instance */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Instância WhatsApp</Label>
        <Select value={formData.instance_name || ""} onValueChange={(v) => updateField("instance_name", v === "__all__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Todas as instâncias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as instâncias</SelectItem>
            {instances.map((inst) => (
              <SelectItem key={inst.instance_name} value={inst.instance_name}>
                {inst.display_name || inst.instance_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Pause controls */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Controle de Pausa</Label>
        <p className="text-xs text-muted-foreground">O vendedor pode digitar o código na conversa para assumir o atendimento.</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Código de pausa</Label>
            <Input value={formData.pause_code || ""} onChange={(e) => updateField("pause_code", e.target.value)} placeholder="251213" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Palavra para retomar</Label>
            <Input value={formData.resume_keyword || ""} onChange={(e) => updateField("resume_keyword", e.target.value)} placeholder="Atendimento finalizado" />
          </div>
        </div>
      </div>
    </div>
  );
}
