import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export const PLAN_DEFINITIONS = {
  semente: {
    name: 'Semente',
    price: 47,
    leadLimit: 300,
    whatsappLimit: 1,
    userLimit: 1,
    aiLimit: 100,
    color: 'emerald',
    description: 'Para autônomos e MEIs começando',
  },
  negocio: {
    name: 'Negócio',
    price: 97,
    extraUserPrice: 37,
    leadLimit: 2000,
    whatsappLimit: 3,
    userLimit: 1,
    aiLimit: 500,
    color: 'blue',
    description: 'Para pequenas empresas com time',
  },
  escala: {
    name: 'Escala',
    price: 197,
    extraUserPrice: 57,
    leadLimit: 999999,
    whatsappLimit: 999,
    userLimit: 3,
    aiLimit: 2000,
    color: 'purple',
    description: 'Para times de vendas em crescimento',
  },
} as const;

export const LEAD_PACK_DEFINITIONS = [
  { size: 1000, price: 17, label: '+1.000 leads' },
  { size: 5000, price: 47, label: '+5.000 leads' },
  { size: 20000, price: 97, label: '+20.000 leads' },
  { size: 50000, price: 197, label: '+50.000 leads' },
] as const;

export interface PlanLimits {
  planName: string;
  leadLimit: number;
  extraLeads: number;
  totalLeadLimit: number;
  currentLeadCount: number;
  leadUsagePercent: number;
  isNearLeadLimit: boolean;
  isAtLeadLimit: boolean;
  whatsappLimit: number;
  userLimit: number;
  aiInteractionsLimit: number;
  aiInteractionsUsed: number;
  canAddLead: boolean;
  canAddWhatsapp: (currentCount: number) => boolean;
  canAddUser: (currentCount: number) => boolean;
  loading: boolean;
  refetch: () => void;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  data: Omit<PlanLimits, "canAddWhatsapp" | "canAddUser" | "loading" | "refetch">;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function usePlanLimits(): PlanLimits {
  const { workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Omit<PlanLimits, "canAddWhatsapp" | "canAddUser" | "loading" | "refetch">>({
    planName: "semente",
    leadLimit: 300,
    extraLeads: 0,
    totalLeadLimit: 300,
    currentLeadCount: 0,
    leadUsagePercent: 0,
    isNearLeadLimit: false,
    isAtLeadLimit: false,
    whatsappLimit: 1,
    userLimit: 1,
    aiInteractionsLimit: 100,
    aiInteractionsUsed: 0,
    canAddLead: true,
  });
  const fetchingRef = useRef(false);

  const fetchLimits = useCallback(async (force = false) => {
    if (!workspaceId || fetchingRef.current) return;

    if (!force) {
      const cached = cache.get(workspaceId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setState(cached.data);
        setLoading(false);
        return;
      }
    }

    fetchingRef.current = true;
    try {
      const [wsResult, countResult, packsResult] = await Promise.all([
        supabase
          .from("workspaces")
          .select("plan_name, lead_limit, extra_leads, whatsapp_limit, user_limit, ai_interactions_limit, ai_interactions_used")
          .eq("id", workspaceId)
          .single(),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        supabase
          .from("lead_packs")
          .select("pack_size")
          .eq("workspace_id", workspaceId)
          .eq("active", true),
      ]);

      const ws = wsResult.data;
      if (!ws) return;

      const currentLeadCount = countResult.count ?? 0;
      const packExtra = (packsResult.data ?? []).reduce((sum, p) => sum + (p.pack_size ?? 0), 0);
      const leadLimit = ws.lead_limit ?? 300;
      const extraLeads = (ws.extra_leads ?? 0) + packExtra;
      const totalLeadLimit = leadLimit + extraLeads;
      const leadUsagePercent = totalLeadLimit > 0 ? Math.round((currentLeadCount / totalLeadLimit) * 100) : 0;

      const data = {
        planName: ws.plan_name ?? "semente",
        leadLimit,
        extraLeads,
        totalLeadLimit,
        currentLeadCount,
        leadUsagePercent,
        isNearLeadLimit: leadUsagePercent >= 80,
        isAtLeadLimit: leadUsagePercent >= 100,
        whatsappLimit: ws.whatsapp_limit ?? 1,
        userLimit: ws.user_limit ?? 1,
        aiInteractionsLimit: ws.ai_interactions_limit ?? 100,
        aiInteractionsUsed: ws.ai_interactions_used ?? 0,
        canAddLead: currentLeadCount < totalLeadLimit,
      };

      cache.set(workspaceId, { data, timestamp: Date.now() });
      setState(data);
    } catch (err) {
      console.error("usePlanLimits error:", err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const refetch = useCallback(() => {
    if (workspaceId) cache.delete(workspaceId);
    fetchLimits(true);
  }, [workspaceId, fetchLimits]);

  const canAddWhatsapp = useCallback(
    (currentCount: number) => currentCount < state.whatsappLimit,
    [state.whatsappLimit]
  );

  const canAddUser = useCallback(
    (currentCount: number) => currentCount < state.userLimit,
    [state.userLimit]
  );

  return { ...state, loading, refetch, canAddWhatsapp, canAddUser };
}
