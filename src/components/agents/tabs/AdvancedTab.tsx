import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const models = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Rápido)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Balanceado)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Avançado)" },
  { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro (Próx. Geração)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini (Eficiente)" },
  { id: "openai/gpt-5", label: "GPT-5 (Premium)" },
  { id: "openai/gpt-5.2", label: "GPT-5.2 (Último)" },
];

export function AdvancedTab({ formData, updateField }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Configurações Avançadas</h3>
        <p className="text-sm text-muted-foreground">Parâmetros técnicos do modelo de IA.</p>
      </div>

      <div className="space-y-2">
        <Label>Modelo de IA</Label>
        <Select value={formData.model || "google/gemini-3-flash-preview"} onValueChange={(v) => updateField("model", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
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

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>System Prompt (manual)</Label>
          <div className="flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs">Editar aqui sobrescreve a geração automática da aba Personalidade</span>
          </div>
        </div>
        <Textarea
          value={formData.system_prompt || ""}
          onChange={(e) => updateField("system_prompt", e.target.value)}
          placeholder="O prompt será gerado automaticamente a partir da aba Personalidade..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>
    </div>
  );
}
