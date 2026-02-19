import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

interface WorkspaceAccess {
  allowed: boolean;
  reason: "active" | "trialing" | "trial_manual" | "blocked" | "canceled" | "past_due";
  trialEnd: string | null;
  daysRemaining: number | null;
  loading: boolean;
}

const CACHE_KEY = "workspace_access_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const RECHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes

export function useWorkspaceAccess(): WorkspaceAccess {
  const { workspaceId } = useWorkspace();
  const [state, setState] = useState<Omit<WorkspaceAccess, "loading">>({
    allowed: true,
    reason: "trial_manual",
    trialEnd: null,
    daysRemaining: null,
  });
  const [loading, setLoading] = useState(true);

  const checkAccess = useCallback(async (force = false) => {
    if (!workspaceId) return;

    // Check sessionStorage cache
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setState(data);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-workspace-access", {
        body: { workspaceId },
      });

      if (error) {
        console.error("check-workspace-access error:", error);
        // Default to allowed on error to avoid blocking users
        setLoading(false);
        return;
      }

      const result = {
        allowed: data.allowed,
        reason: data.reason,
        trialEnd: data.trial_end,
        daysRemaining: data.days_remaining,
      };

      setState(result);
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: result, timestamp: Date.now() })
      );
    } catch (err) {
      console.error("check-workspace-access error:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    checkAccess();

    const interval = setInterval(() => checkAccess(true), RECHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkAccess]);

  return { ...state, loading };
}
