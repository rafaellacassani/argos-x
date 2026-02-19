import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const availableTools = [
  { id: "atualizar_lead", label: "Atualizar Lead", description: "Salvar dados coletados no CRM (nome, email, notas, valor)" },
  { id: "aplicar_tag", label: "Aplicar Tag", description: "Classificar o lead com tags automáticas" },
  { id: "mover_etapa", label: "Mover Etapa", description: "Mover o lead para outra etapa do funil" },
  { id: "pausar_ia", label: "Pausar IA", description: "Transferir atendimento para um humano" },
  { id: "chamar_n8n", label: "Chamar Webhook", description: "Executar workflow externo via n8n/webhook" },
];

export function ToolsTab({ formData, updateField }: Props) {
  const tools: string[] = formData.tools || [];

  const toggleTool = (toolId: string) => {
    const next = tools.includes(toolId) ? tools.filter((t) => t !== toolId) : [...tools, toolId];
    updateField("tools", next);
  };

  return (
    <div className="space-y-6 max-w-2xl">
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
