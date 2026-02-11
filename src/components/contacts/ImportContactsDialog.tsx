import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

type FieldMapping = {
  name: string;
  phone: string;
  email: string;
  company: string;
};

const BATCH_SIZE = 100;
const FIRST_STAGE_ID = "23bf8b24-38c3-44fa-9afb-9754331333ca";

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === "," || ch === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const obj: ParsedRow = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || "";
    });
    return obj;
  });

  return { headers, rows };
}

export default function ImportContactsDialog({ open, onOpenChange, onImportComplete }: ImportContactsDialogProps) {
  const { workspaceId } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({ name: "", phone: "", email: "", company: "" });
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ imported: 0, duplicates: 0, errors: 0 });

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ name: "", phone: "", email: "", company: "" });
    setProgress(0);
    setResult({ imported: 0, duplicates: 0, errors: 0 });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        toast.error("Arquivo CSV vazio ou inválido");
        return;
      }
      setHeaders(h);
      setRows(r);
      // Auto-map common column names
      const autoMap: FieldMapping = { name: "", phone: "", email: "", company: "" };
      h.forEach((col) => {
        const lower = col.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (/nome|name/.test(lower) && !autoMap.name) autoMap.name = col;
        if (/telefone|phone|celular|fone|whatsapp/.test(lower) && !autoMap.phone) autoMap.phone = col;
        if (/email|e-mail/.test(lower) && !autoMap.email) autoMap.email = col;
        if (/empresa|company|organizacao/.test(lower) && !autoMap.company) autoMap.company = col;
      });
      setMapping(autoMap);
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  const startImport = useCallback(async () => {
    if (!mapping.name || !mapping.phone) {
      toast.error("Mapeie pelo menos Nome e Telefone");
      return;
    }
    setStep("importing");
    setProgress(0);

    // Fetch existing phones for duplicate detection
    const { data: existingLeads } = await supabase.from("leads").select("phone");
    const existingPhones = new Set((existingLeads || []).map((l) => l.phone.replace(/\D/g, "")));

    // Get max position
    const { data: maxPosData } = await supabase
      .from("leads")
      .select("position")
      .eq("stage_id", FIRST_STAGE_ID)
      .order("position", { ascending: false })
      .limit(1);
    let nextPosition = (maxPosData?.[0]?.position ?? -1) + 1;

    const validRows: Array<{
      name: string;
      phone: string;
      email?: string;
      company?: string;
      stage_id: string;
      source: string;
      status: "active";
      position: number;
      workspace_id: string;
    }> = [];
    let duplicates = 0;

    for (const row of rows) {
      const name = row[mapping.name]?.trim();
      const phone = row[mapping.phone]?.trim();
      if (!name || !phone) continue;

      const normalizedPhone = phone.replace(/\D/g, "");
      if (existingPhones.has(normalizedPhone)) {
        duplicates++;
        continue;
      }
      existingPhones.add(normalizedPhone);

      validRows.push({
        name,
        phone,
        email: mapping.email ? row[mapping.email]?.trim() || undefined : undefined,
        company: mapping.company ? row[mapping.company]?.trim() || undefined : undefined,
        stage_id: FIRST_STAGE_ID,
        source: "importacao",
        status: "active",
        position: nextPosition++,
        workspace_id: workspaceId!,
      });
    }

    let imported = 0;
    let errors = 0;
    const total = validRows.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("leads").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / total) * 100));
    }

    setResult({ imported, duplicates, errors });
    setStep("done");
    if (imported > 0) onImportComplete();
  }, [rows, mapping, onImportComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Contatos via CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo CSV com seus contatos."}
            {step === "mapping" && `${rows.length} linhas encontradas. Mapeie as colunas abaixo.`}
            {step === "importing" && "Importando contatos..."}
            {step === "done" && "Importação concluída!"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">Clique para selecionar arquivo CSV</p>
              <p className="text-sm text-muted-foreground mt-1">Suporta até 10.000 contatos</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="rounded-md border overflow-auto max-h-40">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-muted/50">
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {headers.map((h) => (
                        <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column mapping */}
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "name" as const, label: "Nome *" },
                { key: "phone" as const, label: "Telefone *" },
                { key: "email" as const, label: "Email" },
                { key: "company" as const, label: "Empresa" },
              ]).map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Select value={mapping[key]} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v }))}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Selecionar coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nenhuma —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button onClick={startImport} disabled={!mapping.name || !mapping.phone}>
                Importar {rows.length} contatos
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-4">
            <Progress value={progress} className="h-3" />
            <p className="text-center text-sm text-muted-foreground">{progress}% concluído</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">{result.imported} contatos importados</span>
              </div>
              {result.duplicates > 0 && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{result.duplicates} duplicatas ignoradas</span>
                </div>
              )}
              {result.errors > 0 && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{result.errors} erros</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Todos os contatos importados foram adicionados à etapa "Leads de Entrada" do funil.
            </p>
            <Button className="w-full" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
