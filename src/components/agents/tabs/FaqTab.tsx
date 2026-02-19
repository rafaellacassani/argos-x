import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, HelpCircle } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export function FaqTab({ formData, updateField }: Props) {
  const faqs: FaqItem[] = formData.knowledge_faq || [];

  const addFaq = () => {
    if (faqs.length >= 50) return;
    const newFaq: FaqItem = {
      id: crypto.randomUUID(),
      question: "",
      answer: "",
    };
    updateField("knowledge_faq", [...faqs, newFaq]);
  };

  const updateFaq = (id: string, field: "question" | "answer", value: string) => {
    updateField(
      "knowledge_faq",
      faqs.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const removeFaq = (id: string) => {
    updateField("knowledge_faq", faqs.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">FAQ — Perguntas Frequentes</h3>
        <p className="text-sm text-muted-foreground">
          A agente consulta este FAQ automaticamente quando detecta perguntas similares.
        </p>
        <p className="text-xs text-muted-foreground mt-1">{faqs.length}/50 perguntas cadastradas</p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={faq.id} className="p-4 border border-border rounded-lg space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Pergunta {i + 1}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFaq(faq.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pergunta</Label>
              <Input
                value={faq.question}
                onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                placeholder="Ex: Como funciona o atendimento?"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Resposta</Label>
              <Textarea
                value={faq.answer}
                onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                placeholder="Resposta completa para esta pergunta..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">Nenhuma pergunta cadastrada</p>
            <p className="text-xs text-muted-foreground mb-4">Adicione perguntas frequentes para que a agente responda melhor.</p>
          </div>
        )}

        <Button variant="outline" className="w-full gap-2" onClick={addFaq} disabled={faqs.length >= 50}>
          <Plus className="w-4 h-4" />
          Adicionar pergunta
        </Button>
      </div>
    </div>
  );
}
