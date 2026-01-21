import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Check,
  CheckCheck,
  Image,
  Mic,
  Star,
  Archive,
  Filter,
  RefreshCw,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useEvolutionAPI,
  type EvolutionChat,
  type EvolutionMessage,
  type EvolutionInstance,
} from "@/hooks/useEvolutionAPI";
import { toast } from "@/hooks/use-toast";

interface Chat {
  id: string;
  remoteJid: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  phone: string;
}

interface Message {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
  type: "text" | "image" | "audio" | "document" | "video";
}

// Helper to format phone from jid
const formatPhoneFromJid = (jid: string): string => {
  const number = jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
  if (number.length === 13) {
    return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 9)}-${number.slice(9)}`;
  }
  if (number.length === 12) {
    return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 8)}-${number.slice(8)}`;
  }
  return `+${number}`;
};

// Helper to format timestamp
const formatTime = (timestamp: number | undefined): string => {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

// Helper to extract message content
const extractMessageContent = (msg: EvolutionMessage): { content: string; type: Message["type"] } => {
  if (msg.message?.conversation) {
    return { content: msg.message.conversation, type: "text" };
  }
  if (msg.message?.extendedTextMessage?.text) {
    return { content: msg.message.extendedTextMessage.text, type: "text" };
  }
  if (msg.message?.imageMessage) {
    return { content: msg.message.imageMessage.caption || "📷 Imagem", type: "image" };
  }
  if (msg.message?.videoMessage) {
    return { content: msg.message.videoMessage.caption || "🎥 Vídeo", type: "video" };
  }
  if (msg.message?.audioMessage) {
    return { content: "🎵 Áudio", type: "audio" };
  }
  if (msg.message?.documentMessage) {
    return { content: `📄 ${msg.message.documentMessage.fileName || "Documento"}`, type: "document" };
  }
  return { content: msg.messageType || "Mensagem", type: "text" };
};

export default function Chats() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { listInstances, fetchChats, fetchMessages, getConnectionState } = useEvolutionAPI();

  // Load connected instances on mount
  useEffect(() => {
    const loadInstances = async () => {
      const data = await listInstances();
      // Filter only connected instances
      const connectedInstances: EvolutionInstance[] = [];
      for (const instance of data) {
        const state = await getConnectionState(instance.instanceName);
        if (state?.instance?.state === "open") {
          connectedInstances.push({ ...instance, connectionStatus: "open" });
        }
      }
      setInstances(connectedInstances);
      if (connectedInstances.length > 0) {
        setSelectedInstance(connectedInstances[0].instanceName);
      }
    };
    loadInstances();
  }, []);

  // Load chats when instance is selected
  useEffect(() => {
    if (!selectedInstance) return;

    const loadChats = async () => {
      setLoadingChats(true);
      setChatError(null);
      try {
        const data = await fetchChats(selectedInstance);
        console.log("[Chats] Raw chats data:", data);

        // Check if data is empty array or has an error
        if (!Array.isArray(data) || data.length === 0) {
          // Check if it's an error response
          if ((data as any)?.error) {
            setChatError(`Erro na instância "${selectedInstance}": ${(data as any).error}`);
            return;
          }
        }

        // Transform to our Chat interface
        const transformedChats: Chat[] = data
          .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us")) // Filter out groups for now
          .map((chat: any) => {
            // Get last message info from the chat object
            const lastMsg = chat.lastMessage;
            const lastMsgContent = lastMsg?.message?.conversation || 
                                   lastMsg?.message?.extendedTextMessage?.text || 
                                   lastMsg?.pushName || "";
            const lastMsgTime = lastMsg?.messageTimestamp;

            return {
              id: chat.id || chat.remoteJid,
              remoteJid: chat.remoteJid || chat.id,
              name: lastMsg?.pushName || chat.pushName || chat.name || formatPhoneFromJid(chat.remoteJid || chat.id),
              lastMessage: lastMsgContent.substring(0, 50) + (lastMsgContent.length > 50 ? "..." : ""),
              time: formatTime(lastMsgTime),
              unread: chat.unreadCount || 0,
              online: false,
              phone: formatPhoneFromJid(chat.remoteJid || chat.id),
            };
          })
          .slice(0, 50); // Limit to 50 chats

        setChats(transformedChats);
        setChatError(null);
        if (transformedChats.length > 0 && !selectedChat) {
          setSelectedChat(transformedChats[0]);
        }
      } catch (err) {
        console.error("[Chats] Error loading chats:", err);
        setChatError(`Não foi possível carregar conversas de "${selectedInstance}". Tente outra instância.`);
        toast({
          title: "Erro ao carregar conversas",
          description: `A instância "${selectedInstance}" retornou erro. Tente selecionar outra.`,
          variant: "destructive",
        });
      } finally {
        setLoadingChats(false);
      }
    };

    loadChats();
  }, [selectedInstance]);

  // Load messages when chat is selected
  useEffect(() => {
    if (!selectedInstance || !selectedChat) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await fetchMessages(selectedInstance, selectedChat.remoteJid, 100);
        console.log("[Chats] Raw messages data:", data);

        // Transform to our Message interface
        const transformedMessages: Message[] = data
          .map((msg) => {
            const { content, type } = extractMessageContent(msg);
            const timestamp = msg.messageTimestamp;
            const date = timestamp ? new Date(timestamp * 1000) : new Date();

            return {
              id: msg.key?.id || Math.random().toString(),
              content,
              time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              sent: msg.key?.fromMe || false,
              read: msg.status === "READ" || msg.status === "DELIVERY_ACK",
              type,
            };
          })
          .reverse(); // Most recent at bottom

        setMessages(transformedMessages);
      } catch (err) {
        console.error("[Chats] Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedInstance, selectedChat?.id]);

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

  const handleRefresh = async () => {
    if (!selectedInstance) return;
    setLoadingChats(true);
    const data = await fetchChats(selectedInstance);
    const transformedChats: Chat[] = data
      .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
      .map((chat: any) => {
        const lastMsg = chat.lastMessage;
        const lastMsgContent = lastMsg?.message?.conversation || 
                               lastMsg?.message?.extendedTextMessage?.text || "";
        const lastMsgTime = lastMsg?.messageTimestamp;

        return {
          id: chat.id || chat.remoteJid,
          remoteJid: chat.remoteJid || chat.id,
          name: lastMsg?.pushName || chat.pushName || chat.name || formatPhoneFromJid(chat.remoteJid || chat.id),
          lastMessage: lastMsgContent.substring(0, 50) + (lastMsgContent.length > 50 ? "..." : ""),
          time: formatTime(lastMsgTime),
          unread: chat.unreadCount || 0,
          online: false,
          phone: formatPhoneFromJid(chat.remoteJid || chat.id),
        };
      })
      .slice(0, 50);
    setChats(transformedChats);
    setLoadingChats(false);
    toast({
      title: "Conversas atualizadas",
      description: `${transformedChats.length} conversas carregadas.`,
    });
  };

  // No connected instance
  if (instances.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma conexão ativa</h2>
          <p className="text-muted-foreground mb-4">
            Conecte seu WhatsApp Business em Integrações para ver suas conversas.
          </p>
          <Button onClick={() => window.location.href = "/settings"}>
            Ir para Integrações
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-xl overflow-hidden border border-border bg-card">
      {/* Chat List */}
      <div className="w-96 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Conversas</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={loadingChats}
              >
                <RefreshCw className={cn("w-4 h-4", loadingChats && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Archive className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {instances.length >= 1 && (
            <select
              value={selectedInstance || ""}
              onChange={(e) => {
                setSelectedInstance(e.target.value);
                setChats([]);
                setSelectedChat(null);
                setChatError(null);
              }}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm"
            >
              {instances.map((inst) => (
                <option key={inst.instanceName} value={inst.instanceName}>
                  {inst.profileName || inst.instanceName}
                </option>
              ))}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chatError ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-destructive" />
              <p className="text-sm text-destructive mb-3">{chatError}</p>
              {instances.length > 1 && (
                <p className="text-xs text-muted-foreground">
                  Selecione outra instância acima.
                </p>
              )}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredChats.map((chat, index) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    selectedChat?.id === chat.id
                      ? "bg-secondary/10 border border-secondary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                      {chat.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                    </div>
                    {chat.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground truncate">{chat.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{chat.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{chat.phone}</p>
                  </div>
                  {chat.unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-xs text-white font-medium">{chat.unread}</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-sm">
                    {selectedChat.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  {selectedChat.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{selectedChat.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon">
                  <Phone className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Video className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <Star className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma mensagem encontrada</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {/* Date Divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground bg-card px-2">Mensagens recentes</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {messages.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.01 }}
                      className={cn("flex", msg.sent ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5",
                          msg.sent
                            ? "bg-secondary text-secondary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className={cn("flex items-center gap-1 mt-1", msg.sent ? "justify-end" : "justify-start")}>
                          <span className={cn("text-[10px]", msg.sent ? "text-secondary-foreground/70" : "text-muted-foreground")}>
                            {msg.time}
                          </span>
                          {msg.sent && (
                            msg.read ? (
                              <CheckCheck className="w-3 h-3 text-secondary-foreground/70" />
                            ) : (
                              <Check className="w-3 h-3 text-secondary-foreground/70" />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Smile className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Paperclip className="w-5 h-5" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="pr-20 bg-muted/50 border-transparent focus:border-secondary"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                      <Mic className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Button size="icon" className="bg-secondary hover:bg-secondary/90">
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
