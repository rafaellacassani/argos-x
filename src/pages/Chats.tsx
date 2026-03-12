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
import { ScheduleMessagePopover } from "@/components/chat/ScheduleMessagePopover";
import { LeadSidePanel } from "@/components/chat/LeadSidePanel";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

interface Chat {
  id: string;
  remoteJid: string;
  remoteJidAlt?: string; // Real phone JID when remoteJid is a @lid
  name: string;
  avatar?: string;
  profilePicUrl?: string;
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

// Helper to clean phone string: remove JID suffixes and non-digit chars
const cleanPhoneNumber = (phone: string): string => {
  return phone
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/[^0-9]/g, "");
};

// Helper to format a cleaned numeric phone string for display
const formatPhoneDisplay = (digits: string): string => {
  if (!digits || digits.length < 4) return digits;
  // Reject internal WhatsApp IDs (JIDs with >13 digits are not real phone numbers)
  if (digits.length > 13) return "";
  // Brazilian numbers (country code 55)
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
    if (rest.length === 8) {
      return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  // Generic international
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  return digits;
};

// Helper to format phone from jid - handles @s.whatsapp.net, @g.us, and @lid formats
const formatPhoneFromJid = (jid: string): string => {
  const digits = cleanPhoneNumber(jid);
  return formatPhoneDisplay(digits);
};

// Helper to extract just the number from jid for sending
const extractNumberFromJid = (jid: string): string => {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "").replace(/@lid$/, "");
};

