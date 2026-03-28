import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export interface DisconnectedInstance {
  instanceName: string;
  displayName: string;
}

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

export function useInstanceHealth() {
  const { workspaceId } = useWorkspace();
  const [disconnected, setDisconnected] = useState<DisconnectedInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    if (!workspaceId) return;

    try {
      setLoading(true);

      // Fetch workspace instances
      const { data: instances } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, display_name")
        .eq("workspace_id", workspaceId)
        .neq("instance_type", "alerts");

      if (!instances || instances.length === 0) {
        setDisconnected([]);
        return;
      }

      const offInstances: DisconnectedInstance[] = [];

      for (const inst of instances) {
        try {
          const { data } = await supabase.functions.invoke(
            `evolution-api/connection-state/${inst.instance_name}`,
            { method: "GET" }
          );
          const state = data?.instance?.state;
          if (state !== "open") {
            offInstances.push({
              instanceName: inst.instance_name,
              displayName: inst.display_name || inst.instance_name,
            });
          }
        } catch {
          offInstances.push({
            instanceName: inst.instance_name,
            displayName: inst.display_name || inst.instance_name,
          });
        }
      }

      setDisconnected(offInstances);
    } catch (err) {
      console.error("[useInstanceHealth] error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    checkHealth();
    intervalRef.current = setInterval(checkHealth, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkHealth]);

  return { disconnected, loading, refresh: checkHealth };
}
