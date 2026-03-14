import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Headset, Send, Clock, CheckCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "@/hooks/use-toast";

type Ticket = {
  id: string;
  workspace_id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  workspace_name?: string;
  user_name?: string;
};

type Message = {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export default function SupportAdmin() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("open");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load tickets
  useEffect(() => {
    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    setLoading(true);
    let query = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;

    if (data) {
      // Enrich with workspace names
      const wsIds = [...new Set(data.map(t => t.workspace_id))];
      const { data: workspaces } = await supabase.from("workspaces").select("id, name").in("id", wsIds);
      const wsMap = Object.fromEntries((workspaces || []).map(w => [w.id, w.name]));

      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabase.from("user_profiles").select("user_id, full_name").in("user_id", userIds);
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.full_name]));

      setTickets(data.map(t => ({
        ...t,
        workspace_name: wsMap[t.workspace_id] || "—",
        user_name: profileMap[t.user_id] || "—",
      })));
    }
    setLoading(false);
  };

  // Load messages for selected ticket
  useEffect(() => {
    if (!selected) return;
    loadMessages(selected.id);

    const channel = supabase
      .channel(`admin-support-${selected.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${selected.id}`,
      }, (payload: any) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selected.id,
      workspace_id: selected.workspace_id,
      sender_type: "agent",
      sender_id: user?.id,
      content: reply.trim(),
    });
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      setReply("");
      // Update ticket status
      if (selected.status === "open") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selected.id);
        setSelected(prev => prev ? { ...prev, status: "in_progress" } : null);
      }
    }
    setSending(false);
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    await supabase.from("support_tickets").update({
      status,
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    }).eq("id", selected.id);
    setSelected(prev => prev ? { ...prev, status } : null);
    loadTickets();
    toast({ title: `Ticket ${statusLabels[status]?.toLowerCase() || status}` });
  };

  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headset className="h-6 w-6 text-primary" /> Suporte
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie chamados de suporte dos clientes</p>
        </div>
        {openCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">{openCount} aberto{openCount > 1 ? "s" : ""}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-14rem)]">
        {/* Ticket list */}
        <div className="lg:col-span-1 border rounded-xl flex flex-col bg-background">
          <div className="p-3 border-b">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="resolved">Resolvidos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : tickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum chamado</p>
            ) : (
              <div className="divide-y">
                {tickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selected?.id === t.id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.user_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.workspace_name}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{t.subject || "Sem assunto"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[t.status] || ""}`}>
                          {statusLabels[t.status] || t.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 border rounded-xl flex flex-col bg-background">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Headset className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Selecione um chamado para responder</p>
              </div>
            </div>
          ) : (
            <>
              {/* Ticket header */}
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelected(null)} className="lg:hidden p-1">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{selected.user_name} — {selected.workspace_name}</p>
                    <p className="text-xs text-muted-foreground">{selected.subject || "Sem assunto"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select value={selected.status} onValueChange={updateStatus}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                <div className="space-y-3">
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.sender_type === "agent" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                        m.sender_type === "agent"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : m.sender_type === "ai"
                          ? "bg-violet-100 dark:bg-violet-900/30 text-foreground rounded-bl-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        <div className="text-[10px] font-medium opacity-60 mb-1">
                          {m.sender_type === "user" ? "👤 Cliente" : m.sender_type === "ai" ? "🤖 Aria (IA)" : "🧑‍💼 Atendente"}
                        </div>
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                        <div className="text-[10px] opacity-50 mt-1 text-right">
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Reply */}
              <form onSubmit={(e) => { e.preventDefault(); sendReply(); }} className="flex items-center gap-2 p-3 border-t">
                <Input
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Responder ao cliente..."
                  disabled={sending}
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="icon" className="h-9 w-9" disabled={sending || !reply.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
