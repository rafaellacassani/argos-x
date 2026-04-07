import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  creating: boolean;
  createTemplate: (connectionId: string, data: any) => Promise<any>;
}

export default function CreateTemplateDialog({ open, onOpenChange, connectionId, creating, createTemplate }: Props) {
  const [tplName, setTplName] = useState("");
  const [tplLanguage, setTplLanguage] = useState("pt_BR");
  const [tplCategory, setTplCategory] = useState("MARKETING");
  const [tplHeaderText, setTplHeaderText] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplFooter, setTplFooter] = useState("");
  const [tplButtons, setTplButtons] = useState<{ type: string; text: string; url?: string; phone_number?: string }[]>([]);

  const sanitizedName = tplName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  const resetForm = () => {
    setTplName("");
    setTplLanguage("pt_BR");
    setTplCategory("MARKETING");
    setTplHeaderText("");
    setTplBody("");
    setTplFooter("");
    setTplButtons([]);
  };

  const handleCreate = async () => {
    if (!connectionId || !tplName.trim() || !tplBody.trim()) return;

    const components: any[] = [];
    if (tplHeaderText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: tplHeaderText.trim() });
    }
    components.push({ type: "BODY", text: tplBody.trim() });
    if (tplFooter.trim()) {
      components.push({ type: "FOOTER", text: tplFooter.trim() });
    }
    if (tplButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: tplButtons.map((btn) => {
          if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.url };
          if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
          return { type: "QUICK_REPLY", text: btn.text };
        }),
      });
    }

    const result = await createTemplate(connectionId, {
      name: tplName.trim(),
      language: tplLanguage,
      category: tplCategory,
      components,
    });

    if (result) {
      onOpenChange(false);
      resetForm();
    }
  };

  const addButton = (type: string) => {
    if (tplButtons.length >= 3) return;
    setTplButtons([...tplButtons, { type, text: "", url: "", phone_number: "" }]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    setTplButtons(tplButtons.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeButton = (index: number) => {
    setTplButtons(tplButtons.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Template WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="ex: boas_vindas_cliente" />
              {tplName && (
                <p className="text-xs text-muted-foreground">
                  Nome final: <code className="bg-muted px-1 rounded">{sanitizedName}</code>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={tplLanguage} onValueChange={setTplLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={tplCategory} onValueChange={setTplCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">Marketing</SelectItem>
                <SelectItem value="UTILITY">Utilidade</SelectItem>
                <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cabeçalho (opcional)</Label>
            <Input value={tplHeaderText} onChange={(e) => setTplHeaderText(e.target.value)} placeholder="Texto do cabeçalho" />
          </div>

          <div className="space-y-2">
            <Label>Corpo da mensagem *</Label>
            <Textarea
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              placeholder={"Olá {{1}}, tudo bem?\n\nSomos da {{2}} e gostaríamos de..."}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas
            </p>
          </div>

          <div className="space-y-2">
            <Label>Rodapé (opcional)</Label>
            <Input value={tplFooter} onChange={(e) => setTplFooter(e.target.value)} placeholder="Responda SAIR para não receber mais mensagens" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Botões (opcional, máx. 3)</Label>
              {tplButtons.length < 3 && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("QUICK_REPLY")}>+ Resposta rápida</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("URL")}>+ Link</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => addButton("PHONE_NUMBER")}>+ Telefone</Button>
                </div>
              )}
            </div>
            {tplButtons.map((btn, i) => (
              <div key={i} className="flex gap-2 items-start p-2 border rounded-md">
                <div className="flex-1 space-y-1">
                  <div className="flex gap-2 items-center">
                    <Badge variant="secondary" className="text-[10px]">
                      {btn.type === "QUICK_REPLY" ? "Resposta" : btn.type === "URL" ? "Link" : "Telefone"}
                    </Badge>
                    <Input value={btn.text} onChange={(e) => updateButton(i, "text", e.target.value)} placeholder="Texto do botão" className="h-8 text-sm" />
                  </div>
                  {btn.type === "URL" && (
                    <Input value={btn.url || ""} onChange={(e) => updateButton(i, "url", e.target.value)} placeholder="https://..." className="h-8 text-sm" />
                  )}
                  {btn.type === "PHONE_NUMBER" && (
                    <Input value={btn.phone_number || ""} onChange={(e) => updateButton(i, "phone_number", e.target.value)} placeholder="+5511999999999" className="h-8 text-sm" />
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeButton(i)}>
                  <XCircle className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {tplBody && (
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="max-w-xs bg-[#dcf8c6] rounded-lg p-3 text-sm text-[#111] space-y-1 border">
                {tplHeaderText && <p className="font-bold text-xs">{tplHeaderText}</p>}
                <p className="whitespace-pre-wrap">{tplBody}</p>
                {tplFooter && <p className="text-[11px] text-gray-500">{tplFooter}</p>}
                {tplButtons.length > 0 && (
                  <div className="pt-1 space-y-1 border-t mt-1">
                    {tplButtons.map((btn, i) => (
                      <div key={i} className="text-center text-xs text-blue-600 font-medium py-1 border rounded bg-white/50">
                        {btn.text || "..."}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={creating || !tplName.trim() || !tplBody.trim()}>
            {creating ? "Criando..." : "Criar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
