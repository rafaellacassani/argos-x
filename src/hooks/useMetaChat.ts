import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MetaPage {
  id: string;
  page_id: string;
  page_name: string;
  platform: "facebook" | "instagram" | "both";
  instagram_username?: string | null;
  is_active: boolean;
}

export interface MetaConversation {
  sender_id: string;
  sender_name: string | null;
  platform: string;
  meta_page_id: string;
  last_message: string;
  last_timestamp: string;
  unread_count: number;
  page_name?: string;
}

export interface MetaMessage {
  id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  direction: string;
  timestamp: string;
  sender_name: string | null;
}

export function useMetaChat() {
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [conversations, setConversations] = useState<MetaConversation[]>([]);
  const [messages, setMessages] = useState<MetaMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch active meta pages
  const fetchMetaPages = useCallback(async () => {
    const { data, error } = await supabase
      .from("meta_pages")
      .select("id, page_id, page_name, platform, instagram_username, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("[useMetaChat] Error fetching meta pages:", error);
      return [];
    }

    const pages = (data || []) as MetaPage[];
    setMetaPages(pages);
    return pages;
  }, []);

  // Fetch conversations using the optimized summary view
  const fetchConversations = useCallback(async (metaPageId?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from("meta_conversation_summary" as any)
        .select("meta_page_id, sender_id, sender_name, platform, content, message_type, timestamp")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (metaPageId) {
        query = query.eq("meta_page_id", metaPageId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[useMetaChat] Error fetching conversations:", error);
        return [];
      }

      const convList: MetaConversation[] = (data || []).map((row: any) => ({
        sender_id: row.sender_id,
        sender_name: row.sender_name,
        platform: row.platform,
        meta_page_id: row.meta_page_id,
        last_message: row.content || (row.message_type !== "text" ? `📎 ${row.message_type}` : ""),
        last_timestamp: row.timestamp,
        unread_count: 0,
        page_name: metaPages.find((p) => p.id === row.meta_page_id)?.page_name,
      }));

      setConversations(convList);
      return convList;
    } finally {
      setLoading(false);
    }
  }, [metaPages]);

  // Fetch messages for a specific conversation (sender_id + meta_page_id)
  const fetchMessages = useCallback(
    async (metaPageId: string, senderId: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("meta_conversations")
          .select("id, content, message_type, media_url, direction, timestamp, sender_name")
          .eq("meta_page_id", metaPageId)
          .eq("sender_id", senderId)
          .order("timestamp", { ascending: true })
          .limit(100);

        if (error) {
          console.error("[useMetaChat] Error fetching messages:", error);
          return [];
        }

        const msgs = (data || []) as MetaMessage[];
        setMessages(msgs);
        return msgs;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Send a message via meta-send-message edge function
  const sendMessage = useCallback(
    async (metaPageId: string, recipientId: string, text: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase.functions.invoke("meta-send-message", {
          body: { metaPageId, recipientId, message: text },
        });

        if (error) {
          console.error("[useMetaChat] Error sending message:", error);
          return false;
        }
        if (data?.error) {
          console.error("[useMetaChat] Send error:", data.error);
          return false;
        }

        console.log("[useMetaChat] Message sent successfully:", data.message_id);
        return true;
      } catch (err) {
        console.error("[useMetaChat] sendMessage error:", err);
        return false;
      }
    },
    []
  );

  // Subscribe to realtime updates
  const subscribeToRealtime = useCallback(
    (metaPageId?: string, senderId?: string) => {
      const channel = supabase
        .channel("meta-conversations-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "meta_conversations",
          },
          (payload) => {
            const newMsg = payload.new as any;
            console.log("[useMetaChat] Realtime new message:", newMsg.id);

            // Update messages if we're viewing this conversation
            if (
              senderId &&
              metaPageId &&
              newMsg.sender_id === senderId &&
              newMsg.meta_page_id === metaPageId
            ) {
              setMessages((prev) => [
                ...prev,
                {
                  id: newMsg.id,
                  content: newMsg.content,
                  message_type: newMsg.message_type,
                  media_url: newMsg.media_url,
                  direction: newMsg.direction,
                  timestamp: newMsg.timestamp,
                  sender_name: newMsg.sender_name,
                },
              ]);
            }

            // Update conversation list
            setConversations((prev) => {
              const key = `${newMsg.meta_page_id}:${newMsg.sender_id}`;
              const existing = prev.find(
                (c) => c.meta_page_id === newMsg.meta_page_id && c.sender_id === newMsg.sender_id
              );
              if (existing) {
                return prev.map((c) =>
                  c.meta_page_id === newMsg.meta_page_id && c.sender_id === newMsg.sender_id
                    ? {
                        ...c,
                        last_message: newMsg.content || `📎 ${newMsg.message_type}`,
                        last_timestamp: newMsg.timestamp,
                      }
                    : c
                );
              }
              return [
                {
                  sender_id: newMsg.sender_id,
                  sender_name: newMsg.sender_name,
                  platform: newMsg.platform,
                  meta_page_id: newMsg.meta_page_id,
                  last_message: newMsg.content || `📎 ${newMsg.message_type}`,
                  last_timestamp: newMsg.timestamp,
                  unread_count: 1,
                },
                ...prev,
              ];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    []
  );

  // Load meta pages on mount
  useEffect(() => {
    fetchMetaPages();
  }, [fetchMetaPages]);

  return {
    metaPages,
    conversations,
    messages,
    loading,
    fetchMetaPages,
    fetchConversations,
    fetchMessages,
    sendMessage,
    subscribeToRealtime,
  };
}
