import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workspace-assistant`;

const SUGGESTIONS = [
  "Quantos leads entraram esta semana?",
  "Tem alguém sem resposta?",
  "Quais agentes de IA estão ativos?",
  "Resumo do meu workspace",
];

export function WorkspaceAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("Não autenticado");
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: text.trim() }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Erro ao conectar com o assistente");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: snapshot } : m);
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white px-4 py-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 text-sm font-medium"
        aria-label="Abrir assistente IA"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Assistente IA</span>
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse shadow-md">
          Novo
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-8rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Assistente IA</p>
            <p className="text-xs opacity-80">Pergunte qualquer coisa sobre seu workspace</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/20 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center mb-4">
              💡 Pergunte qualquer coisa sobre seus leads, chats, agentes e mais!
            </p>
            <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 mb-2">
              <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
                📱 <strong>Novidade!</strong> Se o seu número de WhatsApp estiver cadastrado no seu perfil, você também pode conversar com sua assistente virtual direto pelo WhatsApp, a qualquer momento! Pergunte sobre leads, chats, agentes e tudo do seu workspace.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo sobre seu workspace..."
            className="min-h-[40px] max-h-[80px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
