import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, RefreshCw, Flag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

interface FollowupStep {
  id: string;
  delay_value: number;
  delay_unit: "minutes" | "hours" | "days";
  position: number;
}

const unitLabels: Record<string, string> = {
  minutes: "Minutos",
  hours: "Horas",
  days: "Dias",
};

export function FollowupTab({ formData, updateField }: Props) {
  const enabled: boolean = formData.followup_enabled ?? false;
  const sequence: FollowupStep[] = formData.followup_sequence || [];
  const endStageId: string = formData.followup_end_stage_id || "";
  const { workspaceId } = useWorkspace();

  const { data: stages = [] } = useQuery({
    queryKey: ["funnel-stages-followup", workspaceId],
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

  const addStep = () => {
    if (sequence.length >= 5) return;
    const step: FollowupStep = {
      id: crypto.randomUUID(),
      delay_value: sequence.length === 0 ? 30 : sequence.length === 1 ? 1 : 3,
      delay_unit: sequence.length === 0 ? "minutes" : "days",
      position: sequence.length,
    };
    updateField("followup_sequence", [...sequence, step]);
  };

  const removeStep = (id: string) => {
    if (sequence.length <= 1) return;
    updateField(
      "followup_sequence",
      sequence.filter((s) => s.id !== id).map((s, i) => ({ ...s, position: i }))
    );
  };

  const updateStep = (id: string, key: keyof FollowupStep, value: any) => {
    updateField(
      "followup_sequence",
      sequence.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-lg text-foreground">📅 Follow-up Automático</h3>
          <p className="text-sm text-muted-foreground">A agente tenta recontatar o lead se ele parar de responder.</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            updateField("followup_enabled", v);
            if (v && sequence.length === 0) addStep();
          }}
        />
      </div>

      {enabled && (
        <div className="space-y-0">
          {/* Timeline */}
          {sequence.map((step, idx) => (
            <div key={step.id}>
              {/* Step card */}
              <div className="border border-border rounded-xl p-4 bg-background relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    Tentativa {idx + 1}
                  </div>
                  {sequence.length > 1 && (
                    <button
                      onClick={() => removeStep(step.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Enviar após</span>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={step.delay_value}
                    onChange={(e) => updateStep(step.id, "delay_value", Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
                    className="w-20 h-8 text-center"
                  />
                  <Select value={step.delay_unit} onValueChange={(v) => updateStep(step.id, "delay_unit", v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">sem resposta</span>
                </div>

                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  💬 A IA criará uma mensagem criativa de reativação automaticamente
                </p>
              </div>

              {/* Connector line */}
              <div className="flex justify-center">
                <div className="w-px h-6 bg-border" />
              </div>
              <div className="flex justify-center -mt-1 mb-1">
                <span className="text-muted-foreground text-xs">▼</span>
              </div>
            </div>
          ))}

          {/* Add step button */}
          {sequence.length < 5 && (
            <>
              <div className="flex justify-center mb-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={addStep}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar tentativa
                </Button>
              </div>
              <div className="flex justify-center">
                <div className="w-px h-4 border-l-2 border-dashed border-border" />
              </div>
              <div className="flex justify-center -mt-1 mb-1">
                <span className="text-muted-foreground text-xs">▼</span>
              </div>
            </>
          )}

          {/* End card */}
          <div className="border border-dashed border-border rounded-xl p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">🏁 Sem resposta — encerrar</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mover lead para:</Label>
              <Select value={endStageId} onValueChange={(v) => updateField("followup_end_stage_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa final (ex: No Show)" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
