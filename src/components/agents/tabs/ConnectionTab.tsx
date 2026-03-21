import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export function ConnectionTab({ formData, updateField }: Props) {
  const { workspaceId } = useWorkspace();
  const [instances, setInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);
  const [cloudConnections, setCloudConnections] = useState<{ id: string; inbox_name: string; phone_number: string; phone_number_id: string }[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from("whatsapp_instances").select("instance_name, display_name").eq("workspace_id", workspaceId).neq("instance_type", "alerts").then(({ data }) => {
      if (data) setInstances(data);
    });
    supabase.from("whatsapp_cloud_connections").select("id, inbox_name, phone_number, phone_number_id").eq("workspace_id", workspaceId).eq("is_active", true).then(({ data }) => {
      if (data) setCloudConnections(data);
    });
  }, [workspaceId]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Conexão</h3>
        <p className="text-sm text-muted-foreground">Defina qual instância WhatsApp este agente utilizará.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Instância WhatsApp</Label>
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
    </div>
  );
}
