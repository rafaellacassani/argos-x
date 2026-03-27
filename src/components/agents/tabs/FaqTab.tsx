import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, HelpCircle, ImagePlus, Video, FileText, X, Loader2, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface FaqAttachment {
  url: string;
  type: "image" | "video" | "pdf";
  fileName: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  attachments?: FaqAttachment[];
}

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const ACCEPTED: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/3gpp",
  pdf: "application/pdf",
};

export function FaqTab({ formData, updateField }: Props) {
  const faqs: FaqItem[] = formData.knowledge_faq || [];
  const { workspaceId } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingFaqId, setUploadingFaqId] = useState<string | null>(null);

  const addFaq = () => {
    if (faqs.length >= 50) return;
    const newFaq: FaqItem = {
      id: crypto.randomUUID(),
      question: "",
      answer: "",
      attachments: [],
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

  const handleAttachUpload = (faqId: string, type: "image" | "video" | "pdf") => {
    if (!fileRef.current) return;
    fileRef.current.accept = ACCEPTED[type];
    fileRef.current.dataset.faqId = faqId;
    fileRef.current.dataset.attachType = type;
    fileRef.current.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const faqId = e.target.dataset.faqId;
    const attachType = e.target.dataset.attachType as "image" | "video" | "pdf";
    if (!file || !faqId || !attachType || !workspaceId) return;

    setUploadingFaqId(faqId);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${workspaceId}/faq/${faqId}/${Date.now()}.${ext}`;

      // Use agent-attachments bucket (already exists)
      const { error } = await supabase.storage.from("agent-attachments").upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("agent-attachments").getPublicUrl(path);

      const newAttachment: FaqAttachment = {
        url: urlData.publicUrl,
        type: attachType,
        fileName: file.name,
      };

      updateField(
        "knowledge_faq",
        faqs.map((f) =>
          f.id === faqId
            ? { ...f, attachments: [...(f.attachments || []), newAttachment] }
            : f
        )
      );
    } catch (err) {
      console.error("FAQ attachment upload error:", err);
    } finally {
      setUploadingFaqId(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (faqId: string, index: number) => {
    updateField(
      "knowledge_faq",
      faqs.map((f) =>
        f.id === faqId
          ? { ...f, attachments: (f.attachments || []).filter((_, i) => i !== index) }
          : f
      )
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Hidden file input */}
      <input ref={fileRef} type="file" className="hidden" onChange={onFileSelected} />

      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">FAQ — Perguntas Frequentes</h3>
        <p className="text-sm text-muted-foreground">
          Cadastre as perguntas que seus clientes mais fazem. A IA consulta estas respostas automaticamente durante a conversa. Seja direto e objetivo em cada resposta.
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

            {/* Attachments preview */}
            {(faq.attachments || []).length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Anexos</Label>
                <div className="flex flex-wrap gap-2">
                  {(faq.attachments || []).map((att, idx) => (
                    <div key={idx} className="relative group border rounded p-1.5 bg-background flex items-center gap-1.5 max-w-[200px]">
                      {att.type === "image" && (
                        <img src={att.url} alt="" className="w-10 h-10 object-cover rounded" />
                      )}
                      {att.type === "video" && <Video className="w-4 h-4 text-muted-foreground shrink-0" />}
                      {att.type === "pdf" && <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="text-[10px] truncate">{att.fileName}</span>
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAttachment(faq.id, idx)}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attachment buttons */}
            <div className="flex items-center gap-1 pt-1">
              <span className="text-[10px] text-muted-foreground mr-1">Anexar:</span>
              <button
                type="button"
                className="flex items-center gap-0.5 text-[10px] text-primary hover:underline disabled:opacity-50"
                onClick={() => handleAttachUpload(faq.id, "image")}
                disabled={uploadingFaqId === faq.id}
              >
                <ImagePlus className="w-3 h-3" /> Imagem
              </button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <button
                type="button"
                className="flex items-center gap-0.5 text-[10px] text-primary hover:underline disabled:opacity-50"
                onClick={() => handleAttachUpload(faq.id, "video")}
                disabled={uploadingFaqId === faq.id}
              >
                <Video className="w-3 h-3" /> Vídeo
              </button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <button
                type="button"
                className="flex items-center gap-0.5 text-[10px] text-primary hover:underline disabled:opacity-50"
                onClick={() => handleAttachUpload(faq.id, "pdf")}
                disabled={uploadingFaqId === faq.id}
              >
                <FileText className="w-3 h-3" /> PDF
              </button>
              {uploadingFaqId === faq.id && <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />}
            </div>
          </div>
        ))}

        {faqs.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-lg p-5 space-y-4">
            <div className="text-center">
              <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma pergunta cadastrada</p>
              <p className="text-xs text-muted-foreground">Veja alguns exemplos de como preencher:</p>
            </div>
            <div className="space-y-3">
              {[
                { q: "Qual o horário de atendimento?", a: "Atendemos de segunda a sexta, das 9h às 18h. Fora deste horário, a IA responde normalmente." },
                { q: "Vocês fazem entrega?", a: "Sim! Entregamos em toda a cidade em até 2 dias úteis." },
                { q: "Como faço para agendar?", a: "É só me dizer o serviço que você quer e eu verifico os horários disponíveis para você." },
              ].map((ex, i) => (
                <div key={i} className="p-3 bg-muted/40 rounded-md border border-border/50 opacity-70">
                  <p className="text-xs font-semibold text-muted-foreground">P: {ex.q}</p>
                  <p className="text-xs text-muted-foreground mt-1">R: {ex.a}</p>
                </div>
              ))}
            </div>
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
