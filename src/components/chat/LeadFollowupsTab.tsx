import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarClock, ChevronDown, ChevronUp, Edit2, Trash2, Check, X,
  Loader2, Clock, Send as SendIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUserRole } from "@/hooks/useUserRole";
import { useLeads } from "@/hooks/useLeads";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/hooks/useLeads";

interface ScheduledMsg {
  id: string;
  message: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  channel_type: string;
  contact_name: string | null;
  error_message: string | null;
}

interface LeadFollowupsTabProps {
  lead: Lead;
}

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-green-500" },
  meta_facebook: { label: "Facebook", color: "bg-blue-500" },
  meta_instagram: { label: "Instagram", color: "bg-pink-500" },
};

function StatusBadge({ status, scheduledAt }: { status: string; scheduledAt: string }) {
  const isPastDue = status === "pending" && new Date(scheduledAt) < new Date();
  if (isPastDue) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ Atrasado</Badge>;
  if (status === "pending") return <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500 text-white">🟡 Pendente</Badge>;
  if (status === "sent") return <Badge className="text-[10px] px-1.5 py-0 bg-green-500 text-white">🟢 Enviado</Badge>;
  if (status === "failed" || status === "error") return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">🔴 Falhou</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>;
}

export function LeadFollowupsTab({ lead }: LeadFollowupsTabProps) {
  const { workspaceId } = useWorkspace();
  const { isSeller, userProfileId } = useUserRole();
  const { updateLead } = useLeads();
  const [followups, setFollowups] = useState<ScheduledMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  // New follow-up form
  const [showNew, setShowNew] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [newTime, setNewTime] = useState("09:00");
  const [newSaving, setNewSaving] = useState(false);

  const fetchFollowups = useCallback(async () => {
    if (!lead.whatsapp_jid && !lead.phone) { setLoading(false); return; }
    // Match by remote_jid (whatsapp) or phone_number
    let query = supabase
      .from("scheduled_messages")
      .select("id, message, scheduled_at, sent_at, status, channel_type, contact_name, error_message")
      .order("scheduled_at", { ascending: true });

    if (lead.whatsapp_jid) {
      query = query.eq("remote_jid", lead.whatsapp_jid);
    } else {
      query = query.eq("phone_number", lead.phone);
    }
    const { data } = await query;
    setFollowups((data || []) as ScheduledMsg[]);
    setLoading(false);
  }, [lead.whatsapp_jid, lead.phone]);

  useEffect(() => { fetchFollowups(); }, [fetchFollowups]);

  const counts = useMemo(() => {
    const pending = followups.filter(f => f.status === "pending").length;
    const sent = followups.filter(f => f.status === "sent").length;
    return { pending, sent, total: followups.length };
  }, [followups]);

  const handleNewFollowup = async () => {
    if (!newMsg.trim() || !newDate) return;
    const [h, m] = newTime.split(":").map(Number);
    const scheduledAt = new Date(newDate);
    scheduledAt.setHours(h, m, 0, 0);
    if (scheduledAt <= new Date()) {
      toast({ title: "Data deve ser no futuro", variant: "destructive" });
      return;
    }
    setNewSaving(true);
    try {
      await supabase.from("scheduled_messages" as any).insert({
        message: newMsg.trim(),
        scheduled_at: scheduledAt.toISOString(),
        channel_type: "whatsapp",
        instance_name: lead.instance_name || null,
        remote_jid: lead.whatsapp_jid || null,
        phone_number: lead.phone || null,
        contact_name: lead.name,
        status: "pending",
        workspace_id: workspaceId,
      } as any);
      toast({ title: "Follow-up agendado!" });
      // Auto-assign lead to seller if unassigned
      if (isSeller && userProfileId && !lead.responsible_user) {
        await updateLead(lead.id, { responsible_user: userProfileId });
      }
      setShowNew(false); setNewMsg(""); setNewDate(undefined); setNewTime("09:00");
      await fetchFollowups();
    } catch {
      toast({ title: "Erro ao agendar", variant: "destructive" });
    }
    setNewSaving(false);
  };

  const startEdit = (f: ScheduledMsg) => {
    setEditingId(f.id);
    setEditMsg(f.message);
    const dt = new Date(f.scheduled_at);
    setEditDate(dt);
    setEditTime(format(dt, "HH:mm"));
    setExpandedId(f.id);
  };

  const handleEditSave = async () => {
    if (!editingId || !editMsg.trim()) return;
    const [h, m] = editTime.split(":").map(Number);
    const scheduledAt = new Date(editDate);
    scheduledAt.setHours(h, m, 0, 0);
    setSaving(true);
    try {
      await supabase.from("scheduled_messages" as any)
        .update({ message: editMsg.trim(), scheduled_at: scheduledAt.toISOString() } as any)
        .eq("id", editingId);
      toast({ title: "Follow-up atualizado" });
      setEditingId(null);
      await fetchFollowups();
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("scheduled_messages").delete().eq("id", id);
    toast({ title: "Follow-up excluído" });
    setExpandedId(null);
    await fetchFollowups();
  };

  const formatDt = (s: string) => format(new Date(s), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Counters */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-yellow-600">{counts.pending} pendentes</span>
          <span>·</span>
          <span className="font-semibold text-green-600">{counts.sent} enviados</span>
          <span>·</span>
          <span>{counts.total} total</span>
        </div>

        {/* New button */}
        {!showNew && (
          <Button size="sm" className="w-full gap-1.5" onClick={() => setShowNew(true)}>
            <CalendarClock className="w-3.5 h-3.5" /> Agendar follow-up
          </Button>
        )}

        {/* New form */}
        {showNew && (
          <div className="border border-border rounded-lg p-3 space-y-2.5 bg-muted/20">
            <p className="text-xs font-semibold">Novo follow-up para {lead.name}</p>
            <Textarea
              placeholder="Mensagem do follow-up..."
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
              maxLength={4000}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-8 text-sm justify-start font-normal")}>
                  📅 {newDate ? format(newDate, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDate}
                  onSelect={setNewDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="h-8 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleNewFollowup} disabled={newSaving || !newMsg.trim() || !newDate}>
                {newSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Agendar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowNew(false)}>
                <X className="w-3 h-3" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* List */}
        {loading ? (
          <p className="text-xs text-muted-foreground text-center">Carregando...</p>
        ) : followups.length === 0 ? (
          <div className="text-center py-6">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum follow-up agendado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followups.map((f) => {
              const isExpanded = expandedId === f.id;
              const isEditing = editingId === f.id;
              const isPastDue = f.status === "pending" && new Date(f.scheduled_at) < new Date();
              const ch = CHANNEL_LABELS[f.channel_type] || { label: f.channel_type, color: "bg-muted" };

              return (
                <div
                  key={f.id}
                  className={cn(
                    "border rounded-lg transition-colors",
                    isPastDue ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/10"
                  )}
                >
                  {/* Summary row */}
                  <button
                    className="w-full flex items-start gap-2 px-3 py-2 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusBadge status={f.status} scheduledAt={f.scheduled_at} />
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 text-white", ch.color)}>
                          {ch.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDt(f.scheduled_at)}
                      </p>
                      <p className="text-xs text-foreground truncate">
                        {f.message.length > 80 ? f.message.slice(0, 80) + "…" : f.message}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1" />}
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                      {isEditing ? (
                        <>
                          <Textarea
                            value={editMsg}
                            onChange={(e) => setEditMsg(e.target.value)}
                            className="min-h-[60px] text-sm resize-none"
                          />
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-8 text-sm justify-start font-normal">
                                📅 {format(editDate, "dd/MM/yyyy")}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={editDate}
                                onSelect={(d) => d && setEditDate(d)}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleEditSave} disabled={saving}>
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />} Salvar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-foreground whitespace-pre-wrap">{f.message}</p>
                          {f.status === "sent" && f.sent_at && (
                            <p className="text-[10px] text-green-600 flex items-center gap-1">
                              <SendIcon className="w-3 h-3" /> Enviado em {formatDt(f.sent_at)}
                            </p>
                          )}
                          {f.status === "failed" && f.error_message && (
                            <p className="text-[10px] text-destructive">Erro: {f.error_message}</p>
                          )}
                          {f.status === "pending" && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => startEdit(f)}>
                                <Edit2 className="w-3 h-3" /> Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30">
                                    <Trash2 className="w-3 h-3" /> Excluir
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir follow-up?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O agendamento será removido permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(f.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
