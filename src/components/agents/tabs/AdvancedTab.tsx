import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Lock } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

interface AdvancedTabProps extends Props {
  isAdminViewing?: boolean;
}

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const baseModels = [
  { id: "openai/gpt-4o-mini", label: "⭐ GPT-4o Mini (Recomendado)", minPlan: null },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (Avançado)", minPlan: null },
  { id: "openai/gpt-5-nano", label: "GPT-5 Nano (Econômico)", minPlan: null },
  { id: "openai/gpt-5", label: "GPT-5 (Premium)", minPlan: null },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Plano Escala)", minPlan: "escala" },
  { id: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Plano Escala)", minPlan: "escala" },
];

export function AdvancedTab({ formData, updateField }: Props) {
  const { workspace, isAdminViewing } = useWorkspace();
  const planType = workspace?.plan_type || "gratuito";
  const isEscala = planType === "escala";

  const availableModels = baseModels.filter(m => !m.minPlan || isEscala);
  const lockedModels = baseModels.filter(m => m.minPlan && !isEscala);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Configurações Avançadas</h3>
        <p className="text-sm text-muted-foreground">Parâmetros técnicos do modelo de IA.</p>
      </div>

      <div className="space-y-2">
        <Label>Modelo de IA</Label>
        <Select value={formData.model || "openai/gpt-4o-mini"} onValueChange={(v) => updateField("model", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
            {lockedModels.map((m) => (
              <SelectItem key={m.id} value={m.id} disabled className="opacity-50">
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" />{m.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Temperatura: {formData.temperature ?? 0.7}</Label>
        <p className="text-xs text-muted-foreground">Controla a criatividade (0 = preciso, 2 = criativo)</p>
        <Slider
          min={0} max={2} step={0.1}
          value={[formData.temperature ?? 0.7]}
          onValueChange={(v) => updateField("temperature", v[0])}
        />
      </div>

      <div className="space-y-2">
        <Label>Max tokens</Label>
        <Input
          type="number"
          value={formData.max_tokens ?? 2048}
          onChange={(e) => updateField("max_tokens", parseInt(e.target.value) || 2048)}
          min={100} max={8000}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={formData.media_handoff_enabled ?? false} onCheckedChange={(v) => updateField("media_handoff_enabled", v)} />
          <div>
            <Label>Encaminhar imagens e vídeos para suporte</Label>
            <p className="text-xs text-muted-foreground">Quando alguém enviar foto ou vídeo, a IA para e encaminha para atendimento humano (economiza tokens)</p>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={formData.message_split_enabled ?? true} onCheckedChange={(v) => updateField("message_split_enabled", v)} />
          <div>
            <Label>Dividir mensagens longas</Label>
            <p className="text-xs text-muted-foreground">Quebra respostas grandes em mensagens menores</p>
          </div>
        </div>
        {formData.message_split_enabled && (
          <div className="ml-12 space-y-2">
            <Label className="text-xs">Tamanho máximo por mensagem</Label>
            <Input
              type="number"
              value={formData.message_split_length ?? 400}
              onChange={(e) => updateField("message_split_length", parseInt(e.target.value) || 400)}
              min={100} max={1000}
            />
          </div>
        )}
      </div>

      {isAdminViewing && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>System Prompt (manual)</Label>
              <div className="flex items-center gap-1 text-warning">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-xs">Atenção: se você preencher este campo, as configurações de Nome, Tom de Voz e Objetivo da aba Personalidade serão ignoradas pelo sistema.</span>
              </div>
            </div>
            <Textarea
              value={formData.system_prompt || ""}
              onChange={(e) => updateField("system_prompt", e.target.value)}
              placeholder="O prompt será gerado automaticamente a partir da aba Personalidade..."
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
