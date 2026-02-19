import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Target } from "lucide-react";

interface QualField {
  id: string;
  field_type: string;
  label: string;
  question: string;
  required: boolean;
  active: boolean;
  position: number;
}

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const defaultQuestions: Record<string, string> = {
  name: "Antes de começar, pode me dizer seu nome? 😊",
  company: "Ótimo! E qual empresa você representa?",
  role: "Qual seu cargo ou função?",
  phone: "Pode me informar um telefone para contato?",
  email: "E seu e-mail?",
  custom: "",
};

const fieldTypeLabels: Record<string, string> = {
  name: "Nome completo",
  company: "Empresa",
  role: "Cargo/Função",
  phone: "Telefone",
  email: "E-mail",
  custom: "Personalizado",
};

export function QualificationTab({ formData, updateField }: Props) {
  const enabled = formData.qualification_enabled ?? false;
  const fields: QualField[] = formData.qualification_fields || [];

  const addField = () => {
    const newField: QualField = {
      id: crypto.randomUUID(),
      field_type: "custom",
      label: "",
      question: "",
      required: false,
      active: true,
      position: fields.length,
    };
    updateField("qualification_fields", [...fields, newField]);
  };

  const updateQField = (id: string, key: keyof QualField, value: any) => {
    updateField(
      "qualification_fields",
      fields.map((f) => {
        if (f.id !== id) return f;
        const updated = { ...f, [key]: value };
        // auto-fill question when changing field_type
        if (key === "field_type" && defaultQuestions[value]) {
          updated.question = updated.question || defaultQuestions[value];
          updated.label = fieldTypeLabels[value] || "";
        }
        return updated;
      })
    );
  };

  const removeField = (id: string) => {
    updateField("qualification_fields", fields.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Qualificação Inicial</h3>
        <p className="text-sm text-muted-foreground">
          A agente fará estas perguntas em sequência antes de entrar no modo de atendimento livre.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 border border-border rounded-lg bg-muted/30">
        <Switch checked={enabled} onCheckedChange={(v) => updateField("qualification_enabled", v)} />
        <div>
          <Label className="font-medium">Ativar roteiro de qualificação</Label>
          <p className="text-xs text-muted-foreground">Antes de responder livremente, a agente coleta dados importantes.</p>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4">
          {fields.map((field, i) => (
            <div key={field.id} className="p-4 border border-border rounded-lg space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Campo {i + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={field.active} onCheckedChange={(v) => updateQField(field.id, "active", v)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeField(field.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo do campo</Label>
                  <Select value={field.field_type} onValueChange={(v) => updateQField(field.id, "field_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nome completo</SelectItem>
                      <SelectItem value="company">Empresa</SelectItem>
                      <SelectItem value="role">Cargo</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={field.label} onChange={(e) => updateQField(field.id, "label", e.target.value)} placeholder="Nome do campo" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Pergunta que a agente faz</Label>
                <Input value={field.question} onChange={(e) => updateQField(field.id, "question", e.target.value)} placeholder="Ex: Pode me dizer seu nome?" />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={field.required} onCheckedChange={(v) => updateQField(field.id, "required", !!v)} />
                <Label className="text-xs">Obrigatório — a agente insiste até receber resposta</Label>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum campo configurado</p>
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={addField}>
            <Plus className="w-4 h-4" />
            Adicionar campo
          </Button>
        </div>
      )}
    </div>
  );
}
