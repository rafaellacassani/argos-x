import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { downloadTextFile, sanitizeFilename } from "@/lib/exportUtils";
import {
  buildConversationExportText,
  normalizeConversationPhone,
  resolveConversationContent,
  type ConversationExportGroup,
} from "@/lib/chatExportUtils";

interface ExportConversationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InstanceOption {
  value: string;
  label: string;
  kind: "all" | "whatsapp" | "meta";
  instanceName?: string;
  metaPageId?: string;
}

interface WhatsAppExportRow {
  instance_name: string;
  remote_jid: string;
  from_me: boolean | null;
  content: string | null;
  message_type: string | null;
  timestamp: string;
  push_name: string | null;
}

interface MetaExportRow {
  meta_page_id: string;
  sender_id: string;
  sender_name: string | null;
  direction: string;
  content: string | null;
  message_type: string | null;
  timestamp: string;
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

  const selectedOption = useMemo(
    () => instances.find((option) => option.value === selectedInstance),
    [instances, selectedInstance]
  );

  useEffect(() => {
    if (!open || !workspaceId) return;

    (async () => {
      const [whatsappResult, metaPagesResult] = await Promise.all([
        supabase
          .from("whatsapp_instances")
          .select("instance_name, display_name")
          .eq("workspace_id", workspaceId)
          .neq("instance_type", "alerts"),
        supabase
          .from("meta_pages")
          .select("id, page_name, platform")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
      ]);

      const options: InstanceOption[] = [{ value: "all", label: "Todas as origens", kind: "all" }];

      (whatsappResult.data || []).forEach((instance: any) => {
        options.push({
          value: `wa:${instance.instance_name}`,
          label: instance.display_name || instance.instance_name,
          kind: "whatsapp",
          instanceName: instance.instance_name,
        });
      });

      (metaPagesResult.data || []).forEach((page: any) => {
        const suffix = page.platform === "whatsapp_business" ? "WhatsApp Business" : "Meta";
        options.push({
          value: `meta:${page.id}`,
          label: `${page.page_name} (${suffix})`,
          kind: "meta",
          metaPageId: page.id,
        });
      });

      setInstances(options);
      setSelectedInstance((current) => (options.some((option) => option.value === current) ? current : "all"));
    })();
  }, [open, workspaceId]);

