import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";

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

const BATCH_SIZE = 500;

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
  const { currentLeadCount, totalLeadLimit, canAddLead, refetch: refetchPlan } = usePlanLimits();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "mapping" | "limit_warning" | "importing" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({ name: "", phone: "", email: "", company: "" });
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState({ imported: 0, duplicates: 0, errors: 0 });
  const [firstStageId, setFirstStageId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [importLimit, setImportLimit] = useState<number | null>(null);

  // Fetch first stage and tags dynamically when dialog opens
  useEffect(() => {
    if (!open || !workspaceId) return;
    const fetchFirstStage = async () => {
      const { data } = await supabase
        .from("funnel_stages")
        .select("id")
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .limit(1)
        .single();
      setFirstStageId(data?.id ?? null);
    };
    const fetchTags = async () => {
      const { data } = await supabase
        .from("lead_tags")
        .select("id, name, color")
        .eq("workspace_id", workspaceId)
        .order("name");
      setAvailableTags(data ?? []);
    };
    fetchFirstStage();
    fetchTags();
  }, [open, workspaceId]);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({ name: "", phone: "", email: "", company: "" });
    setProgress(0);
    setResult({ imported: 0, duplicates: 0, errors: 0 });
    setSelectedTagId("");
    setNewTagName("");
    setImportLimit(null);
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

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !workspaceId) return;
    setCreatingTag(true);
    const colors = ["#3B82F6", "#EF4444", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899", "#F97316"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data, error } = await supabase
      .from("lead_tags")
      .insert({ name: newTagName.trim(), color, workspace_id: workspaceId })
      .select("id, name, color")
      .single();
    if (error) {
      toast.error("Erro ao criar tag");
    } else if (data) {
      setAvailableTags(prev => [...prev, data]);
      setSelectedTagId(data.id);
      setNewTagName("");
      toast.success(`Tag "${data.name}" criada`);
    }
    setCreatingTag(false);
  };

  const handleStartImport = useCallback(() => {
    if (!mapping.name || !mapping.phone) {
      toast.error("Mapeie pelo menos Nome e Telefone");
      return;
    }
    if (!firstStageId) {
      toast.error("Crie um funil antes de importar contatos.");
      return;
    }

    // Count valid rows first
    const seenPhones = new Set<string>();
    let validCount = 0;
    for (const row of rows) {
      const name = row[mapping.name]?.trim();
      const phone = row[mapping.phone]?.trim();
      if (!name || !phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      validCount++;
    }

    const available = totalLeadLimit - currentLeadCount;
    if (available <= 0 && !canAddLead) {
      toast.error("Limite de leads atingido. Acesse Planos para adicionar mais.");
      return;
    }
    if (validCount > available && available > 0) {
      setImportLimit(available);
      setStep("limit_warning");
      return;
    }

    startImport();
  }, [mapping, firstStageId, rows, totalLeadLimit, currentLeadCount, canAddLead]);

  const startImport = useCallback(async (maxRows?: number) => {
    if (!mapping.name || !mapping.phone) return;
    if (!firstStageId) return;
    setStep("importing");
    setProgress(0);

    // Build valid rows without loading existing leads into memory
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

    const seenPhones = new Set<string>();
    let nextPosition = 0;

    for (const row of rows) {
      const name = row[mapping.name]?.trim();
      const phone = row[mapping.phone]?.trim();
      if (!name || !phone) continue;

      // Deduplicate within the CSV itself
      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);

      validRows.push({
        name,
        phone,
        email: mapping.email ? row[mapping.email]?.trim() || undefined : undefined,
        company: mapping.company ? row[mapping.company]?.trim() || undefined : undefined,
        stage_id: firstStageId,
        source: "importacao",
        status: "active",
        position: nextPosition++,
        workspace_id: workspaceId!,
      });

      if (maxRows !== undefined && validRows.length >= maxRows) break;
    }

    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    const total = validRows.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("leads")
        .upsert(batch, { onConflict: "phone,workspace_id", ignoreDuplicates: true })
        .select("id");
      if (error) {
        console.error("Batch upsert error:", error);
        errors += batch.length;
      } else {
        const insertedCount = data?.length ?? 0;
        imported += insertedCount;
        duplicates += batch.length - insertedCount;
      }
      setProgress(Math.round(((i + batch.length) / total) * 100));
    }

    // Assign tag to all imported leads if selected
    if (selectedTagId && selectedTagId !== "__none__" && imported > 0) {
      // Get all lead IDs that were just imported (by phone+workspace)
      const phones = validRows.map(r => r.phone);
      const tagAssignments: Array<{ lead_id: string; tag_id: string; workspace_id: string }> = [];
      
      for (let i = 0; i < phones.length; i += BATCH_SIZE) {
        const phoneBatch = phones.slice(i, i + BATCH_SIZE);
        const { data: leadIds } = await supabase
          .from("leads")
          .select("id")
          .eq("workspace_id", workspaceId!)
          .in("phone", phoneBatch);
        if (leadIds) {
          leadIds.forEach(l => tagAssignments.push({ lead_id: l.id, tag_id: selectedTagId, workspace_id: workspaceId! }));
        }
      }

      if (tagAssignments.length > 0) {
        for (let i = 0; i < tagAssignments.length; i += BATCH_SIZE) {
          await supabase
            .from("lead_tag_assignments")
            .upsert(tagAssignments.slice(i, i + BATCH_SIZE), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
        }
      }
    }

    setResult({ imported, duplicates, errors });
    setStep("done");
    if (imported > 0) {
      refetchPlan();
      onImportComplete();
    }
  }, [rows, mapping, onImportComplete, firstStageId, workspaceId, selectedTagId, refetchPlan]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl w-[95vw]">
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

            {/* Tag assignment */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Tag para os contatos importados (opcional)
              </Label>
              <div className="flex gap-2">
                <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Selecionar tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Input
                    className="h-8 text-xs w-32"
                    placeholder="Nova tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || creatingTag}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {selectedTagId && selectedTagId !== "__none__" && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {availableTags.find(t => t.id === selectedTagId)?.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">será aplicada a todos os contatos</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button onClick={handleStartImport} disabled={!mapping.name || !mapping.phone}>
                Importar {rows.length} contatos
              </Button>
            </div>
          </div>
        )}

        {step === "limit_warning" && (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Limite de leads próximo</p>
                <p className="text-muted-foreground">
                  Esta importação adicionaria mais leads do que o espaço disponível. 
                  Você tem espaço para <strong>{importLimit?.toLocaleString("pt-BR")}</strong> novos leads. 
                  Serão importados apenas os primeiros {importLimit?.toLocaleString("pt-BR")} contatos, ou acesse Planos para expandir.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
              <Button variant="outline" onClick={() => { reset(); onOpenChange(false); navigate("/planos"); }}>Ver planos</Button>
              <Button onClick={() => startImport(importLimit ?? undefined)}>
                Importar parcialmente
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
