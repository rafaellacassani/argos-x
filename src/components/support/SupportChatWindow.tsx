import { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Bot, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "Olá! 👋 Sou a **Aria**, assistente de suporte do Argos X.\n\nComo posso ajudar? Algumas sugestões:\n\n- 📱 Como conectar o WhatsApp\n- 📊 Como usar o funil de vendas\n- 🤖 Como configurar agentes de IA\n- 📢 Como disparar campanhas\n- ⏰ Como agendar mensagens\n\nOu me diga sua dúvida!",
};

export function SupportChatWindow({ escalateSignal }: { escalateSignal?: number }) {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Listen for agent replies via realtime
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`support-${ticketId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${ticketId}`,
      }, (payload: any) => {
        const msg = payload.new;
        if (msg.sender_type === "agent") {
          setMessages(prev => [...prev, { role: "assistant", content: `🧑‍💼 **Atendente:** ${msg.content}` }]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const send = async (overrideText?: string, force?: boolean) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // If escalated, send as user message to ticket
    if (escalated && ticketId) {
      await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        workspace_id: workspace?.id,
        sender_type: "user",
        sender_id: user?.id,
        content: text,
      });
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages.filter(m => m !== WELCOME_MSG), userMsg].map(m => ({ role: m.role, content: m.content })),
          ticketId,
          workspaceId: workspace?.id,
          userId: user?.id,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro" }));
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${err.error || "Erro ao processar"}` }]);
        setLoading(false);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";

      // Check if escalated (JSON response)
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.escalated) {
          setTicketId(data.ticketId);
          setEscalated(true);
          setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
          // Save user message to ticket
          if (data.ticketId) {
            await supabase.from("support_messages").insert({
              ticket_id: data.ticketId,
              workspace_id: workspace?.id,
              sender_type: "user",
              sender_id: user?.id,
              content: text,
            });
          }
          setLoading(false);
          return;
        }
      }

      // SSE streaming
      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantSoFar = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch { /* partial JSON */ }
        }
      }

      // Save AI response to ticket if exists
      if (ticketId && assistantSoFar) {
        await supabase.from("support_messages").insert({
          ticket_id: ticketId,
          workspace_id: workspace?.id,
          sender_type: "ai",
          content: assistantSoFar,
        });
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Erro ao conectar com o suporte. Tente novamente." }]);
    }
    setLoading(false);
  };

  return (
    <>
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1 [&_li]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center mt-1">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-xl px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {["Como conectar WhatsApp?", "Como criar campanha?", "Como usar agentes IA?"].map(q => (
            <button
              key={q}
              onClick={() => { setInput(q); setTimeout(() => inputRef.current?.form?.requestSubmit(), 50); }}
              className="text-xs px-2.5 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors text-muted-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Escalation banner */}
      {escalated && (
        <div className="px-3 pb-1">
          <div className="bg-amber-500/10 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5" />
            Chamado aberto — aguardando atendente humano
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 px-3 py-3 border-t bg-background"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={escalated ? "Enviar mensagem ao atendente..." : "Digite sua dúvida..."}
          disabled={loading}
          className="flex-1 h-9 text-sm"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </>
  );
}