  const handleExport = async () => {
    if (!workspaceId) return;

    setLoading(true);

    try {
      const startISO = new Date(startDate + "T00:00:00").toISOString();
      const endISO = new Date(endDate + "T23:59:59").toISOString();
      const includeWhatsApp = selectedInstance === "all" || selectedOption?.kind === "whatsapp";
      const includeMeta = selectedInstance === "all" || selectedOption?.kind === "meta";
      const selectedWhatsAppInstance = selectedOption?.kind === "whatsapp" ? selectedOption.instanceName : null;
      const selectedMetaPageId = selectedOption?.kind === "meta" ? selectedOption.metaPageId : null;
      const pageSize = 1000;

      const whatsappRows: WhatsAppExportRow[] = [];
      const metaRows: MetaExportRow[] = [];
      const metaPageLabelMap = new Map<string, string>();

      instances.forEach((option) => {
        if (option.kind === "meta" && option.metaPageId) {
          metaPageLabelMap.set(option.metaPageId, option.label);
        }
      });

      if (includeWhatsApp) {
        let from = 0;

        while (true) {
          let query = supabase
            .from("whatsapp_messages")
            .select("instance_name, remote_jid, from_me, content, message_type, timestamp, push_name")
            .eq("workspace_id", workspaceId)
            .gte("timestamp", startISO)
            .lte("timestamp", endISO)
            .order("timestamp", { ascending: true })
            .range(from, from + pageSize - 1);

          if (selectedWhatsAppInstance) query = query.eq("instance_name", selectedWhatsAppInstance);

          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;

          whatsappRows.push(...(data as WhatsAppExportRow[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
      }

      if (includeMeta) {
        let from = 0;

        while (true) {
          let query = supabase
            .from("meta_conversations")
            .select("meta_page_id, sender_id, sender_name, direction, content, message_type, timestamp")
            .eq("workspace_id", workspaceId)
            .gte("timestamp", startISO)
            .lte("timestamp", endISO)
            .order("timestamp", { ascending: true })
            .range(from, from + pageSize - 1);

          if (selectedMetaPageId) query = query.eq("meta_page_id", selectedMetaPageId);

          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;

          metaRows.push(...(data as MetaExportRow[]));
          if (data.length < pageSize) break;
          from += pageSize;
        }
      }

      if (whatsappRows.length === 0 && metaRows.length === 0) {
        toast({ title: "Nenhuma conversa encontrada", description: "Não há mensagens no período selecionado." });
        return;
      }

      const phoneToName = new Map<string, string>();
      let leadFrom = 0;

      while (true) {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("name, phone, whatsapp_jid")
          .eq("workspace_id", workspaceId)
          .range(leadFrom, leadFrom + pageSize - 1);

        if (error) throw error;
        if (!leads || leads.length === 0) break;

        (leads as any[]).forEach((lead) => {
          const phone = normalizeConversationPhone(lead.phone);
          const jid = normalizeConversationPhone(lead.whatsapp_jid);
          if (phone) phoneToName.set(phone, lead.name);
          if (jid) phoneToName.set(jid, lead.name);
        });

        if (leads.length < pageSize) break;
        leadFrom += pageSize;
      }

      const groupsMap = new Map<string, ConversationExportGroup>();

      for (const row of whatsappRows) {
        const phone = normalizeConversationPhone(row.remote_jid);
        const contactName = phoneToName.get(phone) || row.push_name || phone || "Desconhecido";
        const key = `wa|${row.instance_name}|${row.remote_jid}`;

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            sourceLabel: row.instance_name,
            contactName,
            contactId: row.remote_jid,
            messages: [],
          });
        }

        groupsMap.get(key)!.messages.push({
          timestamp: row.timestamp,
          sender: row.from_me ? "EU" : contactName.toUpperCase(),
          content: resolveConversationContent(row.content, row.message_type),
        });
      }

      for (const row of metaRows) {
        const phone = normalizeConversationPhone(row.sender_id);
        const contactName = phoneToName.get(phone) || row.sender_name || phone || "Desconhecido";
        const key = `meta|${row.meta_page_id}|${row.sender_id}`;

        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            key,
            sourceLabel: metaPageLabelMap.get(row.meta_page_id) || "WhatsApp Business",
            contactName,
            contactId: row.sender_id,
            messages: [],
          });
        }

        groupsMap.get(key)!.messages.push({
          timestamp: row.timestamp,
          sender: row.direction === "outbound" ? "EU" : contactName.toUpperCase(),
          content: resolveConversationContent(row.content, row.message_type),
        });
      }

      const groups = Array.from(groupsMap.values())
        .map((group) => ({
          ...group,
          messages: [...group.messages].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
        }))
        .sort((a, b) => {
          const aTs = a.messages[0] ? new Date(a.messages[0].timestamp).getTime() : 0;
          const bTs = b.messages[0] ? new Date(b.messages[0].timestamp).getTime() : 0;
          return aTs - bTs;
        });

      const totalMessages = groups.reduce((sum, group) => sum + group.messages.length, 0);
      const workspaceName = workspace?.name || "Workspace";
      const sourceLabel = selectedOption?.label || "Todas as origens";
      const finalText = buildConversationExportText({
        workspaceName,
        startISO,
        endISO,
        sourceLabel,
        groups,
        totalMessages,
      });

      const filename = `conversas_${sanitizeFilename(workspaceName)}_${sanitizeFilename(sourceLabel)}_${startDate}_a_${endDate}.txt`;
      downloadTextFile(filename, finalText);

      toast({
        title: "Exportação concluída",
        description: `${groups.length} conversas (${totalMessages} mensagens) exportadas.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("[ExportConversations] error:", err);
      toast({
        title: "Erro ao exportar",
        description: err.message || "Falha desconhecida",
        variant: "destructive",
      });
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
            Baixe um arquivo .txt com o histórico completo e organizado do período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Instância / canal</Label>
            <Select value={selectedInstance} onValueChange={setSelectedInstance}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.value} value={instance.value}>
                    {instance.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} max={endDate} />
            </div>
            <div className="space-y-2">
              <Label>Data fim</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} max={today} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            O TXT sai em ordem cronológica, com data, hora, tudo que você enviou e tudo que o lead respondeu; mídias entram como etiqueta textual.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar TXT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
