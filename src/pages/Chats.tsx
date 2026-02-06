import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Star,
  Archive,
  RefreshCw,
  MessageCircle,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useEvolutionAPI,
  type EvolutionMessage,
  type EvolutionInstance,
} from "@/hooks/useEvolutionAPI";
import { useMetaChat, type MetaPage, type MetaConversation } from "@/hooks/useMetaChat";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useTagRules } from "@/hooks/useTagRules";
import { toast } from "@/hooks/use-toast";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatTagManager } from "@/components/chat/ChatTagManager";
import { ChatFilters, countActiveFilters, type ChatFiltersFormData } from "@/components/chat/ChatFilters";

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
  lastMessageFromMe: boolean;
  instanceName?: string; // Source instance for "All" mode
  instanceLabel?: string; // Display name of source instance
  // Meta-specific fields
  isMeta?: boolean;
  metaPageId?: string;
  metaSenderId?: string;
  metaPlatform?: string;
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

// Helper to format Meta timestamp (ISO string)
const formatMetaTime = (isoString: string): string => {
  const date = new Date(isoString);
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
  const [activeFilters, setActiveFilters] = useState<ChatFiltersFormData | null>(null);
  
  // Load leads data for filters and auto-create leads
  const { stages, tags, leads, createLead, addTagToLead, removeTagFromLead, createTag } = useLeads();
  
  // Load tag rules for auto-tagging
  const { rules: tagRules, checkMessageAgainstRules } = useTagRules();

  // Meta chat hook
  const {
    metaPages,
    conversations: metaConversations,
    messages: metaMessages,
    loading: metaLoading,
    fetchConversations: fetchMetaConversations,
    fetchMessages: fetchMetaMessages,
    sendMessage: sendMetaMessage,
    subscribeToRealtime,
  } = useMetaChat();

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
    // Use chat's instance if in "all" mode, otherwise use selectedInstance
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return null;
    return downloadMedia(targetInstance, messageId, convertToMp4);
  }, [selectedInstance, selectedChat, downloadMedia]);

  // Handler for sending text message
  const handleSendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!selectedChat) return false;

    // Meta chat - send via Graph API
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      const success = await sendMetaMessage(selectedChat.metaPageId, selectedChat.metaSenderId, text);
      if (success) {
        const newMessage: Message = {
          id: `local-${Date.now()}`,
          content: text,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          sent: true,
          read: false,
          type: "text",
        };
        setMessages((prev) => [...prev, newMessage]);
      } else {
        toast({ title: "Erro ao enviar", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
      }
      return success;
    }

    // WhatsApp chat - send via Evolution API
    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const success = await sendText(targetInstance, number, text);
    
    if (success) {
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        content: text,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
        type: "text",
      };
      setMessages((prev) => [...prev, newMessage]);
    } else {
      toast({ title: "Erro ao enviar", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendText, sendMetaMessage]);

  // Handler for sending media
  const handleSendMedia = useCallback(async (file: File, caption?: string): Promise<boolean> => {
    // Use chat's instance if in "all" mode, otherwise use selectedInstance
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const mediatype = getMediaType(file);
    const base64 = await fileToBase64(file);
    
    const success = await sendMedia(targetInstance, number, mediatype, base64, caption, file.name);
    
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
    } else {
      toast({
        title: "Erro ao enviar mídia",
        description: `Não foi possível enviar ${file.name}.`,
        variant: "destructive",
      });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendMedia]);

  // Handler for sending audio
  const handleSendAudio = useCallback(async (audioBlob: Blob): Promise<boolean> => {
    // Use chat's instance if in "all" mode, otherwise use selectedInstance
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return false;
    
    const number = extractNumberFromJid(selectedChat.remoteJid);
    const base64 = await blobToBase64(audioBlob);
    
    // Create data URL for local playback (with proper prefix)
    const reader = new FileReader();
    const localAudioDataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
    
    const success = await sendAudio(targetInstance, number, base64);
    
    if (success) {
      // Add message to local state optimistically with audio data for playback
      const newMessage: Message = {
        id: `local-${Date.now()}`,
        content: "",
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        sent: true,
        read: false,
        type: "audio",
        localAudioBase64: localAudioDataUrl,
      };
      setMessages((prev) => [...prev, newMessage]);
    } else {
      toast({
        title: "Erro ao enviar áudio",
        description: "Não foi possível enviar o áudio.",
        variant: "destructive",
      });
    }
    
    return success;
  }, [selectedInstance, selectedChat, sendAudio]);

  // Load connected instances on mount (WhatsApp + Meta)
  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      let connectedInstances: EvolutionInstance[] = [];
      try {
        const data = await listInstances();
        for (const instance of data) {
          const state = await getConnectionState(instance.instanceName);
          if (state?.instance?.state === "open") {
            connectedInstances.push({ ...instance, connectionStatus: "open" });
          }
        }
      } catch (err) {
        console.warn("[Chats] Evolution API indisponível:", err);
        toast({
          title: "WhatsApp indisponível",
          description: "Não foi possível conectar ao servidor WhatsApp. Conversas Meta continuam disponíveis.",
          variant: "destructive",
        });
      }

      setInstances(connectedInstances);

      const totalSources = connectedInstances.length + metaPages.length;
      if (totalSources > 1) {
        setSelectedInstance("all");
      } else if (connectedInstances.length === 1) {
        setSelectedInstance(connectedInstances[0].instanceName);
      } else if (metaPages.length === 1) {
        setSelectedInstance(`meta:${metaPages[0].id}`);
      }

      setLoadingInstances(false);
    };
    loadInstances();
  }, [metaPages.length]);

  // Helper function to transform raw chat data
  const transformChatData = useCallback((chat: any, instanceName?: string, instanceLabel?: string): Chat => {
    const lastMsg = chat.lastMessage;
    const lastMsgContent = lastMsg?.message?.conversation || 
                           lastMsg?.message?.extendedTextMessage?.text || 
                           lastMsg?.pushName || "";
    const lastMsgTime = lastMsg?.messageTimestamp;
    const lastMsgFromMe = lastMsg?.key?.fromMe ?? false;
    
    // Only use pushName from last message if it was sent by the CLIENT (fromMe = false)
    const contactPushName = (lastMsgFromMe === false) ? lastMsg?.pushName : undefined;
    
    return {
      id: chat.id || chat.remoteJid,
      remoteJid: chat.remoteJid || chat.id,
      name: contactPushName || chat.pushName || chat.name || formatPhoneFromJid(chat.remoteJid || chat.id),
      lastMessage: lastMsgContent.substring(0, 50) + (lastMsgContent.length > 50 ? "..." : ""),
      time: formatTime(lastMsgTime),
      unread: chat.unreadCount || 0,
      online: false,
      phone: formatPhoneFromJid(chat.remoteJid || chat.id),
      lastMessageFromMe: lastMsgFromMe,
      instanceName,
      instanceLabel,
      // Store raw timestamp for sorting
      _timestamp: lastMsgTime || 0,
    } as Chat & { _timestamp: number };
  }, []);

  // Ref to track leads for auto-creation without causing re-renders
  const leadsRef = useRef(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);
  
  // Ref to track which JIDs we've already processed for lead creation
  const processedJidsRef = useRef<Set<string>>(new Set());

  // Load chats when instance is selected
  useEffect(() => {
    if (!selectedInstance) return;

    const loadChats = async () => {
      setLoadingChats(true);
      setChatError(null);
      try {
        let allChats: (Chat & { _timestamp?: number })[] = [];

        const isMetaSource = selectedInstance.startsWith("meta:");
        
        if (isMetaSource) {
          // Load Meta conversations only
          const metaPageId = selectedInstance.replace("meta:", "");
          const convs = await fetchMetaConversations(metaPageId);
          allChats = (convs || []).map((conv) => ({
            id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
            remoteJid: conv.sender_id,
            name: conv.sender_name || conv.sender_id,
            lastMessage: conv.last_message,
            time: formatMetaTime(conv.last_timestamp),
            unread: conv.unread_count,
            online: false,
            phone: conv.sender_id,
            lastMessageFromMe: false,
            isMeta: true,
            metaPageId: conv.meta_page_id,
            metaSenderId: conv.sender_id,
            metaPlatform: conv.platform,
            instanceLabel: conv.page_name || conv.platform,
            _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
          }));
        } else if (selectedInstance === "all") {
          // Fetch from ALL WhatsApp instances in parallel
          const promises = instances.map(async (inst) => {
            try {
              const data = await fetchChats(inst.instanceName);
              if (!Array.isArray(data)) return [];
              return data
                .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
                .map((chat: any) => transformChatData(
                  chat, 
                  inst.instanceName, 
                  inst.profileName || inst.instanceName
                ));
            } catch (err) {
              console.error(`[Chats] Error fetching from ${inst.instanceName}:`, err);
              return [];
            }
          });
          
          const results = await Promise.all(promises);
          allChats = results.flat();

          // Also fetch Meta conversations
          if (metaPages.length > 0) {
            try {
              const metaConvs = await fetchMetaConversations();
              const metaChats = (metaConvs || []).map((conv) => ({
                id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
                remoteJid: conv.sender_id,
                name: conv.sender_name || conv.sender_id,
                lastMessage: conv.last_message,
                time: formatMetaTime(conv.last_timestamp),
                unread: conv.unread_count,
                online: false,
                phone: conv.sender_id,
                lastMessageFromMe: false,
                isMeta: true,
                metaPageId: conv.meta_page_id,
                metaSenderId: conv.sender_id,
                metaPlatform: conv.platform,
                instanceLabel: conv.page_name || conv.platform,
                _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
              }));
              allChats = [...allChats, ...metaChats];
            } catch (err) {
              console.error("[Chats] Error fetching Meta conversations:", err);
            }
          }
          
          // Sort by timestamp (most recent first)
          allChats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
          allChats = allChats.slice(0, 100);
          
        } else {
          // Fetch from single WhatsApp instance
          const data = await fetchChats(selectedInstance);
          if (!Array.isArray(data) || data.length === 0) {
            if ((data as any)?.error) {
              setChatError(`Erro na instância "${selectedInstance}": ${(data as any).error}`);
              return;
            }
          }

          allChats = data
            .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
            .map((chat: any) => transformChatData(chat))
            .slice(0, 50);
        }

        setChats(allChats);
        setChatError(null);
        if (allChats.length > 0 && !selectedChat) {
          setSelectedChat(allChats[0]);
        }
        
        // Auto-create leads for new WhatsApp conversations (skip Meta for now)
        const currentLeads = leadsRef.current;
        const chatsNeedingLeads = allChats.filter((chat) => {
          if (chat.isMeta) return false; // Skip Meta chats for auto-lead
          if (processedJidsRef.current.has(chat.remoteJid)) return false;
          if (chat.lastMessageFromMe) return false;
          const existingLead = currentLeads.find((lead) => lead.whatsapp_jid === chat.remoteJid);
          return !existingLead;
        });
        
        if (chatsNeedingLeads.length > 0) {
          console.log(`[Chats] Auto-creating ${chatsNeedingLeads.length} leads`);
          for (const chat of chatsNeedingLeads) {
            try {
              processedJidsRef.current.add(chat.remoteJid);
              const newLead = await createLead({
                name: chat.name,
                phone: chat.phone,
                whatsapp_jid: chat.remoteJid,
                instance_name: chat.instanceName,
                source: 'whatsapp',
              });
              if (newLead && chat.lastMessage && tagRules.length > 0) {
                const matchingTagIds = checkMessageAgainstRules(chat.lastMessage);
                for (const tagId of matchingTagIds) {
                  await addTagToLead(newLead.id, tagId);
                }
              }
            } catch (err) {
              console.error(`[Chats] Error creating lead for ${chat.remoteJid}:`, err);
              processedJidsRef.current.delete(chat.remoteJid);
            }
          }
        }
      } catch (err) {
        console.error("[Chats] Error loading chats:", err);
        setChatError(`Não foi possível carregar conversas. Tente novamente.`);
        toast({ title: "Erro ao carregar conversas", description: "Tente novamente.", variant: "destructive" });
      } finally {
        setLoadingChats(false);
      }
    };

    loadChats();
  }, [selectedInstance, instances, metaPages, transformChatData, createLead, tagRules, checkMessageAgainstRules, addTagToLead, fetchMetaConversations]);

  // Load messages when chat is selected
  useEffect(() => {
    if (!selectedChat) return;

    // Meta chat - load from meta_conversations
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      const loadMetaMsgs = async () => {
        setLoadingMessages(true);
        try {
          const msgs = await fetchMetaMessages(selectedChat.metaPageId!, selectedChat.metaSenderId!);
          const transformed: Message[] = (msgs || []).map((msg) => {
            const date = new Date(msg.timestamp);
            return {
              id: msg.id,
              content: msg.content || "",
              time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              sent: msg.direction === "outbound",
              read: true,
              type: (msg.message_type === "image" ? "image" : msg.message_type === "video" ? "video" : msg.message_type === "audio" ? "audio" : "text") as Message["type"],
              mediaUrl: msg.media_url || undefined,
            };
          });
          setMessages(transformed);
        } catch (err) {
          console.error("[Chats] Error loading Meta messages:", err);
        } finally {
          setLoadingMessages(false);
        }
      };
      loadMetaMsgs();
      return;
    }
    
    // WhatsApp chat - load via Evolution API
    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await fetchMessages(targetInstance, selectedChat.remoteJid, 100);
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
          .reverse();
        setMessages(transformedMessages);
      } catch (err) {
        console.error("[Chats] Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedInstance, selectedChat?.id, selectedChat?.instanceName, selectedChat?.isMeta, fetchMetaMessages]);

  // Subscribe to Meta realtime updates
  useEffect(() => {
    if (metaPages.length === 0) return;
    const metaPageId = selectedChat?.metaPageId;
    const senderId = selectedChat?.metaSenderId;
    const unsub = subscribeToRealtime(metaPageId, senderId);
    return unsub;
  }, [metaPages, selectedChat?.metaPageId, selectedChat?.metaSenderId, subscribeToRealtime]);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    if (!activeFilters) return 0;
    return countActiveFilters(activeFilters);
  }, [activeFilters]);

  // Handle filters change
  const handleFiltersChange = useCallback((filters: ChatFiltersFormData) => {
    setActiveFilters(filters);
  }, []);

  // Apply filters to chats
  const filteredChats = useMemo(() => {
    let result = chats.filter((chat) =>
      chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.phone.includes(searchTerm)
    );

    // Apply additional filters if active
    if (activeFilters) {
      // Filter by lead search
      if (activeFilters.leadSearch) {
        const searchLower = activeFilters.leadSearch.toLowerCase();
        result = result.filter(
          (chat) =>
            chat.name.toLowerCase().includes(searchLower) ||
            chat.phone.includes(activeFilters.leadSearch!)
        );
      }

      // Filter by participant search
      if (activeFilters.participantSearch) {
        const searchLower = activeFilters.participantSearch.toLowerCase();
        result = result.filter((chat) =>
          chat.name.toLowerCase().includes(searchLower)
        );
      }

      // Filter by response status
      // "answered" = last message was from team (fromMe = true)
      // "awaiting" = last message was from client (fromMe = false) - waiting for team response
      // "unanswered" = has unread messages and last was from client
      if (activeFilters.responseStatus && activeFilters.responseStatus.length > 0) {
        const statuses = activeFilters.responseStatus;
        console.log(`[Chats] Applying filter with statuses: ${statuses.join(', ')}`);
        console.log(`[Chats] Before filter: ${result.length} chats`);
        
        result = result.filter((chat) => {
          // If "answered" is selected: show chats where last message was from team
          if (statuses.includes("answered") && chat.lastMessageFromMe === true) {
            return true;
          }
          
          // If "awaiting" is selected: show chats where last message was from client (awaiting team response)
          if (statuses.includes("awaiting") && chat.lastMessageFromMe === false) {
            return true;
          }
          
          // If "unanswered" is selected: show chats where last message was from client (regardless of read status)
          if (statuses.includes("unanswered") && chat.lastMessageFromMe === false) {
            return true;
          }
          
          return false;
        });
        
        console.log(`[Chats] After filter: ${result.length} chats`);
      }

      // Filter by last message sender
      if (activeFilters.lastMessageSender && activeFilters.lastMessageSender !== "any") {
        result = result.filter((chat) => {
          if (activeFilters.lastMessageSender === "client") {
            return !chat.lastMessageFromMe;
          }
          if (activeFilters.lastMessageSender === "team") {
            return chat.lastMessageFromMe;
          }
          return true;
        });
      }
      
      // Note: Other filters (stages, tags, etc.) would need lead data correlation
      // This is a simplified implementation that can be extended
    }

    return result;
  }, [chats, searchTerm, activeFilters]);

  const handleRefresh = async () => {
    if (!selectedInstance) return;
    setLoadingChats(true);
    
    try {
      let allChats: (Chat & { _timestamp?: number })[] = [];
      
      if (selectedInstance === "all") {
        // Refresh all instances in parallel
        const promises = instances.map(async (inst) => {
          try {
            const data = await fetchChats(inst.instanceName);
            if (!Array.isArray(data)) return [];
            return data
              .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
              .map((chat: any) => transformChatData(
                chat,
                inst.instanceName,
                inst.profileName || inst.instanceName
              ));
          } catch (err) {
            console.error(`[Chats] Error refreshing ${inst.instanceName}:`, err);
            return [];
          }
        });
        
        const results = await Promise.all(promises);
        allChats = results.flat();
        allChats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
        allChats = allChats.slice(0, 100);
      } else {
        // Refresh single instance
        const data = await fetchChats(selectedInstance);
        allChats = data
          .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
          .map((chat: any) => transformChatData(chat))
          .slice(0, 50);
      }
      
      setChats(allChats);
      toast({
        title: "Conversas atualizadas",
        description: `${allChats.length} conversas carregadas.`,
      });
    } catch (err) {
      console.error("[Chats] Error refreshing chats:", err);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar as conversas.",
        variant: "destructive",
      });
    } finally {
      setLoadingChats(false);
    }
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

  // No connected instance and no Meta pages
  if (instances.length === 0 && metaPages.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma conexão ativa</h2>
          <p className="text-muted-foreground mb-4">
            Conecte seu WhatsApp Business ou Meta em Integrações para ver suas conversas.
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
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg">Conversas</h2>
              <Button
                variant={activeFilters?.responseStatus?.includes("unanswered") ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs font-medium rounded-full",
                  activeFilters?.responseStatus?.includes("unanswered")
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "border-destructive/50 text-destructive hover:bg-destructive/10"
                )}
                onClick={() => {
                  const isActive = activeFilters?.responseStatus?.includes("unanswered");
                  if (isActive) {
                    // Clear the filter
                    const newFilters = {
                      ...activeFilters,
                      responseStatus: [],
                    } as ChatFiltersFormData;
                    setActiveFilters(newFilters);
                    // Update URL
                    const params = new URLSearchParams(window.location.search);
                    params.delete("responseStatus");
                    window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`);
                  } else {
                    // Apply unanswered filter
                    const newFilters = {
                      ...(activeFilters || {
                        periodPreset: "any",
                        stageIds: [],
                        starred: false,
                        responseStatus: [],
                        interactionStatus: "",
                        chatSource: [],
                        responsibleUser: "",
                        leadSearch: "",
                        participantSearch: "",
                        lastMessageSender: "any",
                        tagIds: [],
                      }),
                      responseStatus: ["unanswered"],
                    } as ChatFiltersFormData;
                    setActiveFilters(newFilters);
                    // Update URL
                    const params = new URLSearchParams(window.location.search);
                    params.set("responseStatus", "unanswered");
                    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
                  }
                }}
              >
                Sem resposta
              </Button>
            </div>
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
              <ChatFilters
                stages={stages}
                tags={tags}
                onFiltersChange={handleFiltersChange}
                activeFiltersCount={activeFiltersCount}
              />
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Archive className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {(instances.length + metaPages.length) >= 1 && (
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
              {/* "Todos" option when multiple sources */}
              {(instances.length + metaPages.length) > 1 && (
                <option value="all">
                  Todos ({instances.length + metaPages.length} conexões)
                </option>
              )}
              {instances.map((inst) => (
                <option key={inst.instanceName} value={inst.instanceName}>
                  📱 {inst.profileName || inst.instanceName}
                </option>
              ))}
              {metaPages.map((page) => (
                <option key={page.id} value={`meta:${page.id}`}>
                  {page.platform === "instagram" ? "📸" : "💬"} {page.page_name}
                  {page.instagram_username ? ` (@${page.instagram_username})` : ""}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground truncate flex-1">{chat.phone}</p>
                      {/* Show source badge */}
                      {chat.isMeta && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 truncate max-w-[80px]">
                          {chat.metaPlatform === "instagram" ? "📸 IG" : chat.metaPlatform === "whatsapp_business" ? "📱 WABA" : "💬 FB"}
                        </span>
                      )}
                      {selectedInstance === "all" && !chat.isMeta && chat.instanceLabel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate max-w-[80px]">
                          {chat.instanceLabel}
                        </span>
                      )}
                    </div>
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
            <div className="px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
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
              {/* Tags Section */}
              {(() => {
                const currentLead = leads.find((l) => l.whatsapp_jid === selectedChat.remoteJid);
                if (currentLead) {
                  return (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <ChatTagManager
                        lead={currentLead}
                        allTags={tags}
                        onAddTag={addTagToLead}
                        onRemoveTag={removeTagFromLead}
                        onCreateTag={createTag}
                      />
                    </div>
                  );
                }
                return null;
              })()}
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
