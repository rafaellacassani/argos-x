import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface SupportQueueItem {
  id: string;
  workspace_id: string;
  lead_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  reason: string;
  status: string;
  assigned_to: string | null;
  instance_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  // Joined
  lead_name?: string;
  lead_phone?: string;
  agent_name?: string;
}

export function useHumanSupportQueue() {
  const { workspaceId } = useWorkspace();
  const [queue, setQueue] = useState<SupportQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);

  const fetchQueue = useCallback(async (statusFilter?: string) => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("human_support_queue" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      } else {
        query = query.in("status", ["waiting", "in_progress"]);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[useHumanSupportQueue] Error:", error);
        return;
      }

      const items = (data || []) as any[];

      // Enrich with lead + agent names
      const leadIds = [...new Set(items.filter(i => i.lead_id).map(i => i.lead_id))];
      const agentIds = [...new Set(items.filter(i => i.agent_id).map(i => i.agent_id))];

      let leadsMap: Record<string, { name: string; phone: string }> = {};
      let agentsMap: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name, phone")
          .in("id", leadIds);
        if (leads) {
          for (const l of leads) {
            leadsMap[l.id] = { name: l.name, phone: l.phone };
          }
        }
      }

      if (agentIds.length > 0) {
        const { data: agents } = await supabase
          .from("ai_agents")
          .select("id, name")
          .in("id", agentIds);
        if (agents) {
          for (const a of agents) {
            agentsMap[a.id] = a.name;
          }
        }
      }

      const enriched: SupportQueueItem[] = items.map(item => ({
        ...item,
        lead_name: item.lead_id ? leadsMap[item.lead_id]?.name : undefined,
        lead_phone: item.lead_id ? leadsMap[item.lead_id]?.phone : undefined,
        agent_name: item.agent_id ? agentsMap[item.agent_id] : undefined,
      }));

      setQueue(enriched);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Fetch waiting count for badge
  const fetchWaitingCount = useCallback(async () => {
    if (!workspaceId) return;
    const { count, error } = await supabase
      .from("human_support_queue" as any)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "waiting");

    if (!error && count !== null) {
      setWaitingCount(count);
    }
  }, [workspaceId]);

  // Claim a queue item
  const claimItem = useCallback(async (itemId: string, userId: string) => {
    const { error } = await supabase
      .from("human_support_queue" as any)
      .update({ status: "in_progress", assigned_to: userId, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) {
      console.error("[useHumanSupportQueue] Claim error:", error);
      return false;
    }
    setQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: "in_progress", assigned_to: userId } : i));
    setWaitingCount(prev => Math.max(0, prev - 1));
    return true;
  }, []);

  // Resolve a queue item
  const resolveItem = useCallback(async (itemId: string, resumeAI = false) => {
    const item = queue.find(i => i.id === itemId);
    
    const { error } = await supabase
      .from("human_support_queue" as any)
      .update({ status: "resolved", resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) {
      console.error("[useHumanSupportQueue] Resolve error:", error);
      return false;
    }

    // Resume AI agent if requested
    if (resumeAI && item?.session_id) {
      await supabase
        .from("agent_memories")
        .update({ is_paused: false })
        .eq("session_id", item.session_id);
    }

    setQueue(prev => prev.filter(i => i.id !== itemId));
    setWaitingCount(prev => Math.max(0, prev - 1));
    return true;
  }, [queue]);

  // Load on mount + subscribe to realtime
  useEffect(() => {
    if (!workspaceId) return;
    fetchQueue();
    fetchWaitingCount();

    const channel = supabase
      .channel("human-support-queue-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "human_support_queue", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          fetchWaitingCount();
          fetchQueue();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchQueue, fetchWaitingCount]);

  return {
    queue,
    loading,
    waitingCount,
    fetchQueue,
    fetchWaitingCount,
    claimItem,
    resolveItem,
  };
}
