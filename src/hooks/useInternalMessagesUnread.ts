import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Returns the count of unread internal messages where the current user is the receiver
 * within the active workspace. Subscribes to realtime inserts/updates to keep it fresh.
 */
export function useInternalMessagesUnread() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user || !workspaceId) {
      setUnreadCount(0);
      return;
    }
    const { count } = await supabase
      .from("internal_messages")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("receiver_id", user.id)
      .eq("read", false);
    setUnreadCount(count || 0);
  }, [user, workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !workspaceId) return;
    const channel = supabase
      .channel(`internal_messages_unread_${workspaceId}_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, workspaceId, refresh]);

  return { unreadCount, refresh };
}