import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { downloadTextFile, formatDateTimeBR, sanitizeFilename } from "@/lib/exportUtils";

interface ExportConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InstanceOption {
  value: string;
  label: string;
}

export function ExportConversationsDialog({ open, onOpenChange }: ExportConversationsDialogProps) {
  const { workspaceId, workspace } = useWorkspace();
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>("all");
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(sevenDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !workspaceId) return;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, display_name")
        .eq("workspace_id", workspaceId)
        .neq("instance_type", "alerts");
      const opts: InstanceOption[] = [{ value: "all", label: "Todas as instâncias" }];
      (data || []).forEach((i: any) => {
        opts.push({ value: i.instance_name, label: i.display_name || i.instance_name });
      });
      setInstances(opts);
    })();
  }, [open, workspaceId]);

  const handleExport = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const startISO = new Date(startDate + "T00:00:00").toISOString();
      const endISO = new Date(endDate + "T23:59:59").toISOString();

      // Fetch all messages in range, paginated
      const allRows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        let q = supabase
          .from("whatsapp_messages")
          .select("instance_name, remote_jid, from_me, content, message_type, timestamp, push_name")
          .eq("workspace_id", workspaceId)
          .gte("timestamp", startISO)
          .lte("timestamp", endISO)
          .order("timestamp", { ascending: true })
          .range(from, from + pageSize - 1);
        if (selectedInstance !== "all") q = q.eq("instance_name", selectedInstance);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (allRows.length === 0) {
        toast({ title: "Nenhuma conversa encontrada", description: "Não há mensagens no período selecionado." });
        setLoading(false);
        return;
      }

      // Group by instance + remote_jid
      const groups = new Map<string, any[]>();
      for (const m of allRows) {
        const key = `${m.instance_name}|${m.remote_jid}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
      }

      // Resolve lead names per phone
      const phones = Array.from(new Set(Array.from(groups.values()).map(g => {
        const phone = (g[0].remote_jid || "").split("@")[0];
        return phone;
      }).filter(Boolean)));

      const phoneToName = new Map<string, string>();
      if (phones.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("name, phone")
          .eq("workspace_id", workspaceId)
          .in("phone", phones);
        (leads || []).forEach((l: any) => phoneToName.set(l.phone, l.name));
      }

      // Build TXT
      const wsName = workspace?.name || "Workspace";
      const header = [
        "═══════════════════════════════════════════════════════════════",
        `  EXPORTAÇÃO DE CONVERSAS — ${wsName}`,
        `  Período: ${formatDateTimeBR(startISO)} até ${formatDateTimeBR(endISO)}`,
        `  Instância: ${selectedInstance === "all" ? "Todas" : selectedInstance}`,
        `  Total de conversas: ${groups.size}`,
        `  Total de mensagens: ${allRows.length}`,
        `  Gerado em: ${formatDateTimeBR(new Date())}`,
        "═══════════════════════════════════════════════════════════════",
        "",
      ].join("\n");

      const sections: string[] = [];
      const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
        const aTs = new Date(a[1][0].timestamp).getTime();
        const bTs = new Date(b[1][0].timestamp).getTime();
        return aTs - bTs;
      });

      for (const [key, msgs] of sortedGroups) {
        const [instanceName, remoteJid] = key.split("|");
        const phone = (remoteJid || "").split("@")[0];
        const contactName = phoneToName.get(phone) || msgs.find(m => m.push_name)?.push_name || phone || "Desconhecido";

        sections.push("");
        sections.push("───────────────────────────────────────────────────────────────");
        sections.push(`CONTATO: ${contactName}`);
        sections.push(`Telefone/JID: ${remoteJid}`);
        sections.push(`Instância: ${instanceName}`);
        sections.push(`Mensagens: ${msgs.length}`);
        sections.push("───────────────────────────────────────────────────────────────");

        let lastDay = "";
        for (const m of msgs) {
          const ts = new Date(m.timestamp);
          const day = ts.toLocaleDateString("pt-BR");
          if (day !== lastDay) {
            sections.push("");
            sections.push(`📅 ${day}`);
            lastDay = day;
          }
          const time = ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const sender = m.from_me ? "EU" : contactName.toUpperCase();
          let content = (m.content || "").trim();
          if (!content && m.message_type && m.message_type !== "text") {
            content = `[${m.message_type}]`;
          }
          if (!content) content = "(mensagem vazia)";
          sections.push(`[${time}] ${sender}: ${content}`);
        }
        sections.push("");
      }

      const finalText = header + sections.join("\n");
      const filename = `conversas_${sanitizeFilename(wsName)}_${startDate}_a_${endDate}.txt`;
      downloadTextFile(filename, finalText);

      toast({ title: "Exportação concluída", description: `${groups.size} conversas (${allRows.length} mensagens) exportadas.` });
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ExportConversations] error:", err);
      toast({ title: "Erro ao exportar", description: err.message || "Falha desconhecida", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Conversas
          </DialogTitle>
          <DialogDescription>
            Baixe um arquivo .txt com todas as conversas do período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Instância</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate} />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={today} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            O arquivo conterá apenas mensagens de texto, organizadas por contato e em ordem cronológica com data e hora.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar TXT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
