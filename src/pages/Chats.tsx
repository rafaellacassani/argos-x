import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Star,
  Archive,
  Filter,
  RefreshCw,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useEvolutionAPI,
  type EvolutionMessage,
  type EvolutionInstance,
} from "@/hooks/useEvolutionAPI";
import { toast } from "@/hooks/use-toast";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";

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
  mediaUrl?: string;
  thumbnailBase64?: string;
  fileName?: string;
  duration?: number;
  localAudioBase64?: string; // For locally sent audio that can play immediately
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

// Helper to extract just the number from jid for sending
const extractNumberFromJid = (jid: string): string => {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
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

// Helper to extract message content with media URLs and thumbnails
const extractMessageContent = (msg: EvolutionMessage): { 
  content: string; 
  type: Message["type"]; 
  mediaUrl?: string;
  thumbnailBase64?: string;
  fileName?: string;
  duration?: number;
} => {
  // Text messages
  if (msg.message?.conversation) {
    return { content: msg.message.conversation, type: "text" };
  }
  if (msg.message?.extendedTextMessage?.text) {
    return { content: msg.message.extendedTextMessage.text, type: "text" };
  }
  
  // Interactive messages (buttons, etc.)
  if (msg.message?.interactiveMessage?.body?.text) {
    const footer = msg.message.interactiveMessage.footer?.text;
    let content = msg.message.interactiveMessage.body.text;
    if (footer) content += `\n\n${footer}`;
    return { content, type: "text" };
  }
  
  // Image messages - use thumbnail for preview
  if (msg.message?.imageMessage) {
    const thumbnail = msg.message.imageMessage.jpegThumbnail;
    return { 
      content: msg.message.imageMessage.caption || "", 
      type: "image",
      mediaUrl: msg.message.imageMessage.url || undefined,
      thumbnailBase64: thumbnail ? `data:image/jpeg;base64,${thumbnail}` : undefined
    };
  }
  
  // Video messages - use thumbnail for preview
  if (msg.message?.videoMessage) {
    const thumbnail = msg.message.videoMessage.jpegThumbnail;
    return { 
      content: msg.message.videoMessage.caption || "", 
      type: "video",
      mediaUrl: msg.message.videoMessage.url || undefined,
      thumbnailBase64: thumbnail ? `data:image/jpeg;base64,${thumbnail}` : undefined,
      duration: msg.message.videoMessage.seconds
    };
  }
  
  // Audio messages
  if (msg.message?.audioMessage) {
    return { 
      content: "", 
      type: "audio",
      mediaUrl: msg.message.audioMessage.url || undefined,
      duration: msg.message.audioMessage.seconds
    };
  }
  
  // Document messages
  if (msg.message?.documentMessage) {
    const thumbnail = msg.message.documentMessage.jpegThumbnail;
    return { 
      content: msg.message.documentMessage.fileName || "Documento", 
      type: "document",
      mediaUrl: msg.message.documentMessage.url || undefined,
      thumbnailBase64: thumbnail ? `data:image/jpeg;base64,${thumbnail}` : undefined,
      fileName: msg.message.documentMessage.fileName || undefined
    };
  }
  
  // Fallback
  return { content: msg.messageType || "Mensagem", type: "text" };
};

// Helper to convert File to base64 (returns pure base64, no data: prefix)
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:mime;base64, prefix - Evolution API expects pure base64
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to convert Blob to base64 (returns pure base64, no data: prefix)
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:mime;base64, prefix - Evolution API expects pure base64
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Helper to get media type from file
const getMediaType = (file: File): "image" | "video" | "document" => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
};

export default function Chats() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const { 
    listInstances, 
    fetchChats, 
    fetchMessages, 
    getConnectionState, 
    downloadMedia,
    sendText,
    sendMedia,
    sendAudio,
    loading: apiLoading 
  } = useEvolutionAPI();

  // Handler for downloading media
  const handleDownloadMedia = useCallback(async (messageId: string, convertToMp4 = false) => {
    if (!selectedInstance) return null;
    return downloadMedia(selectedInstance, messageId, convertToMp4);
  }, [selectedInstance, downloadMedia]);

  // Handler for sending text message
  const handleSendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!selectedInstance || !selectedChat) return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const success = await sendText(selectedInstance, number, text);
    
    if (success) {
      // Add message to local state optimistically
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        content: text,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
        type: "text",
      };
      setMessages((prev) => [...prev, newMessage]);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendText]);

  // Handler for sending media
  const handleSendMedia = useCallback(async (file: File, caption?: string): Promise<boolean> => {
    if (!selectedInstance || !selectedChat) return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const mediatype = getMediaType(file);
    const base64 = await fileToBase64(file);
    
    const success = await sendMedia(selectedInstance, number, mediatype, base64, caption, file.name);
    
    if (success) {
      // Add message to local state optimistically
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        content: caption || "",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
        type: mediatype,
        thumbnailBase64: mediatype === "image" ? base64 : undefined,
        fileName: file.name,
      };
      setMessages((prev) => [...prev, newMessage]);
      
      toast({
        title: "Mídia enviada",
        description: `${file.name} foi enviado com sucesso.`,
      });
    } else {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mídia.",
        variant: "destructive",
      });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendMedia]);

  // Handler for sending audio
  const handleSendAudio = useCallback(async (audioBlob: Blob): Promise<boolean> => {
    if (!selectedInstance || !selectedChat) return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const base64 = await blobToBase64(audioBlob);
    
    // Create data URL for local playback (with proper prefix)
    const reader = new FileReader();
    const localAudioDataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
    
    const success = await sendAudio(selectedInstance, number, base64);
    
    if (success) {
      // Add message to local state optimistically with audio data for playback
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        content: "",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
        type: "audio",
        localAudioBase64: localAudioDataUrl, // Include audio data for immediate playback
      };
      setMessages((prev) => [...prev, newMessage]);
      
      toast({
        title: "Áudio enviado",
        description: "Seu áudio foi enviado com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o áudio.",
        variant: "destructive",
      });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendAudio]);

  // Load connected instances on mount
  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      try {
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
      } finally {
        setLoadingInstances(false);
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
            const { content, type, mediaUrl, thumbnailBase64, fileName, duration } = extractMessageContent(msg);
            const timestamp = msg.messageTimestamp;
            const date = timestamp ? new Date(timestamp * 1000) : new Date();

            return {
              id: msg.key?.id || Math.random().toString(),
              content,
              time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              sent: msg.key?.fromMe || false,
              read: msg.status === "READ" || msg.status === "DELIVERY_ACK",
              type,
              mediaUrl,
              thumbnailBase64,
              fileName,
              duration,
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

  // Loading instances
  if (loadingInstances) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
          <p className="text-muted-foreground">Carregando conexões...</p>
        </div>
      </div>
    );
  }

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
                    <MessageBubble
                      key={msg.id}
                      id={msg.id}
                      content={msg.content}
                      time={msg.time}
                      sent={msg.sent}
                      read={msg.read}
                      type={msg.type}
                      mediaUrl={msg.mediaUrl}
                      thumbnailBase64={msg.thumbnailBase64}
                      fileName={msg.fileName}
                      duration={msg.duration}
                      localAudioBase64={msg.localAudioBase64}
                      index={index}
                      onDownloadMedia={handleDownloadMedia}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Chat Input */}
            <ChatInput
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onSendAudio={handleSendAudio}
              disabled={apiLoading}
            />
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
