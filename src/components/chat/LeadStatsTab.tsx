import { useState, useEffect, useMemo } from "react";
import { 
  Clock, MessageSquare, Send, Inbox, ArrowRight, Tag, 
  Globe, Calendar, Activity 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { type Lead, type FunnelStage, type LeadHistory } from "@/hooks/useLeads";

interface LeadStatsTabProps {
  lead: Lead;
  stages: FunnelStage[];
}

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
  whatsapp: { label: "WhatsApp", emoji: "💬" },
  facebook: { label: "Facebook", emoji: "📘" },
  instagram: { label: "Instagram", emoji: "📸" },
  import: { label: "Importação", emoji: "📥" },
  manual: { label: "Manual", emoji: "✏️" },
  campaign: { label: "Campanha", emoji: "📣" },
};

interface TagAssignment {
  id: string;
  tag_id: string;
  created_at: string;
  tag: { id: string; name: string; color: string } | null;
}

interface MessageMetrics {
  total: number;
  sent: number;
  received: number;
  lastReceived: string | null;
  lastSent: string | null;
}

export function LeadStatsTab({ lead, stages }: LeadStatsTabProps) {
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [tagAssignments, setTagAssignments] = useState<TagAssignment[]>([]);
  const [messageMetrics, setMessageMetrics] = useState<MessageMetrics>({
    total: 0, sent: 0, received: 0, lastReceived: null, lastSent: null,
  });
  const [performerNames, setPerformerNames] = useState<Record<string, string>>({});

  // Days active
  const daysActive = useMemo(() => {
    const created = new Date(lead.created_at);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
  }, [lead.created_at]);

  // Source info
  const sourceInfo = useMemo(() => {
    const key = (lead.source || "manual").toLowerCase();
    return SOURCE_LABELS[key] || { label: lead.source || "Manual", emoji: "📌" };
  }, [lead.source]);

  // Fetch history
  useEffect(() => {
    supabase
      .from("lead_history")
      .select(`
        *,
        from_stage:funnel_stages!lead_history_from_stage_id_fkey(id, name, color),
        to_stage:funnel_stages!lead_history_to_stage_id_fkey(id, name, color)
      `)
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const items = (data || []) as unknown as LeadHistory[];
        setHistory(items);
        // Fetch performer names
        const userIds = [...new Set(items.map(h => h.performed_by).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          supabase
            .from("user_profiles")
            .select("id, full_name")
            .in("id", userIds)
            .then(({ data: profiles }) => {
              const map: Record<string, string> = {};
              (profiles || []).forEach(p => { map[p.id] = p.full_name; });
              setPerformerNames(map);
            });
        }
      });
  }, [lead.id]);

  // Fetch tag assignments with dates
  useEffect(() => {
    supabase
      .from("lead_tag_assignments")
      .select("id, tag_id, created_at, tag:lead_tags(id, name, color)")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTagAssignments((data || []) as unknown as TagAssignment[]);
      });
  }, [lead.id, lead.tags]);

  // Fetch message metrics from meta_conversations (if lead has a whatsapp_jid mapped)
  useEffect(() => {
    if (!lead.whatsapp_jid) {
      setMessageMetrics({ total: 0, sent: 0, received: 0, lastReceived: null, lastSent: null });
      return;
    }
    // sender_id in meta_conversations matches the whatsapp jid number part
    const senderId = lead.whatsapp_jid.replace(/@.*$/, "");
    supabase
      .from("meta_conversations")
      .select("direction, timestamp")
      .eq("sender_id", senderId)
      .order("timestamp", { ascending: false })
      .then(({ data }) => {
        const msgs = data || [];
        const sent = msgs.filter(m => m.direction === "outbound").length;
        const received = msgs.filter(m => m.direction === "inbound").length;
        const lastReceivedMsg = msgs.find(m => m.direction === "inbound");
        const lastSentMsg = msgs.find(m => m.direction === "outbound");
        setMessageMetrics({
          total: msgs.length,
          sent,
          received,
          lastReceived: lastReceivedMsg?.timestamp || null,
          lastSent: lastSentMsg?.timestamp || null,
        });
      });
  }, [lead.whatsapp_jid]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const stageMovements = history.filter(h => h.action === "stage_change" || h.action === "moved");

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">

        {/* Days Active - Hero */}
        <div className="bg-primary/10 rounded-xl px-4 py-5 text-center">
          <p className="text-3xl font-extrabold text-primary">{daysActive}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {daysActive === 1 ? "dia ativo" : "dias ativos"} no CRM
          </p>
        </div>

        {/* Source & Creation */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Origem
          </p>
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
            <span className="text-lg">{sourceInfo.emoji}</span>
            <div>
              <p className="text-sm font-medium">{sourceInfo.label}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Criado em {formatDate(lead.created_at)}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Message Metrics */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Métricas de Interação
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MetricBox icon={MessageSquare} label="Total" value={messageMetrics.total} />
            <MetricBox icon={Send} label="Enviadas" value={messageMetrics.sent} />
            <MetricBox icon={Inbox} label="Recebidas" value={messageMetrics.received} />
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {messageMetrics.lastReceived && (
              <p>📩 Última recebida: {formatDateTime(messageMetrics.lastReceived)}</p>
            )}
            {messageMetrics.lastSent && (
              <p>📤 Última enviada: {formatDateTime(messageMetrics.lastSent)}</p>
            )}
            {!messageMetrics.lastReceived && !messageMetrics.lastSent && (
              <p className="text-center italic">Sem mensagens registradas</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Funnel History Timeline */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Histórico do Funil
          </p>
          {stageMovements.length > 0 ? (
            <div className="relative pl-4 space-y-3">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
              {stageMovements.map((h) => (
                <div key={h.id} className="relative flex gap-3">
                  <div className="absolute left-[-13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-primary bg-background z-10" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      {h.from_stage && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: (h.from_stage as any).color }}>
                          {(h.from_stage as any).name}
                        </Badge>
                      )}
                      <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      {h.to_stage && (
                        <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: (h.to_stage as any).color }}>
                          {(h.to_stage as any).name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDateTime(h.created_at)}
                      {h.performed_by && performerNames[h.performed_by] && (
                        <> · por <span className="font-medium text-foreground">{performerNames[h.performed_by]}</span></>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center italic">Nenhuma movimentação registrada</p>
          )}
        </div>

        <Separator />

        {/* Tags with dates */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Tags Aplicadas
          </p>
          {tagAssignments.length > 0 ? (
            <div className="space-y-1.5">
              {tagAssignments.map((ta) => (
                <div key={ta.id} className="flex items-center justify-between">
                  <Badge
                    className="text-[10px] px-2 py-0.5 text-white"
                    style={{ backgroundColor: ta.tag?.color || "#6B7280" }}
                  >
                    {ta.tag?.name || "Tag removida"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(ta.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center italic">Nenhuma tag aplicada</p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function MetricBox({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-muted/30 rounded-lg px-2 py-2 text-center">
      <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
      <p className="text-base font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
