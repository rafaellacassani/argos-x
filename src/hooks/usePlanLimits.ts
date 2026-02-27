import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";

export const PLAN_DEFINITIONS = {
  gratuito: {
    name: 'Gratuito',
    price: 0,
    leadLimit: 300,
    whatsappLimit: 1,
    userLimit: 1,
    aiLimit: 100,
    color: 'gray',
    description: 'Plano gratuito',
  },
  essencial: {
    name: 'Essencial',
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
  wsUpdatedAt: string | undefined;
}

const cache = new Map<string, CacheEntry>();

export function usePlanLimits(): PlanLimits {
  const { workspace, workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<Omit<PlanLimits, "canAddWhatsapp" | "canAddUser" | "loading" | "refetch">>({
    planName: "essencial",
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
    if (!workspaceId || !workspace || fetchingRef.current) return;

    // PROTEÇÃO 2: Use workspace.updated_at as cache key
    const wsUpdatedAt = (workspace as any).updated_at;

    if (!force) {
      const cached = cache.get(workspaceId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.wsUpdatedAt === wsUpdatedAt) {
        setState(cached.data);
        setLoading(false);
        return;
      }
    }

    fetchingRef.current = true;
    try {
      // Reuse workspace data for limits instead of separate query
      const ws = workspace;
      const leadLimit = ws.lead_limit ?? 300;
      const wsExtraLeads = ws.extra_leads ?? 0;
      const whatsappLimit = ws.whatsapp_limit ?? 1;
      const userLimit = ws.user_limit ?? 1;
      const aiInteractionsLimit = ws.ai_interactions_limit ?? 100;
      const aiInteractionsUsed = ws.ai_interactions_used ?? 0;
      const planName = ws.plan_name ?? "essencial";

      // Only 2 queries instead of 3 (leads count + lead_packs)
      const [countResult, packsResult] = await Promise.all([
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

      const currentLeadCount = countResult.count ?? 0;
      const packExtra = (packsResult.data ?? []).reduce((sum, p) => sum + (p.pack_size ?? 0), 0);
      const extraLeads = wsExtraLeads + packExtra;
      const totalLeadLimit = leadLimit + extraLeads;
      const leadUsagePercent = totalLeadLimit > 0 ? Math.round((currentLeadCount / totalLeadLimit) * 100) : 0;

      const data = {
        planName,
        leadLimit,
        extraLeads,
        totalLeadLimit,
        currentLeadCount,
        leadUsagePercent,
        isNearLeadLimit: leadUsagePercent >= 80,
        isAtLeadLimit: leadUsagePercent >= 100,
        whatsappLimit,
        userLimit,
        aiInteractionsLimit,
        aiInteractionsUsed,
        canAddLead: currentLeadCount < totalLeadLimit,
      };

      cache.set(workspaceId, { data, timestamp: Date.now(), wsUpdatedAt });
      setState(data);
    } catch (err) {
      console.error("usePlanLimits error:", err);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [workspaceId, workspace]);

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
