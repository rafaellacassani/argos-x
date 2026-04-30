import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Plug, GraduationCap, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function formatPhoneDisplay(digits: string): string {
  const d = normalizePhone(digits);
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function ConnectionTab({ formData, updateField }: Props) {
  const { workspaceId } = useWorkspace();
  const [instances, setInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);
  const [cloudConnections, setCloudConnections] = useState<{ id: string; inbox_name: string; phone_number: string; phone_number_id: string }[]>([]);
  const [newTrainer, setNewTrainer] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("whatsapp_instances").select("instance_name, display_name").eq("workspace_id", workspaceId).neq("instance_type", "alerts").then(({ data }) => {
      if (data) setInstances(data);
    });
    supabase.from("whatsapp_cloud_connections").select("id, inbox_name, phone_number, phone_number_id").eq("workspace_id", workspaceId).eq("is_active", true).then(({ data }) => {
      if (data) setCloudConnections(data);
    });
  }, [workspaceId]);

  const trainerPhones: string[] = Array.isArray(formData.trainer_phones) ? formData.trainer_phones : [];

  const addTrainer = () => {
    const digits = normalizePhone(newTrainer);
    if (digits.length < 10) return;
    if (trainerPhones.includes(digits)) {
      setNewTrainer("");
      return;
    }
    updateField("trainer_phones", [...trainerPhones, digits]);
    setNewTrainer("");
  };

  const removeTrainer = (digits: string) => {
    updateField("trainer_phones", trainerPhones.filter((p) => p !== digits));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Conexão</h3>
        <p className="text-sm text-muted-foreground">Defina qual instância WhatsApp este agente utilizará.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Escolha o número de WhatsApp que irá responder</Label>
        <Select value={formData.instance_name || ""} onValueChange={(v) => updateField("instance_name", v === "__all__" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Todas as instâncias" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as instâncias</SelectItem>
            {instances.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">📱 Evolution API</div>
                {instances.map((inst) => (
                  <SelectItem key={inst.instance_name} value={inst.instance_name}>
                    {inst.display_name || inst.instance_name}
                  </SelectItem>
                ))}
              </>
            )}
            {cloudConnections.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">☁️ Cloud API</div>
                {cloudConnections.map((conn) => (
                  <SelectItem key={conn.id} value={`cloud_${conn.phone_number_id}`}>
                    {conn.inbox_name} ({conn.phone_number})
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {(formData.instance_name?.startsWith("cloud_") || (!formData.instance_name && cloudConnections.length > 0)) && (
        <>
          <Separator />
          <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <ShieldAlert className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Respeitar janela de 24h (Cloud API)</Label>
                <Switch
                  checked={formData.cloud_24h_window_only ?? true}
                  onCheckedChange={(v) => updateField("cloud_24h_window_only", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A Meta permite envio de mensagens apenas dentro de 24h após a última mensagem do cliente.
                Com esta opção ativa, o agente e os follow-ups automáticos respeitam essa janela.
              </p>
            </div>
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-3 p-4 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Label className="text-sm font-semibold">Modo Treinador — números liberados para testar a IA</Label>
            <p className="text-xs text-muted-foreground">
              Cadastre números de WhatsApp (geralmente seu próprio celular) que <strong>nunca</strong> serão bloqueados ao conversar com este agente.
              A IA sempre responde para esses números, mesmo se a conta estiver vencida, com pausa ativa, com limite mensal estourado ou fora da janela de 24h.
              Use para testar e treinar a IA sem restrições. Inclua DDI + DDD + número (ex: 5511999999999).
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Ex: 5511999999999"
            value={newTrainer}
            onChange={(e) => setNewTrainer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTrainer();
              }
            }}
            inputMode="tel"
          />
          <Button type="button" onClick={addTrainer} variant="secondary" disabled={normalizePhone(newTrainer).length < 10}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        {trainerPhones.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {trainerPhones.map((digits) => (
              <div
                key={digits}
                className="inline-flex items-center gap-2 rounded-full bg-background border border-border px-3 py-1 text-sm"
              >
                <span className="font-mono">{formatPhoneDisplay(digits)}</span>
                <button
                  type="button"
                  onClick={() => removeTrainer(digits)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhum número de treinador cadastrado.</p>
        )}
      </div>
    </div>
  );
}
