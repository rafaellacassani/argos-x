import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  ArrowLeft,
  ArrowRight,
  Star,
  Archive,
  RefreshCw,
  MessageCircle,
  AlertCircle,
  Headphones,
  CheckCircle2,
  UserCheck,
  Ban,
  ShieldOff,
  Zap,
  EyeOff,
  Trash2,
  UserX,
  Pin,
  PinOff,
  Download,
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
import { TransferToAgentButton } from "@/components/chat/TransferToAgentButton";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useHumanSupportQueue } from "@/hooks/useHumanSupportQueue";
import { useArgosClientPlanTags } from "@/hooks/useArgosClientPlanTags";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportConversationsDialog } from "@/components/chat/ExportConversationsDialog";

const MASTER_WORKSPACE_IDS = new Set([
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X
  "6a8540c9-6eb5-42ce-8d20-960002d85bac", // ECX Company
]);

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
  type: "text" | "image" | "audio" | "document" | "video" | "contact";
  mediaUrl?: string;
  thumbnailBase64?: string;
  fileName?: string;
  duration?: number;
  localAudioBase64?: string;
  messageId?: string; // Evolution API message key id
  fromMe?: boolean;
  timestamp?: number; // Unix timestamp
}

interface ReplyingTo {
  id: string;
  content: string;
  sent: boolean;
  type: string;
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

const normalizeDigits = (value: string): string => value.replace(/[^0-9]/g, "");

const chatMatchesPhoneSearch = (
  chat: Pick<Chat, "phone" | "remoteJid" | "remoteJidAlt">,
  rawSearch: string
): boolean => {
  const searchDigits = normalizeDigits(rawSearch);
  if (!searchDigits) return false;

  const candidates = [chat.phone, chat.remoteJid, chat.remoteJidAlt]
    .filter(Boolean)
    .map((value) => cleanPhoneNumber(String(value)))
    .filter((value) => value.length >= 8);

  return candidates.some((value) => {
    if (value === searchDigits) return true;
    if (value.length >= 11 && searchDigits.length >= 11 && value.slice(-11) === searchDigits.slice(-11)) return true;
    if (value.length >= 10 && searchDigits.length >= 10 && value.slice(-10) === searchDigits.slice(-10)) return true;
    if (value.length >= 8 && searchDigits.length >= 8 && value.slice(-8) === searchDigits.slice(-8)) return true;
    return value.includes(searchDigits) || searchDigits.includes(value);
  });
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
  const [searchTerm, setSearchTerm] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
  });
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
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const chatListOffsetRef = useRef(1000); // tracks how many messages we've already loaded for chat list
  // Content search state
  const [contentSearchResults, setContentSearchResults] = useState<Set<string>>(new Set());
  const [contentSearchLoading, setContentSearchLoading] = useState(false);
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const chatListScrollRef = useRef<HTMLDivElement | null>(null);
  const [activeFilters, setActiveFilters] = useState<ChatFiltersFormData | null>(() => {
    // Initialize filters from URL params on mount
    const params = new URLSearchParams(window.location.search);
    if (params.has("responseStatus")) {
      return {
        periodPreset: "any",
        stageIds: [],
        starred: false,
        responseStatus: params.get("responseStatus")!.split(","),
        interactionStatus: "",
        chatSource: [],
        responsibleUser: "",
        leadSearch: "",
        participantSearch: "",
        lastMessageSender: "any",
        tagIds: [],
      } as ChatFiltersFormData;
    }
    return null;
  });
  
  // Message cache: stores messages per chat ID to avoid re-fetching
  const messageCacheRef = useRef<Map<string, Message[]>>(new Map());
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll messages container to the bottom (latest messages)
  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  
  // Auto-scroll to bottom when messages finish loading or chat changes
  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [loadingMessages, selectedChat?.id, scrollToBottom]);

  // Load leads data for filters and auto-create leads
  const { stages, tags, leads, createLead, createLeadSilent, addTagToLead, removeTagFromLead, createTag, updateLead, moveLead, deleteLead } = useLeads();
  const { isSeller, userProfileId } = useUserRole();
  const { workspaceId } = useWorkspace();
  const isMobile = useIsMobile();
  const { queue, waitingCount, claimItem, resolveItem, fetchQueue } = useHumanSupportQueue();
  const [showQueueOnly, setShowQueueOnly] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const isMasterWorkspace = !!workspaceId && MASTER_WORKSPACE_IDS.has(workspaceId);
  const [leadPanelOpen, setLeadPanelOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadModalLead, setLeadModalLead] = useState<any>(null);
  const [selectedChatAiPaused, setSelectedChatAiPaused] = useState(false);

  // Override map: leads fetched directly from DB that aren't in the funnel-filtered leads array
  const [chatLeadOverrides, setChatLeadOverrides] = useState<Map<string, Lead>>(new Map());

  // Pinned/Important chats — persisted per workspace in localStorage
  const pinnedStorageKey = `pinned-chats-${workspaceId}`;
  const [pinnedChatIds, setPinnedChatIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`pinned-chats-${workspaceId || "default"}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Persist pinned chats to localStorage
  const togglePinChat = useCallback((chatId: string) => {
    setPinnedChatIds(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      localStorage.setItem(`pinned-chats-${workspaceId || "default"}`, JSON.stringify([...next]));
      return next;
    });
  }, [workspaceId]);
  
  // Query AI pause state when selected chat changes
  // Uses session_id (remoteJid) as primary key — this matches how the backend tracks sessions
  useEffect(() => {
    if (!selectedChat || !workspaceId) {
      setSelectedChatAiPaused(false);
      return;
    }
    const checkPauseState = async () => {
      const sessionId = selectedChat.remoteJid;
      if (!sessionId) {
        setSelectedChatAiPaused(false);
        return;
      }
      // Query by session_id first (most reliable — backend always sets this)
      const { data } = await supabase
        .from("agent_memories")
        .select("is_paused")
        .eq("session_id", sessionId)
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setSelectedChatAiPaused(data[0].is_paused === true);
        return;
      }
      // Fallback: try by lead_id
      const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
      if (chatLead?.id) {
        const { data: leadData } = await supabase
          .from("agent_memories")
          .select("is_paused")
          .eq("lead_id", chatLead.id)
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false })
          .limit(1);
        setSelectedChatAiPaused(leadData?.[0]?.is_paused === true);
      } else {
        setSelectedChatAiPaused(false);
      }
    };
    checkPauseState();
  }, [selectedChat?.id, workspaceId]);

  // Direct DB fallback: when selectedChat has no lead in the funnel-filtered array,
  // fetch from DB to handle leads in other funnels or not yet in local state
  useEffect(() => {
    if (!selectedChat || !workspaceId) return;
    const existingLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
    if (existingLead) return; // Already found, no need to fetch

    const fetchLeadFromDB = async () => {
      const phoneCandidates = [
        cleanPhoneNumber(selectedChat.phone || ""),
        cleanPhoneNumber(selectedChat.remoteJidAlt || ""),
        cleanPhoneNumber(selectedChat.remoteJid || ""),
      ].filter(d => d.length >= 10 && d.length <= 13);

      const orFilters: string[] = [];
      if (selectedChat.remoteJid) orFilters.push(`whatsapp_jid.eq.${selectedChat.remoteJid}`);
      if (selectedChat.remoteJidAlt) orFilters.push(`whatsapp_jid.eq.${selectedChat.remoteJidAlt}`);
      for (const digits of phoneCandidates) {
        orFilters.push(`phone.like.%${digits.slice(-10)}`);
      }
      if (orFilters.length === 0) return;

      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("workspace_id", workspaceId)
        .or(orFilters.join(","))
        .limit(1);

      if (data && data.length > 0) {
        const dbLead = { ...data[0], tags: [], sales: [] } as Lead;
        setChatLeadOverrides(prev => {
          const next = new Map(prev);
          next.set(dbLead.id, dbLead);
          return next;
        });
      }
    };
    fetchLeadFromDB();
  }, [selectedChat?.id, workspaceId, leads]); // re-check when leads change too

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
    hasMoreConversations: hasMoreMetaConvs,
    fetchConversations: fetchMetaConversations,
    fetchMoreConversations: fetchMoreMetaConversations,
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
    deleteMessage: evolutionDeleteMessage,
    editMessage: evolutionEditMessage,
    reactToMessage: evolutionReactToMessage,
    blockContact,
    loading: apiLoading,
    error: apiError,
  } = useEvolutionAPI();

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  // Edit state
  const [editingMessage, setEditingMessage] = useState<{ id: string; messageId: string; content: string } | null>(null);

  // === Message action handlers ===
  const handleReply = useCallback((msg: { id: string; content: string; sent: boolean; type: string }) => {
    setReplyingTo(msg);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleDeleteForMe = useCallback(async (msgId: string) => {
    // Remove from local state
    setMessages(prev => prev.filter(m => m.id !== msgId));
    // Remove from DB
    await supabase.from("whatsapp_messages").delete().eq("message_id", msgId);
    toast({ title: "Mensagem apagada" });
  }, []);

  const handleDeleteForEveryone = useCallback(async (msgId: string, messageId: string) => {
    if (!selectedChat) return;

    if (selectedChat.isMeta) {
      // Meta: delete via meta-send-message edge function
      try {
        const { data, error } = await supabase.functions.invoke("meta-send-message", {
          body: { action: "delete", metaPageId: selectedChat.metaPageId, messageId },
        });
        if (error || data?.error) {
          console.error("[Chats] Meta delete error:", error || data?.error);
          toast({ title: "Erro ao apagar mensagem", variant: "destructive" });
          return;
        }
        setMessages(prev => prev.filter(m => m.id !== msgId));
        await supabase.from("meta_conversations").delete().eq("id", msgId);
        toast({ title: "Mensagem apagada para todos" });
      } catch (err) {
        console.error("[Chats] Meta delete error:", err);
        toast({ title: "Erro ao apagar mensagem", variant: "destructive" });
      }
      return;
    }

    const targetInstance = selectedChat.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return;
    
    const remoteJid = selectedChat.remoteJid;
    const success = await evolutionDeleteMessage(targetInstance, messageId, remoteJid, true);
    if (success) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      await supabase.from("whatsapp_messages").delete().eq("message_id", messageId);
      toast({ title: "Mensagem apagada para todos" });
    } else {
      toast({ title: "Erro ao apagar mensagem", variant: "destructive" });
    }
  }, [selectedChat, selectedInstance, evolutionDeleteMessage]);

  const handleEdit = useCallback(async (msgId: string, messageId: string, currentContent: string) => {
    const newText = prompt("Editar mensagem:", currentContent);
    if (!newText || newText === currentContent) return;
    
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return;
    
    const success = await evolutionEditMessage(targetInstance, messageId, selectedChat.remoteJid, true, newText);
    if (success) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: newText } : m));
      await supabase.from("whatsapp_messages").update({ content: newText }).eq("message_id", messageId);
      toast({ title: "Mensagem editada" });
    } else {
      toast({ title: "Erro ao editar mensagem", variant: "destructive" });
    }
  }, [selectedChat, selectedInstance, evolutionEditMessage]);

  const handleReact = useCallback(async (msgId: string, messageId: string, reaction: string) => {
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all" || !selectedChat) return;
    
    // Find if fromMe
    const msg = messages.find(m => m.id === msgId);
    const fromMe = msg?.fromMe ?? true;
    
    const success = await evolutionReactToMessage(targetInstance, messageId, selectedChat.remoteJid, fromMe, reaction);
    if (!success) {
      toast({ title: "Erro ao reagir à mensagem", variant: "destructive" });
    }
  }, [selectedChat, selectedInstance, messages, evolutionReactToMessage]);

  // Handler for downloading media
  const handleDownloadMedia = useCallback(async (messageId: string, convertToMp4 = false) => {
    // Meta/WABA chat - download via Graph API
    if (selectedChat?.isMeta && selectedChat?.metaPageId) {
      // Find the message to get its mediaUrl (whatsapp-media://<id>)
      const msg = messages.find((m) => m.id === messageId);
      const rawMediaUrl = msg?.mediaUrl || "";
      const mediaId = rawMediaUrl.replace("whatsapp-media://", "");
      if (!mediaId) return null;

      try {
        const { data, error } = await supabase.functions.invoke("meta-download-media", {
          body: { metaPageId: selectedChat.metaPageId, mediaId },
        });
        if (error || data?.error) {
          console.error("[Chats] Meta media download error:", error || data?.error);
          return null;
        }
        return { base64: data.base64, mimetype: data.mimetype };
      } catch (err) {
        console.error("[Chats] Meta media download failed:", err);
        return null;
      }
    }

    // Evolution API chat
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return null;
    return downloadMedia(targetInstance, messageId, convertToMp4);
  }, [selectedInstance, selectedChat, downloadMedia, messages]);

  // Handler for sending text message
  const handleSendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!selectedChat) return false;

    // Meta chat - send via Graph API
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      const result = await sendMetaMessage(selectedChat.metaPageId, selectedChat.metaSenderId, text);
      if (result.success) {
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
        requestAnimationFrame(() => scrollToBottom());
      } else {
        const raw = result.errorMessage || "";
        // Friendly translation of common Meta errors
        let friendly = raw || "Não foi possível enviar a mensagem.";
        if (/outside.*allowed window|24[- ]?hour|message.*window/i.test(raw) || /\(#10\)/.test(raw) || /\(#100\)/.test(raw)) {
          friendly =
            "A janela de 24h do Messenger/Instagram expirou. O Meta só permite responder até 24h após a última mensagem do contato. Aguarde uma nova mensagem dele para responder.";
        } else if (/token.*expir|reconecte|OAuth/i.test(raw)) {
          friendly = "Token da página Meta expirou. Reconecte em Configurações → Conexões.";
        }
        toast({ title: "Erro ao enviar", description: friendly, variant: "destructive" });
      }
      return result.success;
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
      requestAnimationFrame(() => scrollToBottom());
    } else {
      toast({ title: "Erro ao enviar", description: apiError || "Não foi possível enviar a mensagem.", variant: "destructive" });
    }
    
    if (success) {
      autoAssignLead(selectedChat);
      // Outbound WA message is now persisted server-side by the
      // `evolution-api/send-text` edge function (with service role).
      // This guarantees persistence even when a super admin sends from
      // another workspace via ?admin_ws= and is NOT a member there.
      if (workspaceId && !selectedChat.isMeta) {
        // Log message sent to lead_history (best-effort)
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
    if (!selectedChat) return false;

    // Meta/WABA: upload to storage and send via meta-send-message
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      try {
        const mediatype = getMediaType(file);
        const fileName = `meta-media/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("campaign-attachments")
          .upload(fileName, file, { contentType: file.type });
        if (uploadError || !uploadData) throw new Error(uploadError?.message || "Upload failed");
        const { data: urlData } = supabase.storage.from("campaign-attachments").getPublicUrl(fileName);
        const mediaUrl = urlData?.publicUrl;
        if (!mediaUrl) throw new Error("Could not get public URL");

        const { error } = await supabase.functions.invoke("meta-send-message", {
          body: {
            metaPageId: selectedChat.metaPageId,
            recipientId: selectedChat.metaSenderId,
            message: caption || "",
            messageType: mediatype,
            mediaUrl,
          },
        });
        if (error) throw error;

        const newMessage: Message = {
          id: `local-${Date.now()}`,
          content: caption || "",
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          sent: true,
          read: false,
          type: mediatype,
          fileName: file.name,
        };
        setMessages((prev) => [...prev, newMessage]);
        requestAnimationFrame(() => scrollToBottom());
        autoAssignLead(selectedChat);
        return true;
      } catch (err: any) {
        console.error("[Chats] Meta sendMedia error:", err);
        toast({ title: "Erro ao enviar mídia", description: err.message || "Tente novamente.", variant: "destructive" });
        return false;
      }
    }

    // Evolution API path
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return false;
    
    const mediatype = getMediaType(file);
    const base64 = await fileToBase64(file);
    const number = resolveRecipientNumber(selectedChat);
    if (!number) {
      toast({ title: "Número não encontrado", description: "Não foi possível identificar o número deste contato. Atualize o telefone no painel do lead.", variant: "destructive" });
      return false;
    }
    const success = await sendMedia(targetInstance, number, mediatype, base64, caption, file.name);
    
    if (success) {
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
      requestAnimationFrame(() => scrollToBottom());
    } else {
      toast({
        title: "Erro ao enviar mídia",
        description: apiError || `Não foi possível enviar ${file.name}.`,
        variant: "destructive",
      });
    }
    
    if (success) autoAssignLead(selectedChat);
    return success;
  }, [selectedInstance, selectedChat, sendMedia, autoAssignLead]);

  // Handler for sending audio
  const handleSendAudio = useCallback(async (audioBlob: Blob): Promise<boolean> => {
    if (!selectedChat) return false;

    // Meta/WABA: upload to storage and send via meta-send-message
    if (selectedChat.isMeta && selectedChat.metaPageId && selectedChat.metaSenderId) {
      try {
        const fileName = `meta-audio/${Date.now()}-audio.ogg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("campaign-attachments")
          .upload(fileName, audioBlob, { contentType: "audio/ogg" });
        if (uploadError || !uploadData) throw new Error(uploadError?.message || "Upload failed");
        const { data: urlData } = supabase.storage.from("campaign-attachments").getPublicUrl(fileName);
        const mediaUrl = urlData?.publicUrl;
        if (!mediaUrl) throw new Error("Could not get public URL");

        const { error } = await supabase.functions.invoke("meta-send-message", {
          body: {
            metaPageId: selectedChat.metaPageId,
            recipientId: selectedChat.metaSenderId,
            message: "",
            messageType: "audio",
            mediaUrl,
          },
        });
        if (error) throw error;

        const reader = new FileReader();
        const localAudioDataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });

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
        requestAnimationFrame(() => scrollToBottom());
        autoAssignLead(selectedChat);
        return true;
      } catch (err: any) {
        console.error("[Chats] Meta sendAudio error:", err);
        toast({ title: "Erro ao enviar áudio", description: err.message || "Tente novamente.", variant: "destructive" });
        return false;
      }
    }

    // Evolution API path
    const targetInstance = selectedChat?.instanceName || selectedInstance;
    if (!targetInstance || targetInstance === "all") return false;
    
    const number = resolveRecipientNumber(selectedChat);
    if (!number) {
      toast({ title: "Número não encontrado", description: "Não foi possível identificar o número deste contato. Atualize o telefone no painel do lead.", variant: "destructive" });
      return false;
    }
    const base64 = await blobToBase64(audioBlob);
    
    const reader = new FileReader();
    const localAudioDataUrl = await new Promise<string>((resolve) => {
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(audioBlob);
    });
    
    const success = await sendAudio(targetInstance, number, base64);
    
    if (success) {
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
      requestAnimationFrame(() => scrollToBottom());
    } else {
      toast({
        title: "Erro ao enviar áudio",
        description: apiError || "Não foi possível enviar o áudio.",
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
            .neq('instance_type', 'alerts')
            .eq('workspace_id', workspaceId);
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
    // Merge funnel leads + override leads (overrides must be applied last for freshness)
    const allLeads = [...leads, ...Array.from(chatLeadOverrides.values())];
    for (const lead of allLeads) {
      if (lead.whatsapp_jid) byJid.set(lead.whatsapp_jid, lead);
      const digits = (lead.phone || '').replace(/[^0-9]/g, '');
      if (digits.length >= 10) byPhone10.set(digits.slice(-10), lead);
    }
    leadMapsRef.current = { byJid, byPhone10 };
  }, [leads, chatLeadOverrides]);

  // Fast O(1) lead lookup using maps
  const findLeadByChat = useCallback((remoteJid: string, remoteJidAlt?: string, phone?: string): Lead | undefined => {
    const maps = leadMapsRef.current;
    if (maps.byJid.has(remoteJid)) return maps.byJid.get(remoteJid);
    if (remoteJidAlt && maps.byJid.has(remoteJidAlt)) return maps.byJid.get(remoteJidAlt);

    const candidatePhones = [phone || "", remoteJidAlt || "", remoteJid || ""];
    for (const candidate of candidatePhones) {
      const digits = cleanPhoneNumber(candidate);
      if (digits.length >= 10 && digits.length <= 13) {
        const lead = maps.byPhone10.get(digits.slice(-10));
        if (lead) return lead;
      }
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
  // When "all" is selected, loads all chats; otherwise filters by instance_name
  const loadChatsFromDB = useCallback(async (instanceName?: string): Promise<(Chat & { _timestamp?: number })[]> => {
    try {
      if (!workspaceId) return [];

      // Query whatsapp_messages grouped by remote_jid to build a chat list
      let query = supabase
        .from("whatsapp_messages")
        .select("remote_jid, push_name, content, direction, timestamp, instance_name, from_me, message_id")
        .eq("workspace_id", workspaceId)
        .order("timestamp", { ascending: false })
        .limit(1000);

      // Filter by instance_name when a specific instance is selected
      if (instanceName && instanceName !== "all") {
        query = query.eq("instance_name", instanceName);
      }

      const { data: msgs, error } = await query;
      if (error || !msgs || msgs.length === 0) return [];

      // Resolve @lid messages to canonical session JID using webhook_message_log
      const lidMessageIds = msgs
        .filter((msg) => msg.remote_jid?.endsWith("@lid") && msg.message_id)
        .map((msg) => msg.message_id as string)
        .slice(0, 1000);

      const sessionByMessageId = new Map<string, string>();
      if (lidMessageIds.length > 0) {
        const { data: logRows } = await supabase
          .from("webhook_message_log")
          .select("message_id, session_id")
          .eq("workspace_id", workspaceId)
          .in("message_id", lidMessageIds);

        for (const row of logRows || []) {
          if (row.message_id && row.session_id) {
            sessionByMessageId.set(row.message_id, row.session_id);
          }
        }
      }

      // Group by canonical phone-per-instance (preferred) to keep one chat per number
      const chatMap = new Map<string, {
        remoteJid: string;
        allJids: string[];
        name: string;
        lastMessage: string;
        timestamp: string;
        fromMe: boolean;
        instanceName: string;
        leadId?: string;
        resolvedSessionJid?: string;
      }>();

      // Build a lookup from leads for fast matching
      const currentLeads = leadsRef.current;
      const leadByJid = new Map<string, typeof currentLeads[number]>();
      const leadByPhone10 = new Map<string, typeof currentLeads[number]>();
      for (const lead of currentLeads) {
        if (lead.whatsapp_jid) leadByJid.set(lead.whatsapp_jid, lead);
        const ld = (lead.phone || "").replace(/[^0-9]/g, "");
        if (ld.length >= 10) leadByPhone10.set(ld.slice(-10), lead);
      }

      for (const msg of msgs) {
        if (!msg.remote_jid || msg.remote_jid.endsWith("@g.us")) continue;

        const mappedSessionJid = msg.message_id ? sessionByMessageId.get(msg.message_id) : undefined;

        // Find the matching lead for this message JID/session
        let matchedLead = leadByJid.get(msg.remote_jid);
        if (!matchedLead && mappedSessionJid) {
          matchedLead = leadByJid.get(mappedSessionJid);
        }

        const msgDigits = cleanPhoneNumber(msg.remote_jid);
        const sessionDigits = cleanPhoneNumber(mappedSessionJid || "");
        const leadDigits = cleanPhoneNumber(matchedLead?.phone || "");

        if (!matchedLead) {
          const byMsgPhone = msgDigits.length >= 10 && msgDigits.length <= 13
            ? leadByPhone10.get(msgDigits.slice(-10))
            : undefined;
          const bySessionPhone = sessionDigits.length >= 10 && sessionDigits.length <= 13
            ? leadByPhone10.get(sessionDigits.slice(-10))
            : undefined;
          matchedLead = byMsgPhone || bySessionPhone;
        }

        const canonicalDigits = [leadDigits, sessionDigits, msgDigits].find(
          (digits) => digits.length >= 10 && digits.length <= 13
        ) || "";

        const dedupKey = canonicalDigits
          ? `inst:${msg.instance_name}:phone:${canonicalDigits.slice(-10)}`
          : `inst:${msg.instance_name}:jid:${mappedSessionJid || msg.remote_jid}`;

        const preferredRemoteJid =
          (sessionDigits.length >= 10 && sessionDigits.length <= 13 && mappedSessionJid) ||
          (msgDigits.length >= 10 && msgDigits.length <= 13 ? msg.remote_jid : undefined) ||
          msg.remote_jid;

        const existing = chatMap.get(dedupKey);
        if (!existing) {
          const allJids = [msg.remote_jid];
          if (mappedSessionJid && !allJids.includes(mappedSessionJid)) allJids.push(mappedSessionJid);

          chatMap.set(dedupKey, {
            remoteJid: preferredRemoteJid,
            allJids,
            name: msg.push_name || "",
            lastMessage: msg.content || "",
            timestamp: msg.timestamp,
            fromMe: msg.from_me || msg.direction === "outbound",
            instanceName: msg.instance_name,
            leadId: matchedLead?.id,
            resolvedSessionJid: mappedSessionJid,
          });
        } else {
          if (!existing.allJids.includes(msg.remote_jid)) {
            existing.allJids.push(msg.remote_jid);
          }
          if (mappedSessionJid && !existing.allJids.includes(mappedSessionJid)) {
            existing.allJids.push(mappedSessionJid);
          }
          if (!existing.leadId && matchedLead?.id) existing.leadId = matchedLead.id;
          if (!existing.resolvedSessionJid && mappedSessionJid) existing.resolvedSessionJid = mappedSessionJid;

          // Keep the newest message metadata
          if (new Date(msg.timestamp) > new Date(existing.timestamp)) {
            existing.lastMessage = msg.content || existing.lastMessage;
            existing.timestamp = msg.timestamp;
            existing.fromMe = msg.from_me || msg.direction === "outbound";
            existing.remoteJid = preferredRemoteJid;
            if (msg.push_name) existing.name = msg.push_name;
          }
        }
      }

      // Convert to Chat objects
      const chats: (Chat & { _timestamp?: number })[] = [];
      for (const [, info] of chatMap) {
        const ts = new Date(info.timestamp).getTime() / 1000;

        const preferredRealJid = info.allJids.find((jid) => {
          const digits = cleanPhoneNumber(jid);
          return (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) && digits.length >= 10 && digits.length <= 13;
        });

        const primaryJid = preferredRealJid || info.remoteJid;
        const secondaryJid = info.allJids.find((jid) => jid !== primaryJid);

        // Use already-matched lead or find one
        const primaryDigits = cleanPhoneNumber(primaryJid);
        const secondaryDigits = cleanPhoneNumber(secondaryJid || "");
        const resolvedDigits = cleanPhoneNumber(info.resolvedSessionJid || "");

        const matchingLead = info.leadId
          ? currentLeads.find((l) => l.id === info.leadId)
          : currentLeads.find((l) => {
              if (l.whatsapp_jid === primaryJid) return true;
              if (secondaryJid && l.whatsapp_jid === secondaryJid) return true;
              if (info.resolvedSessionJid && l.whatsapp_jid === info.resolvedSessionJid) return true;

              const leadDigits = cleanPhoneNumber(l.phone || "");
              if (leadDigits.length >= 10) {
                if (primaryDigits.length >= 10 && leadDigits.slice(-10) === primaryDigits.slice(-10)) return true;
                if (secondaryDigits.length >= 10 && leadDigits.slice(-10) === secondaryDigits.slice(-10)) return true;
                if (resolvedDigits.length >= 10 && leadDigits.slice(-10) === resolvedDigits.slice(-10)) return true;
              }
              return false;
            });

        const leadDigits = cleanPhoneNumber(matchingLead?.phone || "");
        const bestPhoneDigits = [leadDigits, primaryDigits, secondaryDigits, resolvedDigits].find(
          (digits) => digits.length >= 10 && digits.length <= 13
        ) || "";

        const phone = formatPhoneDisplay(bestPhoneDigits);
        const displayName = matchingLead?.name || info.name || phone || "Contato WhatsApp";
        const canonicalId = info.instanceName
          ? (bestPhoneDigits
            ? `chat:${info.instanceName}:phone:${bestPhoneDigits.slice(-10)}`
            : `chat:${info.instanceName}:jid:${primaryJid}`)
          : (bestPhoneDigits ? `chat:all:phone:${bestPhoneDigits.slice(-10)}` : `chat:all:jid:${primaryJid}`);

        chats.push({
          id: canonicalId,
          remoteJid: primaryJid,
          remoteJidAlt: secondaryJid,
          name: displayName,
          lastMessage: info.lastMessage,
          time: formatTime(ts),
          unread: 0,
          online: false,
          phone,
          lastMessageFromMe: info.fromMe,
          instanceName: info.instanceName,
          instanceLabel: info.instanceName,
          _timestamp: ts,
        });
      }

      chats.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
      console.log(`[Chats] Loaded ${chats.length} chats from local DB${instanceName ? ` for ${instanceName}` : ""}`);
      return chats;
    } catch (err) {
      console.error("[Chats] Error loading chats from DB:", err);
      return [];
    }
  }, [workspaceId]);

  // Load more chats (older conversations) - triggered by "Carregar mais" button
  const loadMoreChats = useCallback(async () => {
    if (loadingMoreChats || !workspaceId) return;

    // Meta/WABA pagination — delegate to the hook
    if (selectedInstance?.startsWith("meta:")) {
      if (!hasMoreMetaConvs || metaLoading) return;
      setLoadingMoreChats(true);
      try {
        const newConvs = await fetchMoreMetaConversations();
        if (newConvs.length > 0) {
          const newChats = newConvs.map((conv) => ({
            id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
            remoteJid: conv.sender_id,
            name: conv.sender_name || conv.sender_id,
            lastMessage: conv.last_message,
            time: formatMetaTime(conv.last_timestamp),
            unread: conv.unread_count,
            online: false,
            phone: conv.sender_id,
            lastMessageFromMe: conv.last_direction === "outbound",
            isMeta: true,
            metaPageId: conv.meta_page_id,
            metaSenderId: conv.sender_id,
            metaPlatform: conv.platform,
            instanceLabel: conv.page_name || conv.platform,
            _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
          }));
          setChats((prev) => {
            const existingKeys = new Set(prev.map((c) => c.id));
            const added = newChats.filter((c: any) => !existingKeys.has(c.id));
            return added.length > 0 ? [...prev, ...added] : prev;
          });
        }
        if (!hasMoreMetaConvs) setHasMoreChats(false);
      } finally {
        setLoadingMoreChats(false);
      }
      return;
    }

    setLoadingMoreChats(true);
    try {
      const instanceName = selectedInstance === "all" ? "all" : selectedInstance;
      
      const BATCH = 200; // fetch 200 msgs ≈ ~30-50 unique chats
      let query = supabase
        .from("whatsapp_messages")
        .select("remote_jid, push_name, content, direction, timestamp, instance_name, from_me, message_id")
        .eq("workspace_id", workspaceId)
        .order("timestamp", { ascending: false })
        .range(chatListOffsetRef.current, chatListOffsetRef.current + BATCH - 1);

      if (instanceName && instanceName !== "all" && !instanceName?.startsWith("meta:")) {
        query = query.eq("instance_name", instanceName);
      }

      const { data: msgs, error } = await query;
      if (error || !msgs || msgs.length === 0) {
        setHasMoreChats(false);
        return;
      }

      if (msgs.length < BATCH) setHasMoreChats(false);
      chatListOffsetRef.current += msgs.length;

      // Resolve @lid messages
      const lidMessageIds = msgs
        .filter((msg) => msg.remote_jid?.endsWith("@lid") && msg.message_id)
        .map((msg) => msg.message_id as string)
        .slice(0, 1000);

      const sessionByMessageId = new Map<string, string>();
      if (lidMessageIds.length > 0) {
        const { data: logRows } = await supabase
          .from("webhook_message_log")
          .select("message_id, session_id")
          .eq("workspace_id", workspaceId)
          .in("message_id", lidMessageIds);
        for (const row of logRows || []) {
          if (row.message_id && row.session_id) sessionByMessageId.set(row.message_id, row.session_id);
        }
      }

      const currentLeads = leadsRef.current;
      const leadByJid = new Map<string, typeof currentLeads[number]>();
      const leadByPhone10 = new Map<string, typeof currentLeads[number]>();
      for (const lead of currentLeads) {
        if (lead.whatsapp_jid) leadByJid.set(lead.whatsapp_jid, lead);
        const ld = (lead.phone || "").replace(/[^0-9]/g, "");
        if (ld.length >= 10) leadByPhone10.set(ld.slice(-10), lead);
      }

      const chatMap = new Map<string, any>();
      for (const msg of msgs) {
        if (!msg.remote_jid || msg.remote_jid.endsWith("@g.us")) continue;
        const mappedSessionJid = msg.message_id ? sessionByMessageId.get(msg.message_id) : undefined;
        let matchedLead = leadByJid.get(msg.remote_jid);
        if (!matchedLead && mappedSessionJid) matchedLead = leadByJid.get(mappedSessionJid);
        const msgDigits = cleanPhoneNumber(msg.remote_jid);
        if (!matchedLead && msgDigits.length >= 10 && msgDigits.length <= 13) {
          matchedLead = leadByPhone10.get(msgDigits.slice(-10));
        }

        const inst = msg.instance_name || "unknown";
        const key = `${inst}:${msgDigits.slice(-10) || msg.remote_jid}`;
        
        if (!chatMap.has(key)) {
          const displayName = matchedLead?.name || msg.push_name || formatPhoneFromJid(msg.remote_jid) || msg.remote_jid;
          const phone = matchedLead?.phone || formatPhoneFromJid(msg.remote_jid);
          chatMap.set(key, {
            id: `${inst}:${msg.remote_jid}`,
            remoteJid: msg.remote_jid,
            name: displayName,
            lastMessage: msg.content || "",
            time: formatTime(new Date(msg.timestamp).getTime() / 1000),
            unread: 0,
            online: false,
            phone,
            lastMessageFromMe: msg.from_me || msg.direction === "outbound",
            instanceName: inst,
            _timestamp: new Date(msg.timestamp).getTime() / 1000,
          });
        }
      }

      const newChats = Array.from(chatMap.values());

      setChats(prev => {
        const existingKeys = new Set(prev.map(c => c.id));
        const added = newChats.filter((c: any) => !existingKeys.has(c.id));
        if (added.length === 0) return prev;
        return [...prev, ...added].sort((a: any, b: any) => ((b as any)._timestamp || 0) - ((a as any)._timestamp || 0));
      });

    } catch (err) {
      console.error("[Chats] Error loading more chats:", err);
    } finally {
      setLoadingMoreChats(false);
    }
  }, [workspaceId, selectedInstance, loadingMoreChats, hasMoreMetaConvs, metaLoading, fetchMoreMetaConversations]);

  // Scroll-based infinite loading for chat list (ScrollArea uses custom viewport)
  useEffect(() => {
    const scrollEl = chatListScrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      if (!hasMoreChats || loadingMoreChats || loadingChats) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollEl;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMoreChats();
      }
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, [hasMoreChats, loadingMoreChats, loadingChats, loadMoreChats]);


  const dedupChats = useCallback((chatList: (Chat & { _timestamp?: number })[]) => {
    const deduped = new Map<string, (Chat & { _timestamp?: number })>();
    const jidToKey = new Map<string, string>();
    const phoneToKey = new Map<string, string>();

    const setAlias = (jid: string | undefined, key: string) => {
      if (!jid) return;
      jidToKey.set(jid, key);
    };

    const setPhoneAlias = (instanceName: string, digits: string | undefined, key: string) => {
      if (!digits || digits.length < 10 || digits.length > 13) return;
      phoneToKey.set(`${instanceName}:${digits.slice(-10)}`, key);
    };

    for (const c of chatList) {
      const instanceKey = c.instanceName || "all";
      const matchedLead = findLeadByChat(c.remoteJid, c.remoteJidAlt, c.phone);
      const leadDigits = cleanPhoneNumber(matchedLead?.phone || "");
      const chatDigits = cleanPhoneNumber(c.phone || "");
      const altDigits = cleanPhoneNumber(c.remoteJidAlt || "");
      const jidDigits = cleanPhoneNumber(c.remoteJid || "");

      const canonicalDigits = [chatDigits, leadDigits, altDigits, jidDigits].find(
        (digits) => digits.length >= 10 && digits.length <= 13
      );

      const computedKey = canonicalDigits
        ? `${instanceKey}:phone:${canonicalDigits.slice(-10)}`
        : `${instanceKey}:${matchedLead?.id || c.remoteJid}`;

      const aliasKey = jidToKey.get(c.remoteJid) || (c.remoteJidAlt ? jidToKey.get(c.remoteJidAlt) : undefined);
      const phoneAliasKey = canonicalDigits ? phoneToKey.get(`${instanceKey}:${canonicalDigits.slice(-10)}`) : undefined;
      const key = aliasKey || phoneAliasKey || computedKey;

      const existing = deduped.get(key);
      const currentTs = c._timestamp || 0;
      const existingTs = existing?._timestamp || 0;
      const winner = currentTs >= existingTs ? c : existing!;
      const loser = currentTs >= existingTs ? existing : c;

      const merged: Chat & { _timestamp?: number } = {
        ...(loser || {} as Chat),
        ...winner,
        id: key,
        remoteJidAlt: winner.remoteJidAlt || loser?.remoteJidAlt,
        phone: winner.phone || loser?.phone || "",
        _timestamp: Math.max(currentTs, existingTs),
      };

      deduped.set(key, merged);
      setAlias(merged.remoteJid, key);
      setAlias(merged.remoteJidAlt, key);
      setAlias(c.remoteJid, key);
      setAlias(c.remoteJidAlt, key);
      setPhoneAlias(instanceKey, canonicalDigits, key);
      setPhoneAlias(instanceKey, cleanPhoneNumber(merged.phone || ""), key);
    }

    const result = Array.from(deduped.values());
    result.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
    return result.slice(0, 100);
  }, [findLeadByChat]);

  // Load chats: DB-first (instant render), then API merge (background)
  useEffect(() => {
    if (!selectedInstance) return;
    let cancelled = false;

    const loadChats = async () => {
      setLoadingChats(true);
      setChatError(null);
      chatListOffsetRef.current = 1000; // Reset pagination offset
      setHasMoreChats(true);
      try {
        const isMetaSource = selectedInstance.startsWith("meta:");
        
        // Compute server-side direction filter for Meta/WABA conversations
        const metaDirectionFilter = activeFilters?.responseStatus?.includes("unanswered") 
          ? "inbound" as const
          : activeFilters?.responseStatus?.includes("answered")
            ? "outbound" as const
            : undefined;

        if (isMetaSource) {
          // Load Meta conversations only
          const metaPageId = selectedInstance.replace("meta:", "");
          const convs = await fetchMetaConversations(metaPageId, metaDirectionFilter);
          const allChats = (convs || []).map((conv) => ({
            id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
            remoteJid: conv.sender_id,
            name: conv.sender_name || conv.sender_id,
            lastMessage: conv.last_message,
            time: formatMetaTime(conv.last_timestamp),
            unread: conv.unread_count,
            online: false,
            phone: conv.sender_id,
            lastMessageFromMe: conv.last_direction === "outbound",
            isMeta: true,
            metaPageId: conv.meta_page_id,
            metaSenderId: conv.sender_id,
            metaPlatform: conv.platform,
            instanceLabel: conv.page_name || conv.platform,
            _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
          }));
          if (!cancelled) {
            const hasUrlSearch = new URLSearchParams(window.location.search).has("search");
            setChats(allChats);
            setHasMoreChats(hasMoreMetaConvs);
            if (allChats.length > 0 && !selectedChat && !hasUrlSearch) setSelectedChat(allChats[0]);
            setLoadingChats(false);
          }
        } else {
          // ═══ PHASE 1: DB-first instant render ═══
          const dbChats = await loadChatsFromDB(selectedInstance === "all" ? "all" : selectedInstance);
          const initialChats = dedupChats(dbChats);
          
          if (!cancelled) {
            const hasUrlSearch = new URLSearchParams(window.location.search).has("search");
            setChats(initialChats);
            setChatError(null);
            if (initialChats.length > 0 && !selectedChat && !hasUrlSearch) setSelectedChat(initialChats[0]);
            setLoadingChats(false); // ← UI visible now! User can interact
          }

          // ═══ PHASE 2: Background API fetch (non-blocking) ═══
          try {
            let apiChats: (Chat & { _timestamp?: number })[] = [];
            
            if (selectedInstance === "all") {
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
                } catch {
                  return [];
                }
              });
              const results = await Promise.all(promises);
              apiChats = results.flat();

              // Also fetch Meta conversations in background
              if (metaPages.length > 0) {
                try {
                  const metaConvs = await fetchMetaConversations(undefined, metaDirectionFilter);
                  const metaChats = (metaConvs || []).map((conv) => ({
                    id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
                    remoteJid: conv.sender_id,
                    name: conv.sender_name || conv.sender_id,
                    lastMessage: conv.last_message,
                    time: formatMetaTime(conv.last_timestamp),
                    unread: conv.unread_count,
                    online: false,
                    phone: conv.sender_id,
                    lastMessageFromMe: conv.last_direction === "outbound",
                    isMeta: true,
                    metaPageId: conv.meta_page_id,
                    metaSenderId: conv.sender_id,
                    metaPlatform: conv.platform,
                    instanceLabel: conv.page_name || conv.platform,
                    _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
                  }));
                  apiChats = [...apiChats, ...metaChats];
                } catch (err) {
                  console.error("[Chats] Error fetching Meta conversations:", err);
                }
              }
            } else if (!selectedInstance.startsWith("meta:")) {
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
            }

            // Merge API data into existing chats silently
            if (!cancelled && apiChats.length > 0) {
              setChats(prev => dedupChats([...prev, ...apiChats]));
            }
          } catch (err) {
            console.warn("[Chats] Background API fetch failed:", err);
          }
        }
      } catch (err) {
        console.error("[Chats] Error loading chats:", err);
        setChatError(`Não foi possível carregar conversas. Tente novamente.`);
        toast({ title: "Erro ao carregar conversas", description: "Tente novamente.", variant: "destructive" });
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    };

    loadChats();
    return () => { cancelled = true; };
  }, [selectedInstance, instances, metaPages, transformChatData, fetchMetaConversations, dedupChats, activeFilters]);

  // Background: auto-create leads for chats without matching leads (non-blocking)
  useEffect(() => {
    if (chats.length === 0 || !workspaceId) return;
    
    const autoCreateLeads = async () => {
      const chatsNeedingLeads: { chat: Chat }[] = [];
      
      for (const chat of chats) {
        if (chat.isMeta) continue;
        if (processedJidsRef.current.has(chat.remoteJid)) continue;

        const existingLead = findLeadByChat(chat.remoteJid, chat.remoteJidAlt, chat.phone);
        const preferredJid = chat.remoteJidAlt?.endsWith("@s.whatsapp.net")
          ? chat.remoteJidAlt
          : chat.remoteJid;

        if (!existingLead) {
          chatsNeedingLeads.push({ chat });
        } else if (existingLead.whatsapp_jid !== preferredJid) {
          processedJidsRef.current.add(chat.remoteJid);
          if (preferredJid.endsWith("@s.whatsapp.net")) {
            updateLead(existingLead.id, { whatsapp_jid: preferredJid }).catch(() => {});
          }
        } else {
          processedJidsRef.current.add(chat.remoteJid);
        }
      }

      if (chatsNeedingLeads.length > 0) {
        console.log(`[Chats] Background: auto-creating ${chatsNeedingLeads.length} leads`);
        const BATCH_SIZE = 20;
        for (let i = 0; i < chatsNeedingLeads.length; i += BATCH_SIZE) {
          const batch = chatsNeedingLeads.slice(i, i + BATCH_SIZE);
          for (const { chat } of batch) {
            try {
              const phoneDigits = cleanPhoneNumber(chat.phone || "");
              const altDigits = cleanPhoneNumber(chat.remoteJidAlt || "");
              const normalizedPhone = (phoneDigits.length >= 10 && phoneDigits.length <= 13)
                ? phoneDigits
                : (altDigits.length >= 10 && altDigits.length <= 13 ? altDigits : "");

              // Não criar lead sem número real (evita duplicidade com phone vazio)
              if (!normalizedPhone) {
                console.log(`[Chats] Skipping auto-create for unresolved chat ${chat.remoteJid}`);
                continue;
              }

              const preferredJid = chat.remoteJid.endsWith("@lid") && chat.remoteJidAlt?.endsWith("@s.whatsapp.net")
                ? chat.remoteJidAlt
                : chat.remoteJid;

              processedJidsRef.current.add(chat.remoteJid);

              const isLidChat = chat.remoteJid?.endsWith("@lid");
              const rawName = chat.name || "";
              const nameIsJid = rawName.includes("@") || /^\d{14,}$/.test(rawName.replace(/[^0-9]/g, ""));
              const leadName = nameIsJid
                ? (isLidChat ? "Contato WhatsApp" : (normalizedPhone || "Contato WhatsApp"))
                : (rawName || normalizedPhone || "Contato WhatsApp");

              const newLead = await createLeadSilentRef.current({
                name: leadName,
                phone: normalizedPhone,
                whatsapp_jid: preferredJid,
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
    };
    
    // Run after a short delay to ensure UI is fully rendered first
    const timer = setTimeout(autoCreateLeads, 500);
    return () => clearTimeout(timer);
  }, [chats.length, workspaceId, findLeadByChat, updateLead]);

  // Ref to track which JIDs have been enriched to avoid duplicate API calls
  const enrichedJidsRef = useRef<Set<string>>(new Set());

  // Enrich chats with profile photos asynchronously (non-blocking, batched updates)
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
      // Accumulate all updates, then apply in a single setChats call
      const updates = new Map<string, { profilePicUrl?: string; name?: string }>();
      
      for (const chat of chatsToEnrich) {
        const targetInstance = chat.instanceName || selectedInstance;
        if (!targetInstance || targetInstance === "all") continue;
        
        enrichedJidsRef.current.add(chat.remoteJid);
        const number = extractNumberFromJid(chat.remoteJid);
        
        try {
          const profile = await fetchProfile(targetInstance, number);
          if (profile && (profile.name || profile.profilePicUrl)) {
            updates.set(chat.remoteJid, {
              profilePicUrl: profile.profilePicUrl,
              name: profile.name,
            });
          }
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          console.warn(`[Chats] Failed to enrich ${chat.remoteJid}:`, err);
        }
      }
      
      // Apply all profile updates in a single render
      if (updates.size > 0) {
        setChats((prev) =>
          prev.map((c) => {
            const update = updates.get(c.remoteJid);
            if (!update) return c;
            return {
              ...c,
              profilePicUrl: update.profilePicUrl || c.profilePicUrl,
              name: (!c.name || c.name === c.phone) && update.name ? update.name : c.name,
            };
          })
        );
      }
    };

    // Run non-blocking
    enrichChats();
  }, [chats.length, selectedInstance, fetchProfile]);

  // Load messages when chat is selected (with cache + instant switch)
  useEffect(() => {
    if (!selectedChat) return;

    const chatId = selectedChat.id;
    
    // ═══ INSTANT SWITCH: Clear previous messages immediately, show cache or skeleton ═══
    const cached = messageCacheRef.current.get(chatId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setHasMoreMessages(cached.length >= 30);
      setLoadingMessages(false);
      // Still fetch fresh data in background below
    } else {
      setMessages([]);              // ← Clears ghost from previous chat IMMEDIATELY
      setLoadingMessages(true);     // Show skeleton only for uncached chats
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
              type: (msg.message_type === "image" ? "image" : msg.message_type === "video" ? "video" : msg.message_type === "audio" ? "audio" : msg.message_type === "contact" ? "contact" : "text") as Message["type"],
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

          const apiMessages: Message[] = data
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
                _ts: timestamp ? timestamp * 1000 : Date.now(),
              };
            })
            .reverse();

          // ═══ MERGE: Also fetch DB messages to fill gaps (AI responses, missed inbound) ═══
          let mergedMessages = apiMessages;
          try {
            const phoneDigits = cleanPhoneNumber(selectedChat.phone || "");
            const allJids = new Set<string>([selectedChat.remoteJid]);
            if (selectedChat.remoteJidAlt) allJids.add(selectedChat.remoteJidAlt);
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

            const jidFilters = Array.from(allJids).map(j => `remote_jid.eq.${j}`);
            if (phoneDigits.length >= 10) {
              jidFilters.push(`remote_jid.like.%${phoneDigits.slice(-10)}%`);
            }

            const chatInst = selectedChat.instanceName || (selectedInstance && selectedInstance !== 'all' ? selectedInstance : null);

            // Pull mapped message_ids for this canonical session to include @lid rows
            const sessionIds = Array.from(allJids);
            let mappedMessageIds: string[] = [];
            if (workspaceId && sessionIds.length > 0) {
              const { data: logRows } = await supabase
                .from('webhook_message_log')
                .select('message_id, session_id')
                .eq('workspace_id', workspaceId)
                .in('session_id', sessionIds)
                .order('processed_at', { ascending: false })
                .limit(400);

              mappedMessageIds = (logRows || [])
                .map((r) => r.message_id)
                .filter((id): id is string => !!id);
            }

            let dbMergeQuery = supabase
              .from('whatsapp_messages')
              .select('*')
              .or(jidFilters.join(','))
              .order('timestamp', { ascending: true })
              .limit(300);

            if (workspaceId) dbMergeQuery = dbMergeQuery.eq('workspace_id', workspaceId);
            if (chatInst) dbMergeQuery = dbMergeQuery.eq('instance_name', chatInst);

            const { data: dbMerge } = await dbMergeQuery;

            let dbRows = dbMerge || [];
            if (mappedMessageIds.length > 0) {
              let mappedQuery = supabase
                .from('whatsapp_messages')
                .select('*')
                .in('message_id', mappedMessageIds)
                .order('timestamp', { ascending: true })
                .limit(300);

              if (workspaceId) mappedQuery = mappedQuery.eq('workspace_id', workspaceId);
              if (chatInst) mappedQuery = mappedQuery.eq('instance_name', chatInst);

              const { data: mappedRows } = await mappedQuery;
              if (mappedRows && mappedRows.length > 0) {
                const mergedById = new Map<string, any>();
                for (const row of [...dbRows, ...mappedRows]) {
                  mergedById.set(row.message_id || row.id, row);
                }
                dbRows = Array.from(mergedById.values()).sort(
                  (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                );
              }
            }

            if (dbRows.length > 0) {
              const apiIds = new Set(apiMessages.map(m => m.id));
              // Build a content+time fingerprint set from API messages for fuzzy dedup
              const apiFingerprints = new Set<string>();
              for (const m of apiMessages) {
                const ts = (m as any)._ts;
                if (ts && m.content) {
                  // Round to nearest 5 seconds to handle slight timestamp differences
                  const roundedTs = Math.round(ts / 5000) * 5000;
                  apiFingerprints.add(`${m.sent}:${roundedTs}:${m.content.slice(0, 80)}`);
                  // Also add ±5s variants for edge cases
                  apiFingerprints.add(`${m.sent}:${roundedTs - 5000}:${m.content.slice(0, 80)}`);
                  apiFingerprints.add(`${m.sent}:${roundedTs + 5000}:${m.content.slice(0, 80)}`);
                }
              }

              const dbOnly: Message[] = dbRows
                .filter(m => {
                  // Skip if message_id or id matches an API message
                  if (apiIds.has(m.message_id || '') || apiIds.has(m.id)) return false;
                  // Skip if content+timestamp fingerprint matches (fuzzy dedup)
                  const dbTs = new Date(m.timestamp).getTime();
                  const roundedDbTs = Math.round(dbTs / 5000) * 5000;
                  const isSent = m.from_me || m.direction === 'outbound';
                  const content = (m.content || '').slice(0, 80);
                  if (content && apiFingerprints.has(`${isSent}:${roundedDbTs}:${content}`)) return false;
                  return true;
                })
                .map(m => {
                  const date = new Date(m.timestamp);
                  return {
                    id: m.message_id || m.id,
                    content: m.content || '',
                    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                    sent: m.from_me || m.direction === 'outbound',
                    read: true,
                    type: (m.message_type || 'text') as Message["type"],
                    _ts: date.getTime(),
                  };
                });

              if (dbOnly.length > 0) {
                const all = [...apiMessages, ...dbOnly];
                all.sort((a, b) => ((a as any)._ts || 0) - ((b as any)._ts || 0));
                mergedMessages = all;
                console.log(`[Chats] Merged ${dbOnly.length} DB-only messages with ${apiMessages.length} API messages`);
              }
            }
          } catch (mergeErr) {
            console.warn("[Chats] DB merge failed, using API messages only:", mergeErr);
          }

          setMessages(mergedMessages);
          setHasMoreMessages(data.length >= 30);
          messageCacheRef.current.set(chatId, mergedMessages);

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

          const chatInstance = selectedChat.instanceName || (selectedInstance && selectedInstance !== 'all' ? selectedInstance : null);

          // Include @lid records mapped to this canonical session through webhook_message_log
          const sessionIds = Array.from(allJids);
          let mappedMessageIds: string[] = [];
          if (workspaceId && sessionIds.length > 0) {
            const { data: logRows } = await supabase
              .from('webhook_message_log')
              .select('message_id, session_id')
              .eq('workspace_id', workspaceId)
              .in('session_id', sessionIds)
              .order('processed_at', { ascending: false })
              .limit(500);

            mappedMessageIds = (logRows || [])
              .map((r) => r.message_id)
              .filter((id): id is string => !!id);
          }

          let dbQuery = supabase
            .from('whatsapp_messages')
            .select('*')
            .or(jidFilters.join(','))
            .order('timestamp', { ascending: true })
            .limit(300);

          if (workspaceId) {
            dbQuery = dbQuery.eq('workspace_id', workspaceId);
          }
          if (chatInstance) {
            dbQuery = dbQuery.eq('instance_name', chatInstance);
          }

          const { data: dbMsgs } = await dbQuery;

          let allDbMsgs = dbMsgs || [];
          if (mappedMessageIds.length > 0) {
            let mappedQuery = supabase
              .from('whatsapp_messages')
              .select('*')
              .in('message_id', mappedMessageIds)
              .order('timestamp', { ascending: true })
              .limit(300);

            if (workspaceId) mappedQuery = mappedQuery.eq('workspace_id', workspaceId);
            if (chatInstance) mappedQuery = mappedQuery.eq('instance_name', chatInstance);

            const { data: mappedMsgs } = await mappedQuery;
            if (mappedMsgs && mappedMsgs.length > 0) {
              const byId = new Map<string, any>();
              for (const row of [...allDbMsgs, ...mappedMsgs]) {
                byId.set(row.message_id || row.id, row);
              }
              allDbMsgs = Array.from(byId.values()).sort(
                (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            }
          }

          if (allDbMsgs.length > 0) {
            const transformedMessages: Message[] = allDbMsgs.map((msg) => {
              const date = new Date(msg.timestamp);
              return {
                id: msg.message_id || msg.id,
                content: msg.content || '',
                time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                sent: msg.from_me || msg.direction === 'outbound',
                read: true,
                type: (msg.message_type || 'text') as Message["type"],
                messageId: msg.message_id || undefined,
                fromMe: msg.from_me || msg.direction === 'outbound',
                timestamp: Math.floor(date.getTime() / 1000),
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

  // ═══ REALTIME: Subscribe to new whatsapp_messages for live updates ═══
  useEffect(() => {
    if (!workspaceId || !selectedChat || selectedChat.isMeta) return;

    const channel = supabase
      .channel(`chat-realtime-${selectedChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow) return;

          // Check if this message belongs to the currently selected chat
          const msgJid = newRow.remote_jid || "";
          const chatJid = selectedChat.remoteJid || "";
          const chatJidAlt = selectedChat.remoteJidAlt || "";
          const chatPhone = cleanPhoneNumber(selectedChat.phone || "");
          const msgPhone = cleanPhoneNumber(msgJid);
          const chatInst = selectedChat.instanceName;

          // Instance must match (if set)
          if (chatInst && newRow.instance_name && chatInst !== newRow.instance_name) return;

          // JID or phone match
          const jidMatch = msgJid === chatJid || msgJid === chatJidAlt;
          const phoneMatch = chatPhone.length >= 10 && msgPhone.length >= 10 &&
            chatPhone.slice(-10) === msgPhone.slice(-10);

          if (!jidMatch && !phoneMatch) return;

          const date = new Date(newRow.timestamp);
          const newMessage: Message = {
            id: newRow.message_id || newRow.id,
            content: newRow.content || "",
            time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            sent: newRow.from_me || newRow.direction === "outbound",
            read: true,
            type: (newRow.message_type || "text") as Message["type"],
            _ts: date.getTime(),
          } as Message & { _ts: number };

          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            const updated = [...prev, newMessage];
            messageCacheRef.current.set(selectedChat.id, updated);
            return updated;
          });
          requestAnimationFrame(() => scrollToBottom());

          // Also update chat list preview
          setChats((prev) =>
            prev.map((c) => {
              if (c.id !== selectedChat.id) return c;
              return {
                ...c,
                lastMessage: newRow.content?.substring(0, 50) || c.lastMessage,
                time: "agora",
                lastMessageFromMe: newRow.from_me || newRow.direction === "outbound",
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, selectedChat?.id, selectedChat?.remoteJid, selectedChat?.remoteJidAlt, selectedChat?.phone, selectedChat?.instanceName, selectedChat?.isMeta]);


  const loadOlderMessages = useCallback(async () => {
    if (!selectedChat || loadingOlderMessages || !hasMoreMessages) return;
    
    setLoadingOlderMessages(true);
    const scrollContainer = messagesContainerRef.current;
    const prevScrollHeight = scrollContainer?.scrollHeight || 0;
    
    try {
      const currentCount = messages.length;

      // Strategy 1: Try Evolution API for WhatsApp chats
      const targetInstance = selectedChat.instanceName || selectedInstance;
      if (!selectedChat.isMeta && targetInstance && targetInstance !== "all") {
        const data = await fetchMessages(targetInstance, selectedChat.remoteJid, currentCount + 50);
        
        if (data.length <= currentCount) {
          // API exhausted — try DB fallback
        } else {
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
                _ts: timestamp ? timestamp * 1000 : Date.now(),
              };
            })
            .reverse();

          setMessages(allTransformed);
          setHasMoreMessages(data.length >= currentCount + 50);
          messageCacheRef.current.set(selectedChat.id, allTransformed);
          
          // Preserve scroll position
          requestAnimationFrame(() => {
            if (scrollContainer) {
              const newScrollHeight = scrollContainer.scrollHeight;
              scrollContainer.scrollTop = newScrollHeight - prevScrollHeight;
            }
          });
          return;
        }
      }

      // Strategy 2: Load older messages from DB (works for all chat types)
      if (workspaceId) {
        const oldestMessage = messages[0];
        const oldestTs = oldestMessage ? (oldestMessage as any)._ts 
          ? new Date((oldestMessage as any)._ts).toISOString()
          : null : null;

        const phoneDigits = cleanPhoneNumber(selectedChat.phone || "");
        const allJids = new Set<string>([selectedChat.remoteJid]);
        if (selectedChat.remoteJidAlt) allJids.add(selectedChat.remoteJidAlt);

        const jidFilters = Array.from(allJids).map(j => `remote_jid.eq.${j}`);
        if (phoneDigits.length >= 10) {
          jidFilters.push(`remote_jid.like.%${phoneDigits.slice(-10)}%`);
        }

        const chatInst = selectedChat.instanceName || (selectedInstance && selectedInstance !== 'all' ? selectedInstance : null);

        let dbQuery = supabase
          .from('whatsapp_messages')
          .select('*')
          .or(jidFilters.join(','))
          .order('timestamp', { ascending: false })
          .limit(50);

        if (workspaceId) dbQuery = dbQuery.eq('workspace_id', workspaceId);
        if (chatInst) dbQuery = dbQuery.eq('instance_name', chatInst);
        if (oldestTs) dbQuery = dbQuery.lt('timestamp', oldestTs);

        const { data: dbRows } = await dbQuery;

        if (!dbRows || dbRows.length === 0) {
          setHasMoreMessages(false);
          return;
        }

        const existingIds = new Set(messages.map(m => m.id));
        // Build fingerprints from existing messages for fuzzy dedup
        const existingFingerprints = new Set<string>();
        for (const m of messages) {
          const ts = (m as any)._ts;
          if (ts && m.content) {
            const rTs = Math.round(ts / 5000) * 5000;
            existingFingerprints.add(`${m.sent}:${rTs}:${m.content.slice(0, 80)}`);
            existingFingerprints.add(`${m.sent}:${rTs - 5000}:${m.content.slice(0, 80)}`);
            existingFingerprints.add(`${m.sent}:${rTs + 5000}:${m.content.slice(0, 80)}`);
          }
        }
        const olderMessages: Message[] = dbRows
          .filter(m => {
            if (existingIds.has(m.message_id || '') || existingIds.has(m.id)) return false;
            const dbTs = new Date(m.timestamp).getTime();
            const rTs = Math.round(dbTs / 5000) * 5000;
            const isSent = m.from_me || m.direction === 'outbound';
            const content = (m.content || '').slice(0, 80);
            if (content && existingFingerprints.has(`${isSent}:${rTs}:${content}`)) return false;
            return true;
          })
          .map(m => {
            const date = new Date(m.timestamp);
            return {
              id: m.message_id || m.id,
              content: m.content || '',
              time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
              sent: m.from_me || m.direction === 'outbound',
              read: true,
              type: (m.message_type || 'text') as Message["type"],
              _ts: date.getTime(),
            };
          });

        if (olderMessages.length === 0) {
          setHasMoreMessages(false);
          return;
        }

        const allMessages = [...olderMessages.reverse(), ...messages];
        allMessages.sort((a, b) => ((a as any)._ts || 0) - ((b as any)._ts || 0));
        
        setMessages(allMessages);
        setHasMoreMessages(dbRows.length >= 50);
        messageCacheRef.current.set(selectedChat.id, allMessages);

        // Preserve scroll position
        requestAnimationFrame(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error("[Chats] Error loading older messages:", err);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [selectedChat, selectedInstance, messages, loadingOlderMessages, hasMoreMessages, fetchMessages, workspaceId]);

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

  // Debounced content search in DB
  useEffect(() => {
    if (searchTerm.length < 3) {
      setContentSearchResults(new Set());
      setContentSearchLoading(false);
      setContentSearchTerm("");
      return;
    }

    setContentSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const term = `%${searchTerm}%`;
        const searchDigits = normalizeDigits(searchTerm);
        // Query whatsapp_messages, meta_conversations, AND leads in parallel
        // Leads search ensures we find old chats whose messages fall outside the 1000-msg DB window.
        const [waResult, metaResult, leadsResult] = await Promise.all([
          workspaceId
            ? supabase
                .from("whatsapp_messages")
                .select("remote_jid, instance_name")
                .eq("workspace_id", workspaceId)
                .ilike("content", term)
                .order("timestamp", { ascending: false })
                .limit(200)
            : Promise.resolve({ data: [] as any[], error: null }),
          workspaceId
            ? supabase
                .from("meta_conversations" as any)
                .select("sender_id, meta_page_id")
                .eq("workspace_id", workspaceId)
                .ilike("content", term)
                .order("timestamp", { ascending: false })
                .limit(200)
            : Promise.resolve({ data: [] as any[], error: null }),
          workspaceId
            ? supabase
                .from("leads")
                .select("id, name, phone, whatsapp_jid")
                .eq("workspace_id", workspaceId)
                .or(
                  searchDigits.length >= 4
                    ? `name.ilike.${term},phone.ilike.%${searchDigits}%`
                    : `name.ilike.${term}`
                )
                .limit(50)
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        const matchedIds = new Set<string>();

        // Map whatsapp remote_jids to chat IDs
        if (waResult.data) {
          for (const row of waResult.data as any[]) {
            const jid = row.remote_jid;
            if (jid) matchedIds.add(jid);
          }
        }

        // Map meta sender_ids
        if (metaResult.data) {
          for (const row of metaResult.data as any[]) {
            const key = `meta_${row.meta_page_id}_${row.sender_id}`;
            matchedIds.add(key);
          }
        }

        // For lead matches that aren't in the current chat list, fetch their last message
        // from any instance and inject as a "virtual chat" so the user can find old conversations.
        const leadRows = (leadsResult.data || []) as Array<{ id: string; name: string; phone: string; whatsapp_jid: string | null }>;
        if (leadRows.length > 0 && workspaceId) {
          const existingDigits = new Set<string>();
          for (const c of chats) {
            const d = cleanPhoneNumber(c.phone || c.remoteJid);
            if (d.length >= 10) existingDigits.add(d.slice(-10));
          }

          const newVirtualChats: Chat[] = [];
          for (const lead of leadRows) {
            const phoneDigits = (lead.phone || "").replace(/[^0-9]/g, "");
            if (phoneDigits.length < 10) continue;
            if (existingDigits.has(phoneDigits.slice(-10))) continue;

            // Fetch most recent message for this lead's phone (across all instances)
            const jidGuess = lead.whatsapp_jid || `${phoneDigits}@s.whatsapp.net`;
            const { data: lastMsg } = await supabase
              .from("whatsapp_messages")
              .select("remote_jid, instance_name, content, timestamp, from_me, push_name")
              .eq("workspace_id", workspaceId)
              .or(`remote_jid.eq.${jidGuess},remote_jid.ilike.${phoneDigits}@%`)
              .order("timestamp", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!lastMsg) continue;

            const ts = new Date(lastMsg.timestamp).getTime() / 1000;
            newVirtualChats.push({
              id: `inst:${lastMsg.instance_name}:phone:${phoneDigits.slice(-10)}`,
              remoteJid: lastMsg.remote_jid,
              name: lead.name || lastMsg.push_name || formatPhoneDisplay(phoneDigits),
              lastMessage: lastMsg.content || "",
              time: formatTime(ts),
              unread: 0,
              online: false,
              phone: formatPhoneDisplay(phoneDigits),
              lastMessageFromMe: !!lastMsg.from_me,
              instanceName: lastMsg.instance_name,
            });
            matchedIds.add(lastMsg.remote_jid);
          }

          if (newVirtualChats.length > 0) {
            setChats((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const toAdd = newVirtualChats.filter((c) => !existingIds.has(c.id));
              return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
            });
          }
        }

        setContentSearchResults(matchedIds);
        setContentSearchTerm(searchTerm);
      } catch (err) {
        console.error("[Chats] Content search error:", err);
      } finally {
        setContentSearchLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, workspaceId]);

  // Build support queue lookup by session_id AND lead_id
  const supportQueueMap = useMemo(() => {
    const bySession = new Map<string, "waiting" | "in_progress">();
    const byLeadId = new Map<string, "waiting" | "in_progress">();
    for (const q of queue) {
      const st = q.status as "waiting" | "in_progress";
      if (st !== "waiting" && st !== "in_progress") continue;
      if (q.session_id) bySession.set(q.session_id, st);
      if (q.lead_id) byLeadId.set(q.lead_id, st);
    }
    return { bySession, byLeadId };
  }, [queue]);

  // Helper: get support status for a chat (checks session_id + lead_id)
  const getChatSupportStatus = useCallback((chat: Chat): "waiting" | "in_progress" | null => {
    // 1) Direct session_id match (remoteJid)
    if (supportQueueMap.bySession.has(chat.remoteJid)) return supportQueueMap.bySession.get(chat.remoteJid)!;
    // 2) Lead-based match
    const chatLead = findLeadByChat(chat.remoteJid, chat.remoteJidAlt, chat.phone);
    if (chatLead?.id && supportQueueMap.byLeadId.has(chatLead.id)) return supportQueueMap.byLeadId.get(chatLead.id)!;
    return null;
  }, [supportQueueMap, findLeadByChat]);

  // Apply filters to chats
  const filteredChats = useMemo(() => {
    const normalizedSearchDigits = normalizeDigits(searchTerm);
    let result = chats.filter((chat) => {
      // Hide ignored leads from main chat list
      const chatLead = findLeadByChat(chat.remoteJid, chat.remoteJidAlt, chat.phone);
      if (chatLead && (chatLead as any).is_ignored) return false;

      if (!searchTerm) return true;

      // Match by name or phone (local filter)
      const localMatch =
        chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chatMatchesPhoneSearch(chat, normalizedSearchDigits);
      if (localMatch) return true;

      // Match by content search results (DB)
      if (contentSearchTerm === searchTerm && contentSearchResults.size > 0) {
        // Check WhatsApp JID match
        if (contentSearchResults.has(chat.remoteJid)) return true;
        if (chat.remoteJidAlt && contentSearchResults.has(chat.remoteJidAlt)) return true;
        // Check Meta match
        if (chat.isMeta && chat.metaPageId && chat.metaSenderId) {
          const metaKey = `meta_${chat.metaPageId}_${chat.metaSenderId}`;
          if (contentSearchResults.has(metaKey)) return true;
        }
      }

      return false;
    });

    // Apply additional filters if active
    if (activeFilters) {
      // Filter by lead search
      if (activeFilters.leadSearch) {
        const searchLower = activeFilters.leadSearch.toLowerCase();
        result = result.filter(
          (chat) =>
            chat.name.toLowerCase().includes(searchLower) ||
            chatMatchesPhoneSearch(chat, activeFilters.leadSearch!)
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
      if (activeFilters.responseStatus && activeFilters.responseStatus.length > 0) {
        const statuses = activeFilters.responseStatus;
        
        result = result.filter((chat) => {
          if (statuses.includes("answered") && chat.lastMessageFromMe === true) {
            return true;
          }
          if (statuses.includes("unanswered") && chat.lastMessageFromMe === false) {
            return true;
          }
          return false;
        });
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
    }

    // Filter by support status from filters drawer
    if (activeFilters?.supportStatus) {
      const ss = activeFilters.supportStatus;
      result = result.filter(chat => {
        const chatStatus = getChatSupportStatus(chat);
        if (ss === "any_active") return chatStatus !== null;
        return chatStatus === ss;
      });
    }

    // Filter by support queue (inline toggle)
    if (showQueueOnly) {
      result = result.filter(chat => getChatSupportStatus(chat) !== null);
    }

    // Sort pinned chats to the top
    result.sort((a, b) => {
      const aPinned = pinnedChatIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedChatIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return 0;
    });

    return result;
  }, [chats, searchTerm, activeFilters, showQueueOnly, queue, findLeadByChat, getChatSupportStatus, pinnedChatIds, contentSearchResults, contentSearchTerm]);

  // Argos X only: tag each chat with subscriber's plan or "Lead novo"
  const { enabled: argosTagsEnabled, getTag: getArgosTag } = useArgosClientPlanTags(
    workspaceId,
    filteredChats.map((c) => c.phone || "")
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("search")) return;

    const nextSearch = params.get("search") || "";
    setSearchTerm((prev) => (prev === nextSearch ? prev : nextSearch));
    setSelectedChat((current) => {
      if (!current || !nextSearch) return current;
      return chatMatchesPhoneSearch(current, nextSearch) ? current : null;
    });
  }, [location.search]);

  // Auto-select the correct chat when navigating with ?search= param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get("search");
    if (!searchParam || chats.length === 0) return;

    if (selectedChat && chatMatchesPhoneSearch(selectedChat, searchParam)) return;

    const match = chats.find((chat) => chatMatchesPhoneSearch(chat, searchParam));
    if (match && selectedChat?.id !== match.id) {
      setSelectedChat(match);
    }
  }, [location.search, chats, selectedChat]);

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
      } else if (selectedInstance.startsWith("meta:")) {
        // Meta instance — load from meta_conversations, not Evolution API
        try {
          const dirFilter = activeFilters?.responseStatus?.includes("unanswered") 
            ? "inbound" as const
            : activeFilters?.responseStatus?.includes("answered")
              ? "outbound" as const
              : undefined;
          const metaConvs = await fetchMetaConversations(undefined, dirFilter);
          allChats = (metaConvs || []).map((conv) => ({
            id: `meta:${conv.meta_page_id}:${conv.sender_id}`,
            remoteJid: conv.sender_id,
            name: conv.sender_name || conv.sender_id,
            lastMessage: conv.last_message,
            time: formatMetaTime(conv.last_timestamp),
            unread: conv.unread_count,
            online: false,
            phone: conv.sender_id,
            lastMessageFromMe: conv.last_direction === "outbound",
            isMeta: true,
            metaPageId: conv.meta_page_id,
            metaSenderId: conv.sender_id,
            metaPlatform: conv.platform,
            instanceLabel: conv.page_name || conv.platform,
            _timestamp: new Date(conv.last_timestamp).getTime() / 1000,
          }));
        } catch (err) {
          console.error("[Chats] Error refreshing Meta conversations:", err);
        }
      } else {
        // Refresh single Evolution API instance
        const data = await fetchChats(selectedInstance);
        allChats = data
          .filter((chat: any) => !chat.remoteJid?.endsWith("@g.us"))
          .map((chat: any) => transformChatData(chat))
          .slice(0, 50);
      }
      
      const refreshedChats = selectedInstance.startsWith("meta:") ? allChats : dedupChats(allChats);
      setChats(refreshedChats);
      toast({
        title: "Conversas atualizadas",
        description: `${refreshedChats.length} conversas carregadas.`,
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
    <div className={cn("h-[calc(100vh-8rem)] flex flex-col", isMobile && "h-[calc(100vh-4rem)]")}>
      {/* Top action bar (outside chat container) */}
      {isMasterWorkspace && !isMobile && (
        <div className="flex items-center justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="w-4 h-4" />
            Exportar conversas
          </Button>
        </div>
      )}
      <div className={cn("flex-1 flex rounded-xl overflow-hidden border border-border bg-background min-h-0", isMobile && "rounded-none border-0")} data-tour="chat-section">
      {/* Chat List */}
      <div className={cn(
        "w-[360px] border-r border-border flex flex-col bg-card",
        isMobile && "w-full border-r-0",
        isMobile && selectedChat && "hidden"
      )}>
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
              <Button
                variant={showQueueOnly ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-6 px-2 text-xs font-medium rounded-full gap-1",
                  showQueueOnly
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : waitingCount > 0
                      ? "border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                      : "border-border text-muted-foreground hover:bg-accent"
                )}
                onClick={() => setShowQueueOnly(!showQueueOnly)}
              >
                <Headphones className="w-3 h-3" />
                {waitingCount > 0 ? waitingCount : "Fila"}
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
                  {page.platform === "instagram"
                    ? "📸"
                    : page.platform === "both"
                      ? "📸💬"
                      : "💬"}{" "}
                  {page.page_name}
                  {page.instagram_username ? ` (@${page.instagram_username})` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="relative">
            {contentSearchLoading ? (
              <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            )}
            <Input
              placeholder="Buscar por nome, telefone ou conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent"
            />
          </div>
          {searchTerm.length >= 3 && contentSearchResults.size > 0 && !contentSearchLoading && (
            <p className="text-xs text-muted-foreground px-1">
              {contentSearchResults.size} conversa{contentSearchResults.size !== 1 ? "s" : ""} encontrada{contentSearchResults.size !== 1 ? "s" : ""} por conteúdo
            </p>
          )}
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-hidden" ref={(node) => {
          if (node) {
            const viewport = node.querySelector('[data-radix-scroll-area-viewport]');
            chatListScrollRef.current = viewport as HTMLDivElement;
          } else {
            chatListScrollRef.current = null;
          }
        }}>
        <ScrollArea className="h-full [&>div]:!overflow-x-auto">
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
            <div className="divide-y divide-border/50">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors",
                    selectedChat?.id === chat.id
                      ? "bg-secondary/10"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="relative flex-shrink-0">
                    {chat.profilePicUrl ? (
                      <img 
                        src={chat.profilePicUrl} 
                        alt={chat.name}
                        className="w-11 h-11 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-11 h-11 rounded-full bg-gradient-to-br from-primary/80 to-secondary/80 flex items-center justify-center text-primary-foreground font-semibold text-sm",
                      chat.profilePicUrl && "hidden"
                    )}>
                      {(chat.name || "?").split(" ").slice(0, 2).map((n) => n[0] || "").join("").toUpperCase() || "?"}
                    </div>
                    {/* Origin icon overlay */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-background flex items-center justify-center shadow-sm border border-border">
                      {chat.isMeta && chat.metaPlatform === "instagram" ? (
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none">
                          <defs><linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#FFDC80"/><stop offset="25%" stopColor="#F77737"/><stop offset="50%" stopColor="#F56040"/><stop offset="75%" stopColor="#C13584"/><stop offset="100%" stopColor="#833AB4"/></linearGradient></defs>
                          <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2"/>
                          <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)"/>
                        </svg>
                      ) : chat.isMeta && chat.metaPlatform === "facebook" ? (
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#1877F2]" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      ) : chat.isMeta && chat.metaPlatform === "whatsapp_business" ? (
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#25D366]" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#25D366]" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {pinnedChatIds.has(chat.id) && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-destructive flex items-center justify-center" title="Importante">
                            <Pin className="w-2.5 h-2.5 text-destructive-foreground" />
                          </span>
                        )}
                        <span className="font-semibold text-sm text-foreground truncate">{chat.name}</span>
                        {/* Argos X only: subscriber plan tag / "Lead novo" */}
                        {argosTagsEnabled && (() => {
                          const tag = getArgosTag(chat.phone);
                          if (!tag.label) return null;
                          return (
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 border",
                                tag.isClient
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                              title={tag.isClient ? `Cliente Argos X • ${tag.label}` : "Sem conta no Argos X"}
                            >
                              {tag.label}
                            </span>
                          );
                        })()}
                        {/* Support queue badge — next to name */}
                        {(() => {
                          const ss = getChatSupportStatus(chat);
                          if (!ss) return null;
                          return (
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0",
                              ss === "waiting"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            )}>
                              {ss === "waiting" ? "⏳ Aguardando" : "🔴 Em atendimento"}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{chat.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {chat.lastMessageFromMe && <span className="text-muted-foreground/70">Você: </span>}
                        {chat.lastMessage || chat.phone}
                      </p>
                       <div className="flex items-center gap-1 flex-shrink-0">
                        {chat.isMeta && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 whitespace-nowrap">
                            {chat.metaPlatform === "instagram" ? "IG" : chat.metaPlatform === "whatsapp_business" ? "WABA" : "FB"}
                          </span>
                        )}
                        {selectedInstance === "all" && !chat.isMeta && chat.instanceLabel && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap max-w-[60px] truncate" title={chat.instanceLabel}>
                            {chat.instanceLabel}
                          </span>
                        )}
                        {chat.unread > 0 && (
                          <div className="min-w-[18px] h-[18px] rounded-full bg-[hsl(var(--chat-unread))] flex items-center justify-center">
                            <span className="text-[10px] text-white font-bold px-1">{chat.unread}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Infinite scroll loading indicator */}
              {hasMoreChats && (
                <div className="flex items-center justify-center py-3">
                  {loadingMoreChats && (
                    <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        </div>
      </div>

      {/* Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 min-h-0",
        isMobile && !selectedChat && "hidden",
        isMobile && "w-full"
      )}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {isMobile && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={() => setSelectedChat(null)}>
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                  )}
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
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{selectedChat.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
                    {!isMobile && (() => {
                      const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                      return (
                        <div className="mt-2">
                          <TransferToAgentButton leadId={chatLead?.id} chatPhone={selectedChat.phone} />
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {/* Quick Actions */}
                  {(() => {
                    const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                    if (!chatLead) return null;
                    const currentStageIndex = stages.findIndex(s => s.id === chatLead.stage_id);
                    const nextStage = currentStageIndex >= 0 && currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                            <Zap className="w-3.5 h-3.5" />
                            Ação rápida
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {nextStage && (
                            <DropdownMenuItem onClick={() => {
                              moveLead(chatLead.id, nextStage.id, 0);
                              toast({ title: `Lead movido para ${nextStage.name}` });
                            }}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Mover para {nextStage.name}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setLeadModalLead(chatLead);
                            setLeadModalOpen(true);
                          }}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Ver detalhes do lead
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              const confirmed = window.confirm("Tem certeza que deseja EXCLUIR este lead permanentemente? Todos os dados serão removidos do CRM.");
                              if (!confirmed) return;
                              try {
                                // Pause AI
                                await supabase
                                  .from("agent_memories")
                                  .update({ is_paused: true } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId);
                                if (chatLead.id) {
                                  await supabase
                                    .from("agent_memories")
                                    .update({ is_paused: true } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("workspace_id", workspaceId);
                                }
                                // Cancel followups
                                await supabase
                                  .from("agent_followup_queue")
                                  .update({ status: "canceled", canceled_reason: "lead_deleted" } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId)
                                  .eq("status", "pending");
                                if (chatLead.id) {
                                  await supabase
                                    .from("agent_followup_queue")
                                    .update({ status: "canceled", canceled_reason: "lead_deleted" } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("workspace_id", workspaceId)
                                    .eq("status", "pending");
                                }
                                // Delete lead
                                await deleteLead(chatLead.id);
                                toast({ title: "✅ Lead excluído permanentemente" });
                                setSelectedChat(null);
                              } catch (err: any) {
                                console.error("[Chats] Delete lead error:", err);
                                toast({ title: "Erro ao excluir lead", description: err?.message, variant: "destructive" });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
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
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => togglePinChat(selectedChat.id)}
                    title={pinnedChatIds.has(selectedChat.id) ? "Desmarcar como importante" : "Marcar como importante"}
                  >
                    {pinnedChatIds.has(selectedChat.id) ? (
                      <PinOff className="w-5 h-5 text-destructive" />
                    ) : (
                      <Pin className="w-5 h-5" />
                    )}
                  </Button>
                  {pinnedChatIds.has(selectedChat.id) && (
                    <span className="px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wide">
                      Importante
                    </span>
                  )}
                  {/* Dropdown menu with block/unblock */}
                  {(() => {
                    const isMeta = !!selectedChat.isMeta;
                    const isPinned = pinnedChatIds.has(selectedChat.id);
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Marcar/Desmarcar como importante */}
                          <DropdownMenuItem onClick={() => togglePinChat(selectedChat.id)}>
                            {isPinned ? (
                              <><PinOff className="w-4 h-4 mr-2" /> Desmarcar importante</>
                            ) : (
                              <><Pin className="w-4 h-4 mr-2 text-destructive" /> Marcar como importante</>
                            )}
                          </DropdownMenuItem>
                          {!isMeta && (() => {
                            const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                            const isOptedOut = chatLead && (chatLead as any).is_opted_out === true;
                            return isOptedOut ? (
                              <DropdownMenuItem
                                onClick={async () => {
                                  const instName = selectedChat.instanceName || selectedInstance || "";
                                  const number = selectedChat.phone?.replace(/\D/g, "") || selectedChat.remoteJid?.replace(/@.*/, "");
                                  if (!instName || !number) {
                                    toast({ title: "Dados insuficientes para desbloquear", variant: "destructive" });
                                    return;
                                  }
                                  try {
                                    await blockContact(instName, number, false);
                                    if (chatLead?.id) {
                                      await supabase.from("leads").update({ is_opted_out: false } as any).eq("id", chatLead.id);
                                    }
                                    // Resume AI by session_id (primary)
                                    await supabase
                                      .from("agent_memories")
                                      .update({ is_paused: false } as any)
                                      .eq("session_id", selectedChat.remoteJid)
                                      .eq("workspace_id", workspaceId);
                                    if (chatLead?.id) {
                                      await supabase
                                        .from("agent_memories")
                                        .update({ is_paused: false } as any)
                                        .eq("lead_id", chatLead.id)
                                        .eq("workspace_id", workspaceId);
                                    }
                                    setSelectedChatAiPaused(false);
                                    toast({ title: "Contato desbloqueado com sucesso" });
                                  } catch {
                                    toast({ title: "Erro ao desbloquear contato", variant: "destructive" });
                                  }
                                }}
                              >
                                <ShieldOff className="w-4 h-4 mr-2" />
                                Desbloquear contato
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={async () => {
                                  const instName = selectedChat.instanceName || selectedInstance || "";
                                  const number = selectedChat.phone?.replace(/\D/g, "") || selectedChat.remoteJid?.replace(/@.*/, "");
                                  if (!instName || !number) {
                                    toast({ title: "Dados insuficientes para bloquear", variant: "destructive" });
                                    return;
                                  }
                                  const confirmed = window.confirm("Tem certeza que deseja bloquear este contato? Ele não poderá mais enviar mensagens para esta instância.");
                                  if (!confirmed) return;
                                  try {
                                    await blockContact(instName, number, true);
                                    toast({ title: "Contato bloqueado com sucesso" });
                                    // Pause AI by session_id (primary)
                                    await supabase.from("agent_memories").update({ is_paused: true } as any).eq("session_id", selectedChat.remoteJid).eq("workspace_id", workspaceId);
                                    if (chatLead?.id) {
                                      await supabase.from("agent_memories").update({ is_paused: true } as any).eq("lead_id", chatLead.id).eq("workspace_id", workspaceId);
                                      await supabase.from("leads").update({ is_opted_out: true } as any).eq("id", chatLead.id);
                                    }
                                    setSelectedChatAiPaused(true);
                                  } catch (blockErr: any) {
                                    console.error("[Chats] Block error:", blockErr);
                                    toast({ title: "Erro ao bloquear contato", description: blockErr?.message || "Erro desconhecido", variant: "destructive" });
                                  }
                                }}
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Bloquear contato
                              </DropdownMenuItem>
                            );
                          })()}
                          {/* Pausar / Retomar IA — universal (Meta + Evolution) */}
                          {selectedChatAiPaused ? (
                            <DropdownMenuItem
                              onClick={async () => {
                                const sessionId = selectedChat.remoteJid;
                                if (!sessionId) {
                                  toast({ title: "Sessão não encontrada para este contato", variant: "destructive" });
                                  return;
                                }
                                try {
                                  // Update by session_id (primary) — this is how the backend identifies sessions
                                  await supabase
                                    .from("agent_memories")
                                    .update({ is_paused: false } as any)
                                    .eq("session_id", sessionId)
                                    .eq("workspace_id", workspaceId);
                                  // Also update by lead_id as fallback for completeness
                                  const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                                  if (chatLead?.id) {
                                    await supabase
                                      .from("agent_memories")
                                      .update({ is_paused: false } as any)
                                      .eq("lead_id", chatLead.id)
                                      .eq("workspace_id", workspaceId);
                                  }
                                  setSelectedChatAiPaused(false);
                                  toast({ title: "✅ IA retomada para este contato" });
                                } catch {
                                  toast({ title: "Erro ao retomar IA", variant: "destructive" });
                                }
                              }}
                            >
                              <Zap className="w-4 h-4 mr-2" />
                              Retomar IA
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={async () => {
                                const sessionId = selectedChat.remoteJid;
                                if (!sessionId) {
                                  toast({ title: "Sessão não encontrada para este contato", variant: "destructive" });
                                  return;
                                }
                                const confirmed = window.confirm("Pausar a IA para este contato? A IA não responderá mais automaticamente.");
                                if (!confirmed) return;
                                try {
                                  // Update by session_id (primary)
                                  await supabase
                                    .from("agent_memories")
                                    .update({ is_paused: true } as any)
                                    .eq("session_id", sessionId)
                                    .eq("workspace_id", workspaceId);
                                  // Also update by lead_id as fallback
                                  const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                                  if (chatLead?.id) {
                                    await supabase
                                      .from("agent_memories")
                                      .update({ is_paused: true } as any)
                                      .eq("lead_id", chatLead.id)
                                      .eq("workspace_id", workspaceId);
                                  }
                                  // Cancel pending followups by session_id
                                  await supabase
                                    .from("agent_followup_queue")
                                    .update({ status: "canceled", canceled_reason: "manual_pause" } as any)
                                    .eq("session_id", sessionId)
                                    .eq("workspace_id", workspaceId)
                                    .eq("status", "pending");
                                  // Also cancel by lead_id
                                  if (chatLead?.id) {
                                    await supabase
                                      .from("agent_followup_queue")
                                      .update({ status: "canceled", canceled_reason: "manual_pause" } as any)
                                      .eq("lead_id", chatLead.id)
                                      .eq("workspace_id", workspaceId)
                                      .eq("status", "pending");
                                  }
                                  setSelectedChatAiPaused(true);
                                  toast({ title: "✅ IA pausada para este contato" });
                                } catch {
                                  toast({ title: "Erro ao pausar IA", variant: "destructive" });
                                }
                              }}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Pausar IA
                            </DropdownMenuItem>
                          )}
                          {/* Ignorar contato — universal (Meta + Evolution) */}
                          <DropdownMenuItem
                            onClick={async () => {
                              const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                              const confirmed = window.confirm("Ignorar este contato? Ele será removido da lista de chats e a IA será pausada.");
                              if (!confirmed) return;
                              try {
                                if (chatLead?.id) {
                                  await supabase
                                    .from("leads")
                                    .update({ is_ignored: true } as any)
                                    .eq("id", chatLead.id);
                                  await supabase
                                    .from("agent_memories")
                                    .update({ is_paused: true } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("workspace_id", workspaceId);
                                  await supabase
                                    .from("agent_followup_queue")
                                    .update({ status: "canceled", canceled_reason: "lead_ignored" } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("status", "pending");
                                }
                                // Pause AI by session_id (always)
                                await supabase
                                  .from("agent_memories")
                                  .update({ is_paused: true } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId);
                                await supabase
                                  .from("agent_followup_queue")
                                  .update({ status: "canceled", canceled_reason: "lead_ignored" } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId)
                                  .eq("status", "pending");
                                toast({ title: "✅ Contato ignorado e IA pausada" });
                                setSelectedChat(null);
                              } catch (err: any) {
                                console.error("[Chats] Ignore error:", err);
                                toast({ title: "Erro ao ignorar contato", variant: "destructive" });
                              }
                            }}
                          >
                            <EyeOff className="w-4 h-4 mr-2" />
                            Ignorar contato
                          </DropdownMenuItem>
                          {/* Bloquear e Excluir — funciona com ou sem lead */}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={async () => {
                              const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                              const hasLead = !!chatLead?.id;
                              const confirmMsg = hasLead
                                ? "Tem certeza que deseja BLOQUEAR no WhatsApp e EXCLUIR este lead permanentemente do CRM?"
                                : "Tem certeza que deseja BLOQUEAR este contato no WhatsApp e pausar a IA?";
                              const confirmed = window.confirm(confirmMsg);
                              if (!confirmed) return;
                              try {
                                // Block on WhatsApp (Evolution only)
                                if (!selectedChat.isMeta) {
                                  const inst = selectedChat.instanceName || selectedInstance;
                                  if (inst) {
                                    try {
                                      await blockContact(inst, selectedChat.remoteJid, true);
                                    } catch (blockErr) {
                                      console.warn("[Chats] Block failed, continuing:", blockErr);
                                    }
                                  }
                                }
                                // Pause AI by session_id (always)
                                await supabase
                                  .from("agent_memories")
                                  .update({ is_paused: true } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId);
                                // Cancel followups by session_id
                                await supabase
                                  .from("agent_followup_queue")
                                  .update({ status: "canceled", canceled_reason: "lead_blocked_deleted" } as any)
                                  .eq("session_id", selectedChat.remoteJid)
                                  .eq("workspace_id", workspaceId)
                                  .eq("status", "pending");
                                if (hasLead) {
                                  await supabase
                                    .from("agent_memories")
                                    .update({ is_paused: true } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("workspace_id", workspaceId);
                                  await supabase
                                    .from("agent_followup_queue")
                                    .update({ status: "canceled", canceled_reason: "lead_blocked_deleted" } as any)
                                    .eq("lead_id", chatLead.id)
                                    .eq("workspace_id", workspaceId)
                                    .eq("status", "pending");
                                  await deleteLead(chatLead.id);
                                  toast({ title: "✅ Contato bloqueado e lead excluído" });
                                } else {
                                  toast({ title: "✅ Contato bloqueado e IA pausada" });
                                }
                                setSelectedChat(null);
                              } catch (err: any) {
                                console.error("[Chats] Block+Delete error:", err);
                                toast({ title: "Erro ao bloquear e excluir", description: err?.message, variant: "destructive" });
                              }
                            }}
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            Bloquear e excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                  {/* Intercept / Resume button — single source of truth */}
                  {(() => {
                    const chatPhone = cleanPhoneNumber(selectedChat.phone || "");
                    const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
                    const activeQueueItem = queue.find(q => {
                      if (q.status === "resolved") return false;
                      if (chatLead && q.lead_id === chatLead.id) return true;
                      const qPhone = q.lead_phone?.replace(/[^0-9]/g, "") || "";
                      if (!qPhone || !chatPhone || qPhone.length < 8 || chatPhone.length < 8) return false;
                      return chatPhone.slice(-10) === qPhone.slice(-10);
                    });
                    const isIntercepted = !!activeQueueItem;

                    if (isIntercepted) {
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 border-green-500/50 text-green-700 hover:bg-green-500/10"
                          onClick={async () => {
                            try {
                              const { error } = await supabase.functions.invoke("human-handoff", {
                                body: {
                                  action: "resume",
                                  workspace_id: workspaceId,
                                  lead_id: chatLead?.id || null,
                                  session_id: activeQueueItem.session_id || null,
                                  queue_item_id: activeQueueItem.id,
                                },
                              });
                              if (error) throw error;
                              await fetchQueue();
                              toast({ title: "✅ IA retomada", description: "O agente de IA voltará a responder nesta conversa." });
                            } catch (err: any) {
                              toast({ title: "Erro ao retornar IA", description: err.message, variant: "destructive" });
                            }
                          }}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Retornar IA
                        </Button>
                      );
                    }

                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                        onClick={async () => {
                          try {
                            const resolvedSessionId = selectedChat.remoteJidAlt || selectedChat.remoteJid || null;
                            const resolvedInstanceName =
                              selectedChat.instanceName && selectedChat.instanceName !== "all"
                                ? selectedChat.instanceName
                                : selectedInstance && selectedInstance !== "all"
                                  ? selectedInstance
                                  : null;

                            const { error } = await supabase.functions.invoke("human-handoff", {
                              body: {
                                action: "intercept",
                                workspace_id: workspaceId,
                                lead_id: chatLead?.id || null,
                                session_id: resolvedSessionId,
                                instance_name: resolvedInstanceName,
                                reason: "manual",
                              },
                            });
                            if (error) throw error;
                            await fetchQueue();
                            toast({ title: "✅ IA pausada e conversa interceptada", description: "Ticket de suporte criado automaticamente." });
                          } catch (err: any) {
                            toast({ title: "Erro ao interceptar", description: err.message, variant: "destructive" });
                          }
                        }}
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        Interceptar
                      </Button>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Human Support Queue Action Bar */}
            {(() => {
              const chatPhone = cleanPhoneNumber(selectedChat.phone || "");
              const chatLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
              const queueItem = queue.find(q => {
                if (q.status !== "waiting" && q.status !== "in_progress") return false;
                // Match by lead_id first
                if (chatLead && q.lead_id === chatLead.id) return true;
                // Fallback: match by phone
                const qPhone = q.lead_phone?.replace(/[^0-9]/g, "") || "";
                if (!qPhone || !chatPhone || qPhone.length < 8 || chatPhone.length < 8) return false;
                return chatPhone.slice(-10) === qPhone.slice(-10);
              });
              if (!queueItem) return null;
              return (
                <div className="px-4 py-2 border-b border-border bg-amber-500/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Headphones className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700 truncate">
                      {queueItem.status === "waiting" ? "Aguardando atendimento humano" : "Em atendimento"}
                      {queueItem.reason && (
                        <span className="text-amber-600/70 ml-1">
                          — {queueItem.reason.length > 40 ? queueItem.reason.slice(0, 40) + "…" : queueItem.reason}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {queueItem.status === "waiting" && userProfileId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                        onClick={async () => {
                          const ok = await claimItem(queueItem.id, userProfileId);
                          if (ok) toast({ title: "Atendimento assumido" });
                        }}
                      >
                        <UserCheck className="w-3 h-3" />
                        Assumir
                      </Button>
                    )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 border-green-500/50 text-green-700 hover:bg-green-500/10"
                        onClick={async () => {
                          try {
                            const { error } = await supabase.functions.invoke("human-handoff", {
                              body: {
                                action: "resume",
                                workspace_id: workspaceId,
                                lead_id: chatLead?.id || null,
                                session_id: queueItem.session_id || null,
                                queue_item_id: queueItem.id,
                              },
                            });
                            if (error) throw error;
                            toast({ title: "✅ Atendimento finalizado", description: "A IA foi retomada automaticamente." });
                          } catch (err: any) {
                            toast({ title: "Erro", description: err.message, variant: "destructive" });
                          }
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Finalizar & Retornar IA
                      </Button>
                    </div>
                  </div>
                );
              })()}

            <div 
              className="flex-1 overflow-y-auto p-4 min-h-0 w-full chat-pattern scrollbar-thin"
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
            >
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full w-full gap-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Carregando mensagens...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma mensagem encontrada</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 max-w-3xl mx-auto">
                  {/* Load more indicator */}
                  {loadingOlderMessages && (
                    <div className="flex items-center justify-center py-3">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  )}
                  {hasMoreMessages && !loadingOlderMessages && (
                    <div className="flex items-center justify-center py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-foreground bg-card/80 rounded-full px-4 shadow-sm"
                        onClick={loadOlderMessages}
                      >
                        ↑ Carregar anteriores
                      </Button>
                    </div>
                  )}
                  {!hasMoreMessages && messages.length > 30 && (
                    <div className="flex items-center justify-center py-3">
                      <span className="text-[11px] text-muted-foreground bg-card/90 px-4 py-1 rounded-full shadow-sm">
                        Início da conversa
                      </span>
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    // Date separator logic
                    const msgDate = (msg as any)._ts ? new Date((msg as any)._ts) : null;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const prevDate = prevMsg && (prevMsg as any)._ts ? new Date((prevMsg as any)._ts) : null;
                    const showDateSeparator = msgDate && (!prevDate || 
                      msgDate.toDateString() !== prevDate.toDateString());
                    
                    return (
                      <div key={msg.id}>
                        {showDateSeparator && msgDate && (
                          <div className="flex items-center justify-center py-3">
                            <span className="text-[11px] text-muted-foreground bg-card/90 px-4 py-1 rounded-full shadow-sm font-medium">
                              {msgDate.toLocaleDateString("pt-BR", { 
                                day: "2-digit", 
                                month: "long",
                                year: msgDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
                              })}
                            </span>
                          </div>
                        )}
                        <MessageBubble
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
                          instanceName={selectedChat?.instanceName || selectedInstance || undefined}
                          messageId={msg.messageId}
                          remoteJid={selectedChat?.remoteJid}
                          fromMe={msg.fromMe}
                          isMeta={selectedChat?.isMeta}
                          timestamp={msg.timestamp}
                          onDownloadMedia={handleDownloadMedia}
                          onReply={handleReply}
                          onDeleteForMe={handleDeleteForMe}
                          onDeleteForEveryone={handleDeleteForEveryone}
                          onEdit={!selectedChat?.isMeta ? handleEdit : undefined}
                          onReact={!selectedChat?.isMeta ? handleReact : undefined}
                          onContactChat={(phone, name) => {
                            // Clean phone number and search for existing chat or navigate
                            const cleanPhone = phone.replace(/[^0-9+]/g, '');
                            const digits = cleanPhone.replace(/\D/g, '');
                            // Try to find an existing chat with this phone
                            const existingChat = chats.find(c => {
                              const chatDigits = (c.phone || '').replace(/\D/g, '');
                              return chatDigits.length >= 10 && digits.length >= 10 && 
                                chatDigits.slice(-10) === digits.slice(-10);
                            });
                            if (existingChat) {
                              setSelectedChat(existingChat);
                            } else {
                              // Create a temporary chat entry to open conversation
                              const jid = `${digits}@s.whatsapp.net`;
                              const tempChat: Chat = {
                                id: jid,
                                remoteJid: jid,
                                name: name || cleanPhone,
                                phone: cleanPhone,
                                lastMessage: "",
                                time: "",
                                unread: 0,
                                online: false,
                                lastMessageFromMe: false,
                                instanceName: selectedInstance !== 'all' ? selectedInstance : instances[0]?.name || '',
                              };
                              setChats(prev => [tempChat, ...prev]);
                              setSelectedChat(tempChat);
                            }
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chat Input */}
            <ChatInput
              onSendMessage={handleSendMessage}
              onSendMedia={handleSendMedia}
              onSendAudio={handleSendAudio}
              disabled={apiLoading}
              replyingTo={replyingTo}
              onCancelReply={handleCancelReply}
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
      {!isMobile && selectedChat && (() => {
        try {
        const currentLead = findLeadByChat(selectedChat.remoteJid, selectedChat.remoteJidAlt, selectedChat.phone);
        return (
          <LeadSidePanel
            lead={currentLead || null}
            stages={stages}
            tags={tags}
            isOpen={leadPanelOpen}
            onToggle={() => setLeadPanelOpen((v) => !v)}
            onUpdateLead={async (leadId, updates) => {
              const result = await updateLead(leadId, updates);
              // Also update override if present
              setChatLeadOverrides(prev => {
                if (!prev.has(leadId)) return prev;
                const next = new Map(prev);
                next.set(leadId, { ...prev.get(leadId)!, ...updates } as Lead);
                return next;
              });
              return result;
            }}
            onMoveLead={async (leadId, stageId, pos) => {
              const result = await moveLead(leadId, stageId, pos);
              if (!result) return result;

              setChatLeadOverrides(prev => {
                const next = new Map(prev);
                const previousLead = prev.get(leadId) || leads.find((lead) => lead.id === leadId);
                next.set(leadId, {
                  ...(previousLead || {}),
                  ...result,
                  stage_id: stageId,
                  position: pos,
                } as Lead);
                return next;
              });

              return result;
            }}
            onAddTag={addTagToLead}
            onRemoveTag={removeTagFromLead}
            onCreateTag={createTag}
            workspaceId={workspaceId || undefined}
            chatContact={!currentLead ? {
              name: selectedChat.name,
              phone: selectedChat.phone,
              remoteJid: selectedChat.remoteJid,
              instanceName: selectedChat.instanceName,
            } : {
              name: selectedChat.name,
              phone: selectedChat.phone,
              remoteJid: selectedChat.remoteJid,
              instanceName: selectedChat.instanceName,
            }}
            onCreateLead={!currentLead ? async () => {
              const phoneCandidates = [
                cleanPhoneNumber(selectedChat.phone || ""),
                cleanPhoneNumber(selectedChat.remoteJidAlt || ""),
                cleanPhoneNumber(selectedChat.remoteJid || ""),
              ];
              const normalizedPhone = phoneCandidates.find((digits) => digits.length >= 10 && digits.length <= 13) || "";

              if (!normalizedPhone) {
                toast({
                  title: "Número não resolvido",
                  description: "Não foi possível criar lead sem número real. Aguarde a próxima mensagem do contato.",
                  variant: "destructive",
                });
                return false;
              }

              const preferredJid = selectedChat.remoteJidAlt?.endsWith("@s.whatsapp.net")
                ? selectedChat.remoteJidAlt
                : selectedChat.remoteJid.endsWith("@s.whatsapp.net")
                  ? selectedChat.remoteJid
                  : `${normalizedPhone}@s.whatsapp.net`;

              const newLead = await createLead({
                name: selectedChat.name || normalizedPhone || "Contato",
                phone: normalizedPhone,
                whatsapp_jid: preferredJid,
                instance_name: selectedChat.instanceName,
                source: "whatsapp",
              });
              // Add to overrides so panel shows it immediately
              if (newLead) {
                setChatLeadOverrides(prev => {
                  const next = new Map(prev);
                  next.set(newLead.id, { ...newLead, tags: newLead.tags || [], sales: newLead.sales || [] } as Lead);
                  return next;
                });
              }
              return !!newLead;
            } : undefined}
            onOpenDetailModal={currentLead ? () => {
              setLeadModalLead(currentLead);
              setLeadModalOpen(true);
            } : undefined}
          />
        );
        } catch (e) {
          console.error("LeadSidePanel render error:", e);
          return null;
        }
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
      <ExportConversationsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
    </div>
  );
}
