import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Member {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface InternalMessage {
  id: string;
  workspace_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export default function TeamChat() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();

  const [members, setMembers] = useState<Member[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* ── Load workspace members ── */
  const loadMembers = useCallback(async () => {
    if (!workspaceId || !user) return;
    setLoadingMembers(true);
    try {
      const { data: wm } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .not("accepted_at", "is", null);

      const ids = (wm || [])
        .map((m: any) => m.user_id)
        .filter((id: string) => id && id !== "00000000-0000-0000-0000-000000000000" && id !== user.id);

      if (ids.length === 0) {
        setMembers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, full_name, email, avatar_url")
        .in("user_id", ids)
        .order("full_name");

      setMembers((profiles || []) as Member[]);
    } finally {
      setLoadingMembers(false);
    }
  }, [workspaceId, user]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  /* ── Load unread counts per sender ── */
  const loadUnread = useCallback(async () => {
    if (!workspaceId || !user) return;
    const { data } = await supabase
      .from("internal_messages")
      .select("sender_id")
      .eq("workspace_id", workspaceId)
      .eq("receiver_id", user.id)
      .eq("read", false);
    const map: Record<string, number> = {};
    (data || []).forEach((m: any) => {
      map[m.sender_id] = (map[m.sender_id] || 0) + 1;
    });
    setUnreadByUser(map);
  }, [workspaceId, user]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  /* ── Load conversation with selected member ── */
  const loadConversation = useCallback(
    async (otherUserId: string) => {
      if (!workspaceId || !user) return;
      setLoadingMessages(true);
      try {
        const { data } = await supabase
          .from("internal_messages")
          .select("*")
          .eq("workspace_id", workspaceId)
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
          )
          .order("created_at", { ascending: true })
          .limit(500);
        setMessages((data || []) as InternalMessage[]);

        // Mark unread messages from the other user as read
        const unreadIds = (data || [])
          .filter((m: any) => m.receiver_id === user.id && m.sender_id === otherUserId && !m.read)
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          await supabase
            .from("internal_messages")
            .update({ read: true })
            .in("id", unreadIds);
          setUnreadByUser((prev) => ({ ...prev, [otherUserId]: 0 }));
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [workspaceId, user]
  );

  useEffect(() => {
    if (selectedUserId) loadConversation(selectedUserId);
    else setMessages([]);
  }, [selectedUserId, loadConversation]);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    setTimeout(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 80);
  }, [messages.length, selectedUserId]);

  /* ── Realtime: incoming messages ── */
  useEffect(() => {
    if (!workspaceId || !user) return;
    const channel = supabase
      .channel(`internal_messages_${workspaceId}_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        async (payload) => {
          const m = payload.new as InternalMessage;
          // Only relevant if this user is sender or receiver
          if (m.sender_id !== user.id && m.receiver_id !== user.id) return;

          const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
          if (selectedUserId && otherId === selectedUserId) {
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
            // If incoming and conversation open, mark read immediately
            if (m.receiver_id === user.id) {
              await supabase.from("internal_messages").update({ read: true }).eq("id", m.id);
            }
          } else if (m.receiver_id === user.id) {
            setUnreadByUser((prev) => ({
              ...prev,
              [m.sender_id]: (prev[m.sender_id] || 0) + 1,
            }));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, user, selectedUserId]);

  /* ── Presence (online/offline) via Supabase Realtime presence ── */
  useEffect(() => {
    if (!workspaceId || !user) return;
    const channel = supabase.channel(`presence_team_${workspaceId}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const map: Record<string, boolean> = {};
        Object.keys(state).forEach((uid) => {
          map[uid] = true;
        });
        setPresenceMap(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, user]);

  /* ── Send message ── */
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !user || !workspaceId || !selectedUserId) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from("internal_messages")
        .insert({
          workspace_id: workspaceId,
          sender_id: user.id,
          receiver_id: selectedUserId,
          content: text,
        })
        .select()
        .single();
      if (!error && data) {
        setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as InternalMessage]));
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
    );
  }, [members, search]);

  const selectedMember = members.find((m) => m.user_id === selectedUserId) || null;

  return (
    <>
      <Helmet>
        <title>Equipe - Chat Interno | Argos X</title>
      </Helmet>
      <div className="flex h-[calc(100vh-3.5rem)] bg-background">
        {/* Sidebar: members list */}
        <aside className="w-80 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Equipe
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Chat interno entre membros do workspace
            </p>
            <div className="relative mt-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar membro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 px-4">
                Nenhum outro membro neste workspace.
              </p>
            ) : (
              <ul className="py-2">
                {filteredMembers.map((m) => {
                  const isSelected = m.user_id === selectedUserId;
                  const isOnline = !!presenceMap[m.user_id];
                  const unread = unreadByUser[m.user_id] || 0;
                  return (
                    <li key={m.user_id}>
                      <button
                        onClick={() => setSelectedUserId(m.user_id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                          isSelected && "bg-accent"
                        )}
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={m.avatar_url || undefined} />
                            <AvatarFallback>
                              {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
                              isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                            )}
                            title={isOnline ? "Online" : "Offline"}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.full_name || m.email || "Sem nome"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {isOnline ? "Online agora" : "Offline"}
                          </p>
                        </div>
                        {unread > 0 && (
                          <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                            {unread}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        {/* Conversation panel */}
        <main className="flex-1 flex flex-col">
          {!selectedMember ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
              <p>Selecione um membro para começar a conversar</p>
            </div>
          ) : (
            <>
              <header className="h-14 border-b border-border flex items-center gap-3 px-4 bg-card">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={selectedMember.avatar_url || undefined} />
                  <AvatarFallback>
                    {(selectedMember.full_name || selectedMember.email || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {selectedMember.full_name || selectedMember.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {presenceMap[selectedMember.user_id] ? "Online" : "Offline"}
                  </p>
                </div>
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3 bg-muted/20">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Nenhuma mensagem ainda. Envie a primeira!
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                            mine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card text-foreground border border-border rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <p
                            className={cn(
                              "text-[10px] mt-1 opacity-70",
                              mine ? "text-right" : "text-left"
                            )}
                          >
                            {formatDistanceToNow(new Date(m.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="border-t border-border p-3 bg-card">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-end gap-2"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={!draft.trim() || sending} size="icon">
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </footer>
            </>
          )}
        </main>
      </div>
    </>
  );
}