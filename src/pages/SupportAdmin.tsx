import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Headset, Send, Loader2, ArrowLeft, CheckCircle, User, Bot, Phone, ArrowRightLeft, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/* ───────── Types ───────── */

interface QueueItem {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  instance_name: string | null;
  reason: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  ticket_id: string | null;
  // enriched
  lead_name?: string;
  lead_phone?: string;
  workspace_name?: string;
  assigned_name?: string;
}

interface WaMessage {
  id: string;
  content: string | null;
  from_me: boolean;
  direction: string;
  message_type: string;
  timestamp: string;
  push_name: string | null;
}

interface TeamMember {
  user_id: string;
  full_name: string;
}

/* ───────── Constants ───────── */

const statusConfig: Record<string, { label: string; color: string }> = {
  waiting: { label: "Aguardando", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  in_progress: { label: "Em atendimento", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  resolved: { label: "Finalizado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

/* ───────── Component ───────── */

export default function SupportAdmin() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("active");
  const [viewMode, setViewMode] = useState<"mine" | "all">("mine");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Load team members ── */
  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .not("accepted_at", "is", null);

      if (!members || members.length === 0) return;

      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      if (profiles) {
        setTeamMembers(profiles.map(p => ({ user_id: p.user_id, full_name: p.full_name || p.user_id })));
      }
    })();
  }, [workspaceId]);

  const getMemberName = useCallback((userId: string | null) => {
    if (!userId) return "Não atribuído";
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.full_name || "Usuário";
  }, [teamMembers]);

  /* ── Load queue items ── */
  const loadItems = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    let query = supabase
      .from("human_support_queue" as any)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter === "active") {
      query = query.in("status", ["waiting", "in_progress"]);
    } else if (filter !== "all") {
      query = query.eq("status", filter);
    }

    // Filter by assigned_to when viewMode is "mine"
    if (viewMode === "mine" && user?.id) {
      query = query.eq("assigned_to", user.id);
    }

    const { data, error } = await query;
    if (error) { console.error("[SupportAdmin] load error:", error); setLoading(false); return; }
    const rows = (data || []) as any[];

    // Enrich with lead names + workspace name
    const leadIds = [...new Set(rows.filter(r => r.lead_id).map(r => r.lead_id))];
    let leadsMap: Record<string, { name: string; phone: string }> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase.from("leads").select("id, name, phone").in("id", leadIds);
      if (leads) for (const l of leads) leadsMap[l.id] = { name: l.name, phone: l.phone };
    }

    const { data: ws } = await supabase.from("workspaces").select("id, name").eq("id", workspaceId).single();

    setItems(rows.map((r: any) => ({
      ...r,
      lead_name: r.lead_id ? leadsMap[r.lead_id]?.name || "Lead desconhecido" : "Sem lead",
      lead_phone: r.lead_id ? leadsMap[r.lead_id]?.phone || "" : "",
      workspace_name: ws?.name || "",
    })));
    setLoading(false);
  }, [workspaceId, filter, viewMode, user?.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Realtime for new queue items
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel("support-queue-admin")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "human_support_queue",
        filter: `workspace_id=eq.${workspaceId}`,
      }, () => loadItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, loadItems]);

  /* ── Load WhatsApp messages for selected item ── */
  const loadMessages = useCallback(async (item: QueueItem) => {
    if (!item.session_id || !item.instance_name) { setMessages([]); return; }
    setMsgsLoading(true);

    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("id, content, from_me, direction, message_type, timestamp, push_name")
      .eq("workspace_id", item.workspace_id)
      .eq("instance_name", item.instance_name)
      .eq("remote_jid", item.session_id)
      .order("timestamp", { ascending: true })
      .limit(200);

    if (error) console.error("[SupportAdmin] msg load error:", error);
    setMessages((data || []) as WaMessage[]);
    setMsgsLoading(false);
  }, []);

  useEffect(() => {
    if (selected) loadMessages(selected);
    else setMessages([]);
  }, [selected?.id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime for new messages
  useEffect(() => {
    if (!selected?.session_id || !selected?.instance_name) return;
    const channel = supabase
      .channel(`support-msgs-${selected.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "whatsapp_messages",
        filter: `remote_jid=eq.${selected.session_id}`,
      }, (payload: any) => {
        const msg = payload.new;
        if (msg.instance_name === selected.instance_name) {
          setMessages(prev => [...prev, msg as WaMessage]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id, selected?.session_id, selected?.instance_name]);

  /* ── Send reply via Evolution API ── */
  const sendReply = async () => {
    if (!reply.trim() || !selected?.session_id || !selected?.instance_name || sending) return;
    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "sendText",
          instanceName: selected.instance_name,
          payload: { number: selected.session_id.replace("@s.whatsapp.net", ""), text: reply.trim() },
        },
      });

      if (error) throw error;
      setReply("");
      toast({ title: "Mensagem enviada" });

      // Mark as in_progress if waiting
      if (selected.status === "waiting") {
        await supabase
          .from("human_support_queue" as any)
          .update({ status: "in_progress", assigned_to: user?.id, updated_at: new Date().toISOString() })
          .eq("id", selected.id);
        setSelected(prev => prev ? { ...prev, status: "in_progress", assigned_to: user?.id || null } : null);
      }
    } catch (err: any) {
      console.error("[SupportAdmin] send error:", err);
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  /* ── Finalize: resolve queue + resume AI ── */
  const handleFinalize = async () => {
    if (!selected) return;

    try {
      const { error } = await supabase.functions.invoke("human-handoff", {
        body: {
          action: "resume",
          workspace_id: selected.workspace_id,
          lead_id: selected.lead_id,
          session_id: selected.session_id,
          queue_item_id: selected.id,
        },
      });

      if (error) throw error;
      toast({ title: "Atendimento finalizado", description: "IA reativada para este contato." });
      setSelected(null);
      loadItems();
    } catch (err: any) {
      console.error("[SupportAdmin] finalize error:", err);
      toast({ title: "Erro ao finalizar", description: err.message, variant: "destructive" });
    }
  };

  /* ── Claim item ── */
  const handleClaim = async () => {
    if (!selected || !user) return;
    await supabase
      .from("human_support_queue" as any)
      .update({ status: "in_progress", assigned_to: user.id, updated_at: new Date().toISOString() })
      .eq("id", selected.id);
    setSelected(prev => prev ? { ...prev, status: "in_progress", assigned_to: user.id } : null);
    toast({ title: "Atendimento assumido" });
  };

  /* ── Transfer ticket ── */
  const handleTransfer = async (targetUserId: string) => {
    if (!selected) return;
    try {
      const { error } = await supabase.functions.invoke("human-handoff", {
        body: {
          action: "transfer",
          workspace_id: selected.workspace_id,
          queue_item_id: selected.id,
          transfer_to: targetUserId,
        },
      });
      if (error) throw error;
      setSelected(prev => prev ? { ...prev, assigned_to: targetUserId } : null);
      setTransferDialogOpen(false);
      toast({ title: "Ticket transferido", description: `Para ${getMemberName(targetUserId)}` });
      loadItems();
    } catch (err: any) {
      toast({ title: "Erro ao transferir", description: err.message, variant: "destructive" });
    }
  };

  const activeCount = items.filter(i => i.status === "waiting" || i.status === "in_progress").length;

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headset className="h-6 w-6 text-primary" /> Suporte Humano
          </h1>
          <p className="text-muted-foreground text-sm">Atendimentos interceptados da IA — conversas reais do WhatsApp</p>
        </div>
        {activeCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-14rem)]">
        {/* ── Left: Queue list ── */}
        <div className="lg:col-span-1 border rounded-xl flex flex-col bg-background">
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="waiting">Aguardando</SelectItem>
                  <SelectItem value="in_progress">Em atendimento</SelectItem>
                  <SelectItem value="resolved">Finalizados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={viewMode === "all" ? "default" : "outline"}
                size="sm"
                className="h-9 text-xs gap-1 whitespace-nowrap"
                onClick={() => setViewMode(prev => prev === "mine" ? "all" : "mine")}
              >
                <Eye className="h-3.5 w-3.5" />
                {viewMode === "mine" ? "Ver todos" : "Só meus"}
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum atendimento</p>
            ) : (
              <div className="divide-y">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selected?.id === item.id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.lead_name || "—"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {item.lead_phone || item.session_id?.replace("@s.whatsapp.net", "") || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getMemberName(item.assigned_to)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusConfig[item.status]?.color || "bg-muted text-muted-foreground"}`}>
                          {statusConfig[item.status]?.label || item.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Right: Chat area ── */}
        <div className="lg:col-span-2 border rounded-xl flex flex-col bg-background">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Headset className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione um atendimento para ver a conversa</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelected(null)} className="lg:hidden p-1">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {selected.lead_name} — {selected.lead_phone || selected.session_id?.replace("@s.whatsapp.net", "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Responsável: <span className="font-medium text-foreground">{getMemberName(selected.assigned_to)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(selected.status === "waiting" || selected.status === "in_progress") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTransferDialogOpen(true)}
                      className="h-8 text-xs gap-1"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Transferir
                    </Button>
                  )}
                  {selected.status === "waiting" && (
                    <Button size="sm" variant="outline" onClick={handleClaim} className="h-8 text-xs">
                      Assumir
                    </Button>
                  )}
                  {(selected.status === "waiting" || selected.status === "in_progress") && (
                    <Button size="sm" variant="default" onClick={handleFinalize} className="h-8 text-xs gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Finalizar & Retornar IA
                    </Button>
                  )}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusConfig[selected.status]?.color || ""}`}>
                    {statusConfig[selected.status]?.label || selected.status}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                {msgsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Sem mensagens para esta conversa</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map(m => {
                      const isOutbound = m.from_me || m.direction === "outbound";
                      return (
                        <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                            isOutbound
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}>
                            {!isOutbound && m.push_name && (
                              <div className="text-[10px] font-medium opacity-60 mb-0.5 flex items-center gap-1">
                                <User className="h-3 w-3" /> {m.push_name}
                              </div>
                            )}
                            {isOutbound && (
                              <div className="text-[10px] font-medium opacity-60 mb-0.5 flex items-center gap-1">
                                <Bot className="h-3 w-3" /> {m.direction === "outbound" ? "IA/Sistema" : "Enviado"}
                              </div>
                            )}
                            {m.message_type === "image" ? (
                              <p className="italic opacity-70">📷 Imagem</p>
                            ) : m.message_type === "audio" ? (
                              <p className="italic opacity-70">🎵 Áudio</p>
                            ) : m.message_type === "video" ? (
                              <p className="italic opacity-70">🎬 Vídeo</p>
                            ) : m.message_type === "document" ? (
                              <p className="italic opacity-70">📄 Documento</p>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{m.content || ""}</p>
                            )}
                            <div className="text-[10px] opacity-50 mt-1 text-right">
                              {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Reply input */}
              {(selected.status === "waiting" || selected.status === "in_progress") && (
                <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="flex items-center gap-2 p-3 border-t">
                  <Input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Responder pelo WhatsApp..."
                    disabled={sending}
                    className="flex-1 h-9 text-sm"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9" disabled={sending || !reply.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir atendimento</DialogTitle>
            <DialogDescription>Selecione o membro da equipe que receberá este ticket.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {teamMembers
              .filter(m => m.user_id !== selected?.assigned_to)
              .map(m => (
                <Button
                  key={m.user_id}
                  variant="outline"
                  className="w-full justify-start gap-2 h-10"
                  onClick={() => handleTransfer(m.user_id)}
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  {m.full_name}
                </Button>
              ))}
            {teamMembers.filter(m => m.user_id !== selected?.assigned_to).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum outro membro disponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
