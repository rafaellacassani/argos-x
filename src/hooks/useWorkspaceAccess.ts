import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

interface WorkspaceAccess {
  allowed: boolean;
  reason: "active" | "trialing" | "trial_manual" | "blocked" | "canceled" | "past_due";
  trialEnd: string | null;
  daysRemaining: number | null;
  loading: boolean;
}

const RECHECK_INTERVAL = 60 * 60 * 1000; // 60 minutes

/**
 * Calculates access locally from workspace data (instant, no network).
 * Edge Function runs in background as source of truth — if it disagrees, it wins.
 */
function computeLocalAccess(workspace: {
  plan_type?: string;
  trial_end?: string | null;
  blocked_at?: string | null;
  annual_promo_expires_at?: string | null;
}): Omit<WorkspaceAccess, "loading"> {
  const now = new Date();
  const trialEnd = workspace.trial_end ? new Date(workspace.trial_end) : null;
  const daysRemaining = trialEnd
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
    : null;

  const planType = workspace.plan_type || "trial_manual";

  // If blocked_at is set, always blocked
  if (workspace.blocked_at) {
    return { allowed: false, reason: "blocked", trialEnd: workspace.trial_end || null, daysRemaining };
  }

  // Annual promo overrides plan checks (until expiration)
  const promoExp = workspace.annual_promo_expires_at ? new Date(workspace.annual_promo_expires_at) : null;
  if (promoExp && promoExp > now) {
    return { allowed: true, reason: "active", trialEnd: workspace.trial_end || null, daysRemaining };
  }

  switch (planType) {
    case "trial_manual":
      if (!trialEnd || trialEnd > now) {
        return { allowed: true, reason: "trial_manual", trialEnd: workspace.trial_end || null, daysRemaining };
      }
      return { allowed: false, reason: "blocked", trialEnd: workspace.trial_end || null, daysRemaining };

    case "trialing":
      if (!trialEnd || trialEnd > now) {
        return { allowed: true, reason: "trialing", trialEnd: workspace.trial_end || null, daysRemaining };
      }
      return { allowed: false, reason: "blocked", trialEnd: workspace.trial_end || null, daysRemaining };

    case "active":
      return { allowed: true, reason: "active", trialEnd: workspace.trial_end || null, daysRemaining };

    case "past_due":
      return { allowed: false, reason: "past_due", trialEnd: workspace.trial_end || null, daysRemaining };

    case "canceled":
    case "blocked":
      return { allowed: false, reason: planType as "canceled" | "blocked", trialEnd: workspace.trial_end || null, daysRemaining };

    default:
      return { allowed: false, reason: "blocked", trialEnd: workspace.trial_end || null, daysRemaining };
  }
}

export function useWorkspaceAccess(): WorkspaceAccess {
  const { workspace, workspaceId, loading: wsLoading } = useWorkspace();
  const [override, setOverride] = useState<Omit<WorkspaceAccess, "loading"> | null>(null);
  const bgCheckDone = useRef(false);

  // Local computation — instant, no loading state
  const localAccess = workspace
    ? computeLocalAccess(workspace)
    : { allowed: true, reason: "trial_manual" as const, trialEnd: null, daysRemaining: null };

  // Background Edge Function check (PROTEÇÃO 1)
  const checkBackground = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase.functions.invoke("check-workspace-access", {
        body: { workspaceId },
      });

      if (error || !data) {
        console.error("check-workspace-access background error:", error);
        return;
      }

      const remote = {
        allowed: data.allowed,
        reason: data.reason,
        trialEnd: data.trial_end,
        daysRemaining: data.days_remaining,
      };

      // If Edge Function disagrees with local, Edge Function wins
      if (remote.allowed !== localAccess.allowed || remote.reason !== localAccess.reason) {
        console.log("[useWorkspaceAccess] Edge Function override:", remote);
        setOverride(remote);
      }
    } catch (err) {
      console.error("check-workspace-access background error:", err);
    }
  }, [workspaceId, localAccess.allowed, localAccess.reason]);

  useEffect(() => {
    if (!workspaceId || wsLoading) return;

    // Reset override when workspace changes
    setOverride(null);
    bgCheckDone.current = false;

    // Run background check once after mount
    const timer = setTimeout(() => {
      if (!bgCheckDone.current) {
        bgCheckDone.current = true;
        checkBackground();
      }
    }, 500); // Small delay to not compete with initial render

    // Periodic recheck
    const interval = setInterval(() => checkBackground(), RECHECK_INTERVAL);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [workspaceId, wsLoading]); // intentionally not including checkBackground to avoid loops

  const result = override || localAccess;
  return { ...result, loading: wsLoading };
}
