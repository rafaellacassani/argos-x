import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
  generatePrompt: () => string;
}

export function PersonalityTab({ formData, updateField }: Props) {
  const ci = formData.company_info || {};
  const updateCompanyInfo = (key: string, value: any) => {
    updateField("company_info", { ...ci, [key]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Personalidade do Agente</h3>
        <p className="text-sm text-muted-foreground">Defina quem é sua agente e como ela se comporta.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nome do agente</Label>
          <Input value={formData.name || ""} onChange={(e) => updateField("name", e.target.value)} placeholder="Ex: Julia" />
        </div>
        <div className="space-y-2">
          <Label>Cargo / Função</Label>
          <Input value={formData.agent_role || ""} onChange={(e) => updateField("agent_role", e.target.value)} placeholder="Ex: Consultora de Vendas" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tom de voz</Label>
          <Select value={formData.tone_of_voice || "consultivo"} onValueChange={(v) => updateField("tone_of_voice", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="consultivo">Consultivo</SelectItem>
              <SelectItem value="descontraido">Descontraído</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Objetivo principal</Label>
          <Select value={formData.main_objective || "vender"} onValueChange={(v) => updateField("main_objective", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vender">Vender</SelectItem>
              <SelectItem value="agendar">Agendar</SelectItem>
              <SelectItem value="qualificar">Qualificar lead</SelectItem>
              <SelectItem value="suporte">Suporte</SelectItem>
              <SelectItem value="cobranca">Cobrança</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nicho / Segmento</Label>
          <Input value={formData.niche || ""} onChange={(e) => updateField("niche", e.target.value)} placeholder="Ex: Clínica odontológica" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={formData.use_emojis ?? true} onCheckedChange={(v) => updateField("use_emojis", v)} />
          <Label>Pode usar emojis</Label>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="font-display font-semibold text-foreground mb-1">Informações da Empresa</h3>
        <p className="text-sm text-muted-foreground mb-4">Usadas automaticamente no contexto da agente.</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input value={ci.name || ""} onChange={(e) => updateCompanyInfo("name", e.target.value)} placeholder="Ex: ArgoX" />
          </div>
          <div className="space-y-2">
            <Label>Instagram</Label>
            <Input value={ci.instagram || ""} onChange={(e) => updateCompanyInfo("instagram", e.target.value)} placeholder="@empresa" />
          </div>
          <div className="space-y-2">
            <Label>Site</Label>
            <Input value={ci.site || ""} onChange={(e) => updateCompanyInfo("site", e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Telefone de contato</Label>
            <Input value={ci.phone || ""} onChange={(e) => updateCompanyInfo("phone", e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={ci.email || ""} onChange={(e) => updateCompanyInfo("email", e.target.value)} placeholder="contato@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={ci.address || ""} onChange={(e) => updateCompanyInfo("address", e.target.value)} placeholder="Rua..." disabled={ci.is_digital} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Checkbox checked={ci.is_digital || false} onCheckedChange={(v) => updateCompanyInfo("is_digital", !!v)} />
          <Label className="text-sm">Negócio 100% digital — sem endereço físico</Label>
        </div>
      </div>
    </div>
  );
}