// Helper to resolve the best phone number for sending messages
// Prefers the lead's phone over extracting from JID (which may be a LID, not a real number)
const resolveRecipientNumber = (chat: Chat): string => {
  if (chat.remoteJid.endsWith("@lid")) {
    // 1) Try chat.phone (from lead data)
    const cleaned = chat.phone.replace(/[^0-9]/g, "");
    if (cleaned.length >= 10) return cleaned;
    // 2) Try remoteJidAlt (real phone JID from message key)
    if (chat.remoteJidAlt) {
      const altCleaned = extractNumberFromJid(chat.remoteJidAlt);
      if (altCleaned.length >= 10) return altCleaned;
    }
    // 3) No valid phone found — return empty to prevent sending to LID
    console.warn("[resolveRecipientNumber] No valid phone for LID chat:", chat.remoteJid);
    return "";
  }
  return extractNumberFromJid(chat.remoteJid);
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
  
  // Template messages (WA Business)
  if (msg.message?.templateMessage) {
    const tpl = msg.message.templateMessage as Record<string, any>;
    const text =
      tpl.hydratedTemplate?.hydratedContentText ||
      tpl.hydratedFourRowTemplate?.hydratedContentText ||
      tpl.hydratedTemplate?.hydratedTitleText ||
      tpl.hydratedFourRowTemplate?.hydratedTitleText ||
      "";
    return { content: text || "📋 Mensagem de template", type: "text" };
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

  // Sticker messages
  if (msg.message?.stickerMessage) {
    return { content: "🏷️ Figurinha", type: "text" };
  }

  // Friendly fallbacks for known but unrenderable types
  const m = msg.message as Record<string, any> | undefined;
  if (m) {
    if (m.locationMessage) {
      const loc = m.locationMessage;
      const label = loc.name || loc.address || "";
      return { content: `📍 Localização compartilhada${label ? `: ${label}` : ""}`, type: "text" };
    }
    if (m.contactMessage || m.contactsArrayMessage) {
      const name = m.contactMessage?.displayName || "";
      return { content: `👤 Contato compartilhado${name ? `: ${name}` : ""}`, type: "text" };
    }
    if (m.listMessage) {
      return { content: m.listMessage.description || m.listMessage.title || "📋 Mensagem com lista de opções", type: "text" };
    }
    if (m.listResponseMessage) {
      return { content: m.listResponseMessage.title || m.listResponseMessage.description || "✅ Resposta de lista", type: "text" };
    }
    if (m.buttonsMessage) {
      return { content: m.buttonsMessage.contentText || "📋 Mensagem com botões", type: "text" };
    }
    if (m.buttonsResponseMessage) {
      return { content: m.buttonsResponseMessage.selectedDisplayText || "✅ Resposta de botão", type: "text" };
    }
    if (m.reactionMessage) {
      return { content: m.reactionMessage.text || "❤️", type: "text" };
    }
    if (m.liveLocationMessage) {
      return { content: "📍 Localização em tempo real", type: "text" };
    }
    if (m.viewOnceMessage || m.viewOnceMessageV2) {
      return { content: "🔒 Mensagem visualização única", type: "text" };
    }
    if (m.pollCreationMessage || m.pollCreationMessageV3) {
      const poll = m.pollCreationMessage || m.pollCreationMessageV3;
      return { content: `📊 Enquete: ${poll.name || ""}`, type: "text" };
    }
    if (m.pollUpdateMessage) {
      return { content: "📊 Voto em enquete", type: "text" };
    }
    if (m.orderMessage) {
      return { content: "🛒 Pedido recebido", type: "text" };
    }
    if (m.productMessage) {
      return { content: "🛍️ Produto compartilhado", type: "text" };
    }
    if (m.protocolMessage || m.senderKeyDistributionMessage || m.messageContextInfo) {
      // System/protocol messages — skip silently
      return { content: "", type: "text" };
    }
  }
  
  // Final fallback — show friendly text instead of raw type
  const rawType = msg.messageType || "";
  if (rawType) {
    return { content: `💬 ${rawType.replace(/Message$/i, "").replace(/([A-Z])/g, " $1").trim()}`, type: "text" };
  }
  return { content: "Mensagem", type: "text" };
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
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ChatFiltersFormData | null>(null);
  
  // Message cache: stores messages per chat ID to avoid re-fetching
  const messageCacheRef = useRef<Map<string, Message[]>>(new Map());
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Load leads data for filters and auto-create leads
  const { stages, tags, leads, createLead, createLeadSilent, addTagToLead, removeTagFromLead, createTag, updateLead, moveLead, deleteLead } = useLeads();
  const { isSeller, userProfileId } = useUserRole();
  const { workspaceId } = useWorkspace();
  const [leadPanelOpen, setLeadPanelOpen] = useState(true);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadModalLead, setLeadModalLead] = useState<any>(null);
  
  // Load tag rules for auto-tagging
  const { rules: tagRules, checkMessageAgainstRules } = useTagRules();

  // Auto-assign lead to current user on first interaction
  const autoAssignLead = useCallback(async (chat: Chat | null) => {
    if (!chat || !userProfileId) return;
    const stripDigits = (s: string) => s.replace(/[^0-9]/g, "");
    const chatDigits = stripDigits(chat.phone || "");
    const matchingLead = leadsRef.current.find((l) => {
      if (l.whatsapp_jid === chat.remoteJid) return true;
      if (chat.remoteJidAlt && l.whatsapp_jid === chat.remoteJidAlt) return true;
      if (chatDigits.length >= 10) {
        const leadDigits = stripDigits(l.phone || "");
        if (leadDigits.length >= 10 && (leadDigits.endsWith(chatDigits.slice(-10)) || chatDigits.endsWith(leadDigits.slice(-10)))) return true;
      }
      return false;
    });
    if (matchingLead && !matchingLead.responsible_user) {
      await updateLead(matchingLead.id, { responsible_user: userProfileId });
    }
  }, [userProfileId, updateLead]);

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
    fetchProfile,
    fetchProfilesBatch,
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
        setMessages((prev) => {
          const updated = [...prev, newMessage];
          messageCacheRef.current.set(selectedChat.id, updated);
          return updated;
        });
      } else {
        toast({ title: "Erro ao enviar", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
      }
      return success;
    }

    // WhatsApp chat - send via Evolution API
    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return false;
    
    const number = resolveRecipientNumber(selectedChat);
    if (!number) {
      toast({ title: "Número não encontrado", description: "Não foi possível identificar o número deste contato. Atualize o telefone no painel do lead.", variant: "destructive" });
      return false;
    }
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
      setMessages((prev) => {
        const updated = [...prev, newMessage];
        if (selectedChat) messageCacheRef.current.set(selectedChat.id, updated);
        return updated;
      });
    } else {
      toast({ title: "Erro ao enviar", description: "Não foi possível enviar a mensagem.", variant: "destructive" });
    }
    
    if (success) {
      autoAssignLead(selectedChat);
      // Fire-and-forget: persist outbound WA message for dashboard metrics
      // Use lead's whatsapp_jid if available so inbound+outbound share the same remote_jid
      if (workspaceId && !selectedChat.isMeta) {
        const stripDigitsOut = (s: string) => s.replace(/[^0-9]/g, "");
        const chatDigitsOut = stripDigitsOut(selectedChat.phone || "");
        const outboundLead = leadsRef.current.find((l) => {
          if (l.whatsapp_jid === selectedChat.remoteJid) return true;
          if (selectedChat.remoteJidAlt && l.whatsapp_jid === selectedChat.remoteJidAlt) return true;
          if (chatDigitsOut.length >= 10) {
            const ld = stripDigitsOut(l.phone || "");
            return ld.length >= 10 && ld.slice(-10) === chatDigitsOut.slice(-10);
          }
          return false;
        });
        const outboundJid = outboundLead?.whatsapp_jid || selectedChat.remoteJid;
        supabase.from('whatsapp_messages').insert({
          workspace_id: workspaceId,
          instance_name: selectedChat.instanceName || selectedInstance || '',
          remote_jid: outboundJid,
          from_me: true,
          direction: 'outbound',
          content: text,
          message_type: 'text',
          timestamp: new Date().toISOString(),
        }).then(() => {});
        
        // CORREÇÃO 2: Log message sent to lead_history
        const stripDigits = (s: string) => s.replace(/[^0-9]/g, "");
        const chatDigits = stripDigits(selectedChat.phone || "");
        const matchingLead = leadsRef.current.find((l) => {
          if (l.whatsapp_jid === selectedChat.remoteJid) return true;
          if (selectedChat.remoteJidAlt && l.whatsapp_jid === selectedChat.remoteJidAlt) return true;
          if (chatDigits.length >= 10) {
            const leadDigits = stripDigits(l.phone || "");
            return leadDigits.length >= 10 && (leadDigits.endsWith(chatDigits.slice(-10)) || chatDigits.endsWith(leadDigits.slice(-10)));
          }
          return false;
        });
        if (matchingLead && userProfileId) {
          supabase.from('lead_history').insert({
            lead_id: matchingLead.id,
            action: 'whatsapp_message_sent',
            performed_by: userProfileId,
            workspace_id: workspaceId,
            metadata: {
              instance_name: selectedChat.instanceName || selectedInstance || '',
              remote_jid: selectedChat.remoteJid,
              preview: text.substring(0, 80),
            },
          }).then(() => {});
        }
      }
    }
    return success;
  }, [selectedInstance, selectedChat, sendText, sendMetaMessage, autoAssignLead, workspaceId]);

  // Handler for sending media
  const handleSendMedia = useCallback(async (file: File, caption?: string): Promise<boolean> => {
    // Use chat's instance if in "all" mode, otherwise use selectedInstance
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return false;
    
    const mediatype = getMediaType(file);
    const base64 = await fileToBase64(file);
    const number = resolveRecipientNumber(selectedChat);
    if (!number) {
      toast({ title: "Número não encontrado", description: "Não foi possível identificar o número deste contato. Atualize o telefone no painel do lead.", variant: "destructive" });
      return false;
    }
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
    
    if (success) autoAssignLead(selectedChat);
    return success;
  }, [selectedInstance, selectedChat, sendMedia, autoAssignLead]);

  // Handler for sending audio
  const handleSendAudio = useCallback(async (audioBlob: Blob): Promise<boolean> => {
    // Use chat's instance if in "all" mode, otherwise use selectedInstance
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return false;
    
    const number = resolveRecipientNumber(selectedChat);
    if (!number) {
      toast({ title: "Número não encontrado", description: "Não foi possível identificar o número deste contato. Atualize o telefone no painel do lead.", variant: "destructive" });
      return false;
    }
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
    
    if (success) autoAssignLead(selectedChat);
    return success;
  }, [selectedInstance, selectedChat, sendAudio, autoAssignLead]);

  // Load connected instances on mount (WhatsApp + Meta)
  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      let connectedInstances: EvolutionInstance[] = [];
      try {
        const data = await listInstances();
        const stateResults: Array<{ instance: EvolutionInstance; state: { instance: { instanceName: string; state: "open" | "close" | "connecting" } } | null }> = [];
        // Parallelize state checks instead of sequential delays
        const statePromises = data.map(async (instance) => {
          try {
            const state = await getConnectionState(instance.instanceName);
            return { instance, state };
          } catch {
            return { instance, state: { instance: { instanceName: instance.instanceName, state: "open" as const } } };
          }
        });
        const settledResults = await Promise.all(statePromises);
        // Include ALL instances regardless of connection state
        connectedInstances = settledResults.map(({ instance, state }) => ({
          ...instance,
          connectionStatus: (state?.instance?.state || "connecting") as "open" | "connecting" | "close",
        }));
      } catch (err) {
        console.warn("[Chats] Evolution API indisponível:", err);
        // Even if Evolution API is completely down, try to load instances from local DB
        // so chats don't vanish
        try {
          const { data: localInstances } = await supabase
            .from('whatsapp_instances')
            .select('instance_name, display_name')
            .neq('instance_type', 'alerts');
          if (localInstances && localInstances.length > 0) {
            connectedInstances = localInstances.map(inst => ({
              instanceName: inst.instance_name,
              connectionStatus: "open" as const,
            }));
          }
        } catch {
          // silently fail
        }
        if (connectedInstances.length === 0) {
          toast({
            title: "WhatsApp indisponível",
            description: "Não foi possível conectar ao servidor WhatsApp. Conversas Meta continuam disponíveis.",
            variant: "destructive",
          });
        }
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
                           lastMsg?.message?.extendedTextMessage?.text || "";
    const lastMsgTime = lastMsg?.messageTimestamp;
    const lastMsgFromMe = lastMsg?.key?.fromMe ?? false;
    
    // Resolve contact name: try pushName from last inbound message, then chat-level pushName, then name
    const contactPushName = (lastMsgFromMe === false) ? lastMsg?.pushName : undefined;
    const resolvedName = contactPushName || chat.pushName || chat.name || null;
    const jid = chat.remoteJid || chat.id;
    // Extract remoteJidAlt from last message key (real phone for @lid chats)
    const remoteJidAlt = lastMsg?.key?.remoteJidAlt || chat.remoteJidAlt || undefined;
    
    // Check if there's a matching lead with a proper name
    // O(1) lead lookup via maps instead of O(N) find()
    const maps = leadMapsRef.current;
    const matchingLead = maps.byJid.get(jid) || (remoteJidAlt ? maps.byJid.get(remoteJidAlt) : undefined);
    const leadName = matchingLead?.name;
    const leadAvatar = matchingLead?.avatar_url;
    
    // Helper: clean a JID into a display-safe string
    const cleanDisplayJid = (rawJid: string): string => {
      const stripped = rawJid.replace(/@lid$/i, "").replace(/@s\.whatsapp\.net$/i, "").replace(/@c\.us$/i, "").replace(/[^0-9]/g, "");
      if (stripped.length > 13) return "Contato WhatsApp";
      if (stripped.length >= 8) return formatPhoneDisplay(stripped) || "Contato WhatsApp";
      return "Contato WhatsApp";
    };

    // For phone display: prefer lead's cleaned phone, then remoteJidAlt, then format from JID
    const leadPhone = matchingLead?.phone ? cleanPhoneNumber(matchingLead.phone) : null;
    const leadPhoneValid = leadPhone && leadPhone.length <= 13 && leadPhone.length >= 8 ? leadPhone : null;
    const altPhone = (jid.endsWith("@lid") && remoteJidAlt) ? cleanPhoneNumber(remoteJidAlt) : null;
    const jidPhone = jid.endsWith("@lid") ? null : cleanPhoneNumber(jid);
    const bestPhone = leadPhoneValid || altPhone || jidPhone || "";
    const formattedPhone = formatPhoneDisplay(bestPhone);
    
    // Helper: check if a string looks like a raw number or JID (not a real name)
    const isNumericName = (n: string | undefined | null): boolean => {
      if (!n) return true;
      if (n.includes("@")) return true;
      const stripped = n.replace(/[+\-\s()]/g, "");
      return /^\d{8,}$/.test(stripped);
    };
    
    const isLidJid = jid.endsWith("@lid");

    // Name priority: pushName > leadName (if real name) > "Contato WhatsApp" for @lid > formattedPhone
    let displayName: string;
    if (resolvedName && !isNumericName(resolvedName)) {
      displayName = resolvedName;
    } else if (leadName && !isNumericName(leadName)) {
      displayName = leadName;
    } else if (isLidJid) {
      displayName = resolvedName || "Contato WhatsApp";
    } else {
      displayName = resolvedName || formattedPhone || cleanDisplayJid(jid);
    }

    // Auto-fix leads: update phone when empty and update name when "Contato WhatsApp" or numeric
    if (matchingLead) {
      const fixPayload: Record<string, any> = {};
      // Fix phone: update if lead has no valid phone and we have a valid bestPhone
      const currentPhoneDigits = cleanPhoneNumber(matchingLead.phone || "");
      const isPhoneMissing = currentPhoneDigits.length === 0 || currentPhoneDigits.length > 13;
      if (isPhoneMissing && bestPhone.length >= 8 && bestPhone.length <= 13) {
        fixPayload.phone = bestPhone;
      }
      // Fix name: update if lead name is placeholder and we have a real pushName
      const needsNameFix = matchingLead.name === "Contato WhatsApp" || isNumericName(matchingLead.name);
      if (needsNameFix && resolvedName && !isNumericName(resolvedName)) {
        fixPayload.name = resolvedName;
      }
      if (Object.keys(fixPayload).length > 0) {
        updateLead(matchingLead.id, fixPayload).catch(() => {});
      }
    }
    
    // For @lid without a valid phone, ensure phone is empty (not the internal ID)
    const finalPhone = isLidJid && !formattedPhone ? "" : formattedPhone;

    return {
      id: instanceName ? `${instanceName}:${jid}` : (chat.id || jid),
      remoteJid: jid,
      remoteJidAlt,
      name: displayName,
      profilePicUrl: chat.profilePicUrl || leadAvatar || undefined,
      lastMessage: lastMsgContent.substring(0, 50) + (lastMsgContent.length > 50 ? "..." : ""),
      time: formatTime(lastMsgTime),
      unread: chat.unreadCount || 0,
      online: false,
      phone: finalPhone,
      lastMessageFromMe: lastMsgFromMe,
      instanceName,
      instanceLabel,
      // Store raw timestamp for sorting
      _timestamp: lastMsgTime || 0,
    } as Chat & { _timestamp: number };
  }, [updateLead]);

  // Ref to track leads for auto-creation without causing re-renders
  const leadsRef = useRef(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);
  
  // Build lead lookup maps for O(1) matching (rebuilt when leads change)
  const leadMapsRef = useRef<{ byJid: Map<string, Lead>; byPhone10: Map<string, Lead> }>({ byJid: new Map(), byPhone10: new Map() });
  useEffect(() => {
    const byJid = new Map<string, Lead>();
    const byPhone10 = new Map<string, Lead>();
    for (const lead of leads) {
      if (lead.whatsapp_jid) byJid.set(lead.whatsapp_jid, lead);
      const digits = (lead.phone || '').replace(/[^0-9]/g, '');
      if (digits.length >= 10) byPhone10.set(digits.slice(-10), lead);
    }
    leadMapsRef.current = { byJid, byPhone10 };
  }, [leads]);

  // Fast O(1) lead lookup using maps
  const findLeadByChat = useCallback((remoteJid: string, remoteJidAlt?: string, phone?: string): Lead | undefined => {
    const maps = leadMapsRef.current;
    if (maps.byJid.has(remoteJid)) return maps.byJid.get(remoteJid);
    if (remoteJidAlt && maps.byJid.has(remoteJidAlt)) return maps.byJid.get(remoteJidAlt);
    if (phone) {
      const digits = phone.replace(/[^0-9]/g, '');
      if (digits.length >= 10) return maps.byPhone10.get(digits.slice(-10));
    }
    return undefined;
  }, []);

  // Ref to track which JIDs we've already processed for lead creation
  const processedJidsRef = useRef<Set<string>>(new Set());
  
  // Refs for stable function references in effects (avoid re-triggering)
  const createLeadSilentRef = useRef(createLeadSilent);
  useEffect(() => { createLeadSilentRef.current = createLeadSilent; }, [createLeadSilent]);
  const tagRulesRef = useRef(tagRules);
  useEffect(() => { tagRulesRef.current = tagRules; }, [tagRules]);
  const checkMessageAgainstRulesRef = useRef(checkMessageAgainstRules);
  useEffect(() => { checkMessageAgainstRulesRef.current = checkMessageAgainstRules; }, [checkMessageAgainstRules]);
  const addTagToLeadRef = useRef(addTagToLead);
  useEffect(() => { addTagToLeadRef.current = addTagToLead; }, [addTagToLead]);

  // Helper: load chat list from local whatsapp_messages DB
  // ALWAYS loads by workspace_id (via RLS), never filters by instance_name
  // This ensures chats from deleted/offline instances remain visible
  const loadChatsFromDB = useCallback(async (instanceName?: string): Promise<(Chat & { _timestamp?: number })[]> => {
    try {
      // Query whatsapp_messages grouped by remote_jid to build a chat list
      // NO instance_name filter — chats must survive instance deletion
      const query = supabase
        .from('whatsapp_messages')
        .select('remote_jid, push_name, content, direction, timestamp, instance_name, from_me')
        .eq('workspace_id', workspaceId || '')
        .order('timestamp', { ascending: false })
        .limit(1000);

      const { data: msgs, error } = await query;
      if (error || !msgs || msgs.length === 0) return [];

      // Group by LEAD (via phone suffix or JID match) instead of exact remote_jid
      // This merges conversations from different JID formats (@lid vs @s.whatsapp.net)
      const chatMap = new Map<string, {
        remoteJid: string;
        allJids: string[];
        name: string;
        lastMessage: string;
        timestamp: string;
        fromMe: boolean;
        instanceName: string;
        leadId?: string;
      }>();

      // Build a lookup from leads for fast matching
      const currentLeads = leadsRef.current;
      const leadByJid = new Map<string, typeof currentLeads[0]>();
      const leadByPhone10 = new Map<string, typeof currentLeads[0]>();
      for (const lead of currentLeads) {
        if (lead.whatsapp_jid) leadByJid.set(lead.whatsapp_jid, lead);
        const ld = (lead.phone || '').replace(/[^0-9]/g, '');
        if (ld.length >= 10) leadByPhone10.set(ld.slice(-10), lead);
      }

      for (const msg of msgs) {
        if (!msg.remote_jid || msg.remote_jid.endsWith('@g.us')) continue;

        // Find the matching lead for this message's remote_jid
        let matchedLead = leadByJid.get(msg.remote_jid);
        if (!matchedLead) {
          const msgDigits = cleanPhoneNumber(msg.remote_jid);
          if (msgDigits.length >= 10 && msgDigits.length <= 13) {
            matchedLead = leadByPhone10.get(msgDigits.slice(-10));
          }
        }

        // Dedup key: lead.id if found, otherwise phone suffix, otherwise raw JID
        const msgDigits = cleanPhoneNumber(msg.remote_jid);
        const dedupKey = matchedLead?.id
          || (msgDigits.length >= 10 && msgDigits.length <= 13 ? `phone:${msgDigits.slice(-10)}` : msg.remote_jid);

        const existing = chatMap.get(dedupKey);
        if (!existing) {
          chatMap.set(dedupKey, {
            remoteJid: msg.remote_jid,
            allJids: [msg.remote_jid],
            name: msg.push_name || '',
            lastMessage: msg.content || '',
            timestamp: msg.timestamp,
            fromMe: msg.from_me || msg.direction === 'outbound',
            instanceName: msg.instance_name,
            leadId: matchedLead?.id,
          });
        } else {
          // Track all JIDs for this contact
          if (!existing.allJids.includes(msg.remote_jid)) {
            existing.allJids.push(msg.remote_jid);
          }
        }
      }

      // Convert to Chat objects
      const chats: (Chat & { _timestamp?: number })[] = [];
      for (const [dedupKey, info] of chatMap) {
        const ts = new Date(info.timestamp).getTime() / 1000;
        const phoneDigits = cleanPhoneNumber(info.remoteJid);
        const phone = formatPhoneDisplay(phoneDigits);
        
        // Use already-matched lead or find one
        const matchingLead = info.leadId
          ? currentLeads.find(l => l.id === info.leadId)
          : currentLeads.find((l) => {
              if (l.whatsapp_jid === info.remoteJid) return true;
              const leadDigits = cleanPhoneNumber(l.phone || '');
              if (phoneDigits.length >= 10 && leadDigits.length >= 10) {
                return leadDigits.endsWith(phoneDigits.slice(-10)) || phoneDigits.endsWith(leadDigits.slice(-10));
              }
              return false;
            });

        const displayName = matchingLead?.name || info.name || phone || 'Contato WhatsApp';

        chats.push({
          id: info.instanceName ? `${info.instanceName}:${info.remoteJid}` : info.remoteJid,
          remoteJid: info.remoteJid,
          name: displayName,
          lastMessage: info.lastMessage,
          time: formatTime(ts),
          unread: 0,
          online: false,
          phone: phone,
          lastMessageFromMe: info.fromMe,
          instanceName: info.instanceName,
          instanceLabel: info.instanceName,
          _timestamp: ts,
        });
      }

      chats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
      console.log(`[Chats] Loaded ${chats.length} chats from local DB${instanceName ? ` for ${instanceName}` : ''}`);
      return chats;
    } catch (err) {
      console.error('[Chats] Error loading chats from DB:', err);
      return [];
    }
  }, []);

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
          // DATABASE-FIRST: Always load from local DB first
          const dbChats = await loadChatsFromDB('all');
          
          // Then try to fetch from Evolution API to get newer data
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
          const apiChats = results.flat();

          // Merge: DB chats + API chats, deduplicate by remoteJid keeping most recent
          allChats = [...dbChats, ...apiChats];

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
          
          // Deduplicate by lead.id > phone digits > remoteJid
          const deduped = new Map<string, (Chat & { _timestamp?: number })>();
          for (const c of allChats) {
            // Find matching lead for best dedup key
            const chatDigits = cleanPhoneNumber(c.phone || "");
            const matchedLead = leadsRef.current.find((l) => {
              if (l.whatsapp_jid === c.remoteJid) return true;
              if (c.remoteJidAlt && l.whatsapp_jid === c.remoteJidAlt) return true;
              if (chatDigits.length >= 10) {
                const ld = (l.phone || "").replace(/[^0-9]/g, "");
                return ld.length >= 10 && ld.slice(-10) === chatDigits.slice(-10);
              }
              return false;
            });
            const key = matchedLead?.id || (chatDigits.length >= 10 ? chatDigits.slice(-10) : c.remoteJid);
            const existing = deduped.get(key);
            if (!existing || ((c as any)._timestamp || 0) > ((existing as any)._timestamp || 0)) {
              deduped.set(key, c);
            }
          }
          allChats = Array.from(deduped.values());

          // Sort by timestamp (most recent first)
          allChats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
          allChats = allChats.slice(0, 100);
          
        } else {
          // DATABASE-FIRST: Always load from local DB first
          const dbChats = await loadChatsFromDB(selectedInstance);
          
          // Then try to fetch from Evolution API for newer data
          let apiChats: (Chat & { _timestamp?: number })[] = [];
          try {
            const data = await fetchChats(selectedInstance);
            if (Array.isArray(data) && data.length > 0) {
              apiChats = data
                .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
                .map((chat: any) => transformChatData(chat));
            }
          } catch {
            // API unavailable — DB chats are sufficient
          }
          
          // Merge DB + API, deduplicate by lead.id > phone digits
          const merged = [...dbChats, ...apiChats];
          const deduped = new Map<string, (Chat & { _timestamp?: number })>();
          for (const c of merged) {
            const chatDigits = cleanPhoneNumber(c.phone || "");
            const matchedLead = leadsRef.current.find((l) => {
              if (l.whatsapp_jid === c.remoteJid) return true;
              if (c.remoteJidAlt && l.whatsapp_jid === c.remoteJidAlt) return true;
              if (chatDigits.length >= 10) {
                const ld = (l.phone || "").replace(/[^0-9]/g, "");
                return ld.length >= 10 && ld.slice(-10) === chatDigits.slice(-10);
              }
              return false;
            });
            const key = matchedLead?.id || (chatDigits.length >= 10 ? chatDigits.slice(-10) : c.remoteJid);
            const existing = deduped.get(key);
            if (!existing || ((c as any)._timestamp || 0) > ((existing as any)._timestamp || 0)) {
              deduped.set(key, c);
            }
          }
          allChats = Array.from(deduped.values());
          allChats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
          allChats = allChats.slice(0, 100);
        }

        setChats(allChats);
        setChatError(null);
        if (allChats.length > 0 && !selectedChat) {
          setSelectedChat(allChats[0]);
        }
        
        // Auto-create leads for ALL WhatsApp conversations (including outbound/prospecting)
        // ALSO: if a lead exists but has a different JID, link the new JID to it
        const currentLeads = leadsRef.current;
        const stripDigits = (s: string) => s.replace(/[^0-9]/g, "");
        const chatsNeedingLeads: { chat: typeof allChats[0]; existingLead?: typeof currentLeads[0] }[] = [];
        
        for (const chat of allChats) {
          if (chat.isMeta) continue;
          if (processedJidsRef.current.has(chat.remoteJid)) continue;
          
          const chatDigits = stripDigits(chat.phone || "");
          const existingLead = currentLeads.find((lead) => {
            if (lead.whatsapp_jid === chat.remoteJid) return true;
            if (chat.remoteJidAlt && lead.whatsapp_jid === chat.remoteJidAlt) return true;
            if (chatDigits.length >= 10) {
              const leadDigits = stripDigits(lead.phone || "");
              if (leadDigits.length >= 10 && (leadDigits.slice(-10) === chatDigits.slice(-10))) return true;
            }
            return false;
          });
          
          if (!existingLead) {
            // Need to create a new lead
            chatsNeedingLeads.push({ chat });
          } else if (existingLead.whatsapp_jid !== chat.remoteJid) {
            // Lead exists with a different JID — link the current JID
            // Prefer @s.whatsapp.net over @lid
            processedJidsRef.current.add(chat.remoteJid);
            if (chat.remoteJid.endsWith("@s.whatsapp.net") && existingLead.whatsapp_jid?.endsWith("@lid")) {
              // Upgrade: replace @lid with @s.whatsapp.net
              updateLead(existingLead.id, { whatsapp_jid: chat.remoteJid }).catch(() => {});
            }
          } else {
            processedJidsRef.current.add(chat.remoteJid);
          }
        }
        
        if (chatsNeedingLeads.length > 0) {
          console.log(`[Chats] Auto-creating ${chatsNeedingLeads.length} leads`);
          const BATCH_SIZE = 20;
          for (let i = 0; i < chatsNeedingLeads.length; i += BATCH_SIZE) {
            const batch = chatsNeedingLeads.slice(i, i + BATCH_SIZE);
            for (const { chat } of batch) {
              try {
                processedJidsRef.current.add(chat.remoteJid);
                const phoneDigits = cleanPhoneNumber(chat.phone || "");
                const validPhone = phoneDigits.length <= 13 && phoneDigits.length >= 8 ? chat.phone : "";
                // Normalize phone to digits-only for DB storage
                const normalizedPhone = validPhone ? validPhone.replace(/[^0-9+]/g, "") : "";
                const isLidChat = chat.remoteJid?.endsWith("@lid");
                const rawName = chat.name || "";
                const nameIsJid = rawName.includes("@") || /^\d{14,}$/.test(rawName.replace(/[^0-9]/g, ""));
                const leadName = nameIsJid ? (isLidChat ? "Contato WhatsApp" : (normalizedPhone || "Contato WhatsApp")) : (rawName || normalizedPhone || "Contato WhatsApp");
                const newLead = await createLeadSilentRef.current({
                  name: leadName,
                  phone: normalizedPhone,
                  whatsapp_jid: chat.remoteJid,
                  instance_name: chat.instanceName,
                  source: 'whatsapp',
                });
                if (newLead && chat.lastMessage && tagRulesRef.current.length > 0) {
                  const matchingTagIds = checkMessageAgainstRulesRef.current(chat.lastMessage);
                  for (const tagId of matchingTagIds) {
                    await addTagToLeadRef.current(newLead.id, tagId);
                  }
                }
              } catch (err) {
                console.error(`[Chats] Error creating lead for ${chat.remoteJid}:`, err);
                processedJidsRef.current.delete(chat.remoteJid);
              }
            }
            if (i + BATCH_SIZE < chatsNeedingLeads.length) {
              await new Promise((r) => setTimeout(r, 1000));
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
  }, [selectedInstance, instances, metaPages, transformChatData, fetchMetaConversations]);

  // Ref to track which JIDs have been enriched to avoid duplicate API calls
  const enrichedJidsRef = useRef<Set<string>>(new Set());

  // Enrich chats with profile photos asynchronously (non-blocking)
  useEffect(() => {
    if (chats.length === 0) return;
    
    // Find WhatsApp chats without profile pics (limit to first 10 for rate limiting)
    const chatsToEnrich = chats
      .filter((c) => !c.isMeta && !c.profilePicUrl && !enrichedJidsRef.current.has(c.remoteJid)
        && c.remoteJid.includes("@s.whatsapp.net") // Only enrich real phone JIDs, skip @lid and @g.us
      )
      .slice(0, 10);
    
    if (chatsToEnrich.length === 0) return;

    const enrichChats = async () => {
      // Get the instance for the request
      for (const chat of chatsToEnrich) {
        const targetInstance = chat.instanceName || selectedInstance;
        if (!targetInstance || targetInstance === "all") continue;
        
        enrichedJidsRef.current.add(chat.remoteJid);
        const number = extractNumberFromJid(chat.remoteJid);
        
        try {
          const profile = await fetchProfile(targetInstance, number);
          if (profile && (profile.name || profile.profilePicUrl)) {
            setChats((prev) =>
              prev.map((c) =>
                c.remoteJid === chat.remoteJid
                  ? {
                      ...c,
                      profilePicUrl: profile.profilePicUrl || c.profilePicUrl,
                      name: (!c.name || c.name === c.phone) && profile.name ? profile.name : c.name,
                    }
                  : c
              )
            );
          }
          // Small delay between requests
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          console.warn(`[Chats] Failed to enrich ${chat.remoteJid}:`, err);
        }
      }
    };

    // Run non-blocking
    enrichChats();
  }, [chats.length, selectedInstance, fetchProfile]);

  // Load messages when chat is selected (with cache)
  useEffect(() => {
    if (!selectedChat) return;

    const chatId = selectedChat.id;
    
    // Check cache first
    const cached = messageCacheRef.current.get(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setHasMoreMessages(cached.length >= 30);
      setLoadingMessages(false);
      return;
    }

    // Meta chat - load from meta_conversations
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      const loadMetaMsgs = async () => {
        setLoadingMessages(true);
        setHasMoreMessages(false);
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
          messageCacheRef.current.set(chatId, transformed);
        } catch (err) {
          console.error("[Chats] Error loading Meta messages:", err);
        } finally {
          setLoadingMessages(false);
        }
      };
      loadMetaMsgs();
      return;
    }
    
    // WhatsApp chat - load via Evolution API (only 30 initially)
    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        let data: EvolutionMessage[] = [];
        try {
          data = await fetchMessages(targetInstance, selectedChat.remoteJid, 30);
        } catch {
          data = [];
        }

        // If Evolution API returned messages, use them
        if (data.length > 0) {
          // Extract remoteJidAlt from loaded messages if chat doesn't have one yet
          if (!selectedChat.remoteJidAlt && selectedChat.remoteJid.endsWith("@lid")) {
            for (const msg of data) {
              const alt = (msg.key as any)?.remoteJidAlt;
              if (alt && alt.endsWith("@s.whatsapp.net")) {
                setSelectedChat((prev) => prev ? { ...prev, remoteJidAlt: alt } : prev);
                setChats((prev) => prev.map((c) => 
                  c.remoteJid === selectedChat.remoteJid ? { ...c, remoteJidAlt: alt } : c
                ));
                const altDigits = alt.replace(/@s\.whatsapp\.net$/, "");
                if ((!selectedChat.phone || selectedChat.phone.length < 4) && altDigits.length >= 10) {
                  const formatted = formatPhoneDisplay(altDigits);
                  setSelectedChat((prev) => prev ? { ...prev, phone: formatted, remoteJidAlt: alt } : prev);
                  setChats((prev) => prev.map((c) =>
                    c.remoteJid === selectedChat.remoteJid ? { ...c, phone: formatted, remoteJidAlt: alt } : c
                  ));
                  const matchingLeadForUpdate = leadsRef.current.find(
                    (l) => l.whatsapp_jid === selectedChat.remoteJid || l.whatsapp_jid === alt
                  );
                  if (matchingLeadForUpdate) {
                    const updates: Record<string, string> = { phone: formatted };
                    const pushNameMsg = data.find((m: any) => m.pushName && typeof m.pushName === "string" && m.pushName.trim().length > 1);
                    const pushName = (pushNameMsg as any)?.pushName;
                    if (matchingLeadForUpdate.name === "Contato WhatsApp" && pushName) {
                      updates.name = pushName.trim();
                    }
                    updateLead(matchingLeadForUpdate.id, updates);
                  }
                }
                break;
              }
            }
          }

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
          setHasMoreMessages(data.length >= 30);
          messageCacheRef.current.set(chatId, transformedMessages);

          // Fire-and-forget: persist inbound WA messages for dashboard metrics
          if (workspaceId && !selectedChat.isMeta) {
            const inboundMsgs = data.filter((msg) => !msg.key?.fromMe);
            if (inboundMsgs.length > 0) {
              const rows = inboundMsgs.map((msg) => {
                const { content } = extractMessageContent(msg);
                const ts = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();
                return {
                  workspace_id: workspaceId,
                  instance_name: selectedChat.instanceName || selectedInstance || '',
                  remote_jid: selectedChat.remoteJid,
                  from_me: false,
                  direction: 'inbound' as const,
                  content: content || '',
                  message_type: 'text',
                  timestamp: ts,
                  message_id: msg.key?.id || null,
                  push_name: (msg as any).pushName || null,
                };
              });
              Promise.resolve(supabase.from('whatsapp_messages').insert(rows)).catch(() => {});

              // Log received messages to lead_history if lead exists
              const matchingLead = leadsRef.current.find((l) => {
                if (l.whatsapp_jid === selectedChat.remoteJid) return true;
                const chatDigits = (selectedChat.phone || '').replace(/[^0-9]/g, '');
                const leadDigits = (l.phone || '').replace(/[^0-9]/g, '');
                return chatDigits.length >= 10 && leadDigits.length >= 10 &&
                  (leadDigits.endsWith(chatDigits.slice(-10)) || 
                   chatDigits.endsWith(leadDigits.slice(-10)));
              });
              if (matchingLead && workspaceId) {
                supabase.from('lead_history').insert({
                  lead_id: matchingLead.id,
                  action: 'whatsapp_message_received',
                  performed_by: 'system',
                  workspace_id: workspaceId,
                  metadata: {
                    instance_name: selectedChat.instanceName || selectedInstance || '',
                    remote_jid: selectedChat.remoteJid,
                    push_name: selectedChat.name,
                  },
                }).then(() => {});
              }
            }
          }
        } else {
          // FALLBACK: Load messages from local DB when Evolution API has no data
          // Collect ALL known JIDs for this contact (lead's JID + chat JID + remoteJidAlt)
          console.log(`[Chats] No API messages for ${selectedChat.remoteJid}, falling back to local DB`);
          const phoneDigits = cleanPhoneNumber(selectedChat.phone || "");
          const allJids = new Set<string>([selectedChat.remoteJid]);
          if (selectedChat.remoteJidAlt) allJids.add(selectedChat.remoteJidAlt);
          // Find linked lead and add its JID too
          const linkedLead = leadsRef.current.find((l) => {
            if (l.whatsapp_jid === selectedChat.remoteJid) return true;
            if (selectedChat.remoteJidAlt && l.whatsapp_jid === selectedChat.remoteJidAlt) return true;
            if (phoneDigits.length >= 10) {
              const ld = (l.phone || "").replace(/[^0-9]/g, "");
              return ld.length >= 10 && ld.slice(-10) === phoneDigits.slice(-10);
            }
            return false;
          });
          if (linkedLead?.whatsapp_jid) allJids.add(linkedLead.whatsapp_jid);

          // Build OR filter with all known JIDs + phone suffix
          const jidFilters = Array.from(allJids).map(j => `remote_jid.eq.${j}`);
          if (phoneDigits.length >= 10) {
            jidFilters.push(`remote_jid.like.%${phoneDigits.slice(-10)}%`);
          }

          let dbQuery = supabase
            .from('whatsapp_messages')
            .select('*')
            .or(jidFilters.join(','))
            .order('timestamp', { ascending: true })
            .limit(200);
          
          const { data: dbMsgs } = await dbQuery;
          
          if (dbMsgs && dbMsgs.length > 0) {
            const transformedMessages: Message[] = dbMsgs.map((msg) => {
              const date = new Date(msg.timestamp);
              return {
                id: msg.message_id || msg.id,
                content: msg.content || '',
                time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                sent: msg.from_me || msg.direction === 'outbound',
                read: true,
                type: (msg.message_type || 'text') as Message["type"],
              };
            });
            setMessages(transformedMessages);
            setHasMoreMessages(false);
            messageCacheRef.current.set(chatId, transformedMessages);
          } else {
            setMessages([]);
            setHasMoreMessages(false);
          }
        }
      } catch (err) {
        console.error("[Chats] Error loading messages:", err);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedInstance, selectedChat?.id, selectedChat?.instanceName, selectedChat?.isMeta, fetchMetaMessages]);

  // Infinite scroll: load older messages when scrolling up
  const loadOlderMessages = useCallback(async () => {
    if (!selectedChat || loadingOlderMessages || !hasMoreMessages || selectedChat.isMeta) return;
    
    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return;

    setLoadingOlderMessages(true);
    try {
      // Fetch more messages with a higher limit offset
      const currentCount = messages.length;
      const data = await fetchMessages(targetInstance, selectedChat.remoteJid, currentCount + 30);
      
      if (data.length <= currentCount) {
        setHasMoreMessages(false);
        return;
      }

      const allTransformed: Message[] = data
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

      setMessages(allTransformed);
      setHasMoreMessages(data.length >= currentCount + 30);
      messageCacheRef.current.set(selectedChat.id, allTransformed);
    } catch (err) {
      console.error("[Chats] Error loading older messages:", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedChat, selectedInstance, messages.length, loadingOlderMessages, hasMoreMessages, fetchMessages]);

  // Handle scroll to detect when user scrolls to top
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop < 100 && hasMoreMessages && !loadingOlderMessages) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, loadingOlderMessages, loadOlderMessages]);

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
    <div className="h-[calc(100vh-8rem)] flex rounded-xl overflow-hidden border border-border bg-card" data-tour="chat-section">
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
                messageCacheRef.current.clear();
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
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                    selectedChat?.id === chat.id
                      ? "bg-secondary/10 border border-secondary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative">
                    {chat.profilePicUrl ? (
                      <img 
                        src={chat.profilePicUrl} 
                        alt={chat.name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold",
                      chat.profilePicUrl && "hidden"
                    )}>
                      {(chat.name || "?").split(" ").slice(0, 2).map((n) => n[0] || "").join("").toUpperCase() || "?"}
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
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {selectedChat.profilePicUrl ? (
                      <img 
                        src={selectedChat.profilePicUrl} 
                        alt={selectedChat.name}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold text-sm",
                      selectedChat.profilePicUrl && "hidden"
                    )}>
                      {(selectedChat.name || "?").split(" ").slice(0, 2).map((n) => n[0] || "").join("").toUpperCase() || "?"}
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
                  <ScheduleMessagePopover
                    channelType={
                      selectedChat.isMeta
                        ? selectedChat.metaPlatform === "instagram"
                          ? "meta_instagram"
                          : selectedChat.metaPlatform === "whatsapp_business"
                            ? "meta_whatsapp"
                            : "meta_facebook"
                        : "whatsapp"
                    }
                    instanceName={selectedChat.instanceName || selectedInstance || undefined}
                    remoteJid={selectedChat.remoteJid}
                    phoneNumber={selectedChat.phone}
                    metaPageId={selectedChat.metaPageId}
                    senderId={selectedChat.metaSenderId}
                    contactName={selectedChat.name}
                  />
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
            </div>

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 min-h-0 w-full"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full w-full">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Carregando mensagens...</p>
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
                  {/* Load more indicator */}
                  {loadingOlderMessages && (
                    <div className="flex items-center justify-center py-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground ml-2">Carregando anteriores...</span>
                    </div>
                  )}
                  {!hasMoreMessages && messages.length > 30 && (
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground bg-card px-2">Início da conversa</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

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
            </div>

            {/* Chat Input */}
            <ChatInput
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onSendAudio={handleSendAudio}
              disabled={apiLoading}
              placeholder={
                selectedChat?.isMeta
                  ? selectedChat.metaPlatform === "instagram"
                    ? "Responder via Instagram..."
                    : selectedChat.metaPlatform === "whatsapp_business"
                      ? "Responder via WhatsApp API..."
                      : "Responder via Facebook..."
                  : undefined
              }
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

      {/* Lead Side Panel */}
      {selectedChat && (() => {
        // Try matching by whatsapp_jid first, then by phone number
        let currentLead = leads.find((l) => l.whatsapp_jid === selectedChat.remoteJid);
        if (!currentLead && selectedChat.remoteJidAlt) {
          currentLead = leads.find((l) => l.whatsapp_jid === selectedChat.remoteJidAlt);
        }
        if (!currentLead && selectedChat.phone) {
          const chatPhoneDigits = cleanPhoneNumber(selectedChat.phone);
          if (chatPhoneDigits.length >= 10) {
            currentLead = leads.find((l) => {
              const leadDigits = cleanPhoneNumber(l.phone || "");
              return leadDigits.length >= 10 && leadDigits.slice(-10) === chatPhoneDigits.slice(-10);
            });
          }
        }
        return (
          <LeadSidePanel
            lead={currentLead || null}
            stages={stages}
            tags={tags}
            isOpen={leadPanelOpen}
            onToggle={() => setLeadPanelOpen((v) => !v)}
            onUpdateLead={updateLead}
            onMoveLead={moveLead}
            onAddTag={addTagToLead}
            onRemoveTag={removeTagFromLead}
            onCreateTag={createTag}
            chatContact={!currentLead ? {
              name: selectedChat.name,
              phone: selectedChat.phone,
              remoteJid: selectedChat.remoteJid,
              instanceName: selectedChat.instanceName,
            } : undefined}
            onCreateLead={!currentLead ? async () => {
              const phoneDigits = selectedChat.phone.replace(/[^0-9]/g, "");
              const newLead = await createLead({
                name: selectedChat.name || phoneDigits || "Contato",
                phone: phoneDigits || selectedChat.remoteJid,
                whatsapp_jid: selectedChat.remoteJid,
                instance_name: selectedChat.instanceName,
                source: "whatsapp",
              });
              return !!newLead;
            } : undefined}
            onOpenDetailModal={currentLead ? () => {
              setLeadModalLead(currentLead);
              setLeadModalOpen(true);
            } : undefined}
          />
        );
      })()}
      <LeadDetailModal
        lead={leadModalLead}
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        stages={stages}
        tags={tags}
        onUpdate={updateLead}
        onMove={(leadId, stageId) => moveLead(leadId, stageId, 0)}
        onDelete={deleteLead}
        onAddTag={addTagToLead}
        onRemoveTag={removeTagFromLead}
        canDelete={true}
      />
    </div>
  );
}
