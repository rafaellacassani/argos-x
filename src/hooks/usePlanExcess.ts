import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { PLAN_DEFINITIONS } from "./usePlanLimits";

export interface ExcessItem {
  type: "leads" | "whatsapp" | "users" | "agents";
  current: number;
  limit: number;
  excess: number;
  label: string;
  resolveLabel: string;
  resolvePath: string;
}

export interface PlanExcessState {
  loading: boolean;
  hasExcess: boolean;
  items: ExcessItem[];
  planName: string;
  refetch: () => void;
}

const RESOLVE_PATHS = new Set([
  "/leads",
  "/ai-agents",
  "/settings",
  "/configuracoes",
  "/planos",
  "/perfil",
  "/aguardando-ativacao",
  "/admin/clients",
  "/suporte",
]);

export function isExcessResolvePath(pathname: string): boolean {
  // Allow exact resolve paths and any descendants
  for (const p of RESOLVE_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) return true;
  }
  return false;
}

export function usePlanExcess(): PlanExcessState {
  const { workspace, workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExcessItem[]>([]);

  const fetchExcess = useCallback(async () => {
    if (!workspaceId || !workspace) return;

    const planKey = (workspace.plan_name || "essencial") as keyof typeof PLAN_DEFINITIONS;
    const planDef = PLAN_DEFINITIONS[planKey] || PLAN_DEFINITIONS.essencial;

    const leadLimit = workspace.lead_limit ?? planDef.leadLimit;
    const extraLeads = workspace.extra_leads ?? 0;
    const totalLeadLimit = leadLimit + extraLeads;
    const whatsappLimit = workspace.whatsapp_limit ?? planDef.whatsappLimit;
    const userLimit = workspace.user_limit ?? planDef.userLimit;
    // Active agents limit is implied by plan tier (Essencial=1, Negocio=3, Escala=ilimitado)
    const agentsLimit =
      planKey === "essencial" ? 1 : planKey === "negocio" ? 3 : planKey === "gratuito" ? 1 : 999;

    try {
      const [leadsRes, evoRes, cloudRes, membersRes, agentsRes, packsRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("whatsapp_instances").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("whatsapp_cloud_connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase
          .from("workspace_members")
          .select("user_id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .not("accepted_at", "is", null),
        supabase
          .from("ai_agents")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("is_active", true),
        supabase
          .from("lead_packs")
          .select("pack_size")
          .eq("workspace_id", workspaceId)
          .eq("active", true),
      ]);

      const leadsCount = leadsRes.count ?? 0;
      const whatsappCount = (evoRes.count ?? 0) + (cloudRes.count ?? 0);
      const usersCount = membersRes.count ?? 0;
      const agentsCount = agentsRes.count ?? 0;
      const packExtra = (packsRes.data ?? []).reduce((s, p: any) => s + (p.pack_size ?? 0), 0);
      const finalLeadLimit = totalLeadLimit + packExtra;

      const out: ExcessItem[] = [];

      if (leadsCount > finalLeadLimit && finalLeadLimit > 0) {
        out.push({
          type: "leads",
          current: leadsCount,
          limit: finalLeadLimit,
          excess: leadsCount - finalLeadLimit,
          label: "Leads",
          resolveLabel: "Excluir leads",
          resolvePath: "/leads",
        });
      }
      if (whatsappCount > whatsappLimit) {
        out.push({
          type: "whatsapp",
          current: whatsappCount,
          limit: whatsappLimit,
          excess: whatsappCount - whatsappLimit,
          label: "Conexões WhatsApp",
          resolveLabel: "Remover conexões",
          resolvePath: "/settings?tab=whatsapp",
        });
      }
      if (usersCount > userLimit) {
        out.push({
          type: "users",
          current: usersCount,
          limit: userLimit,
          excess: usersCount - userLimit,
          label: "Usuários",
          resolveLabel: "Remover usuários",
          resolvePath: "/configuracoes?tab=team",
        });
      }
      if (agentsCount > agentsLimit) {
        out.push({
          type: "agents",
          current: agentsCount,
          limit: agentsLimit,
          excess: agentsCount - agentsLimit,
          label: "Agentes de IA ativos",
          resolveLabel: "Desativar agentes",
          resolvePath: "/ai-agents",
        });
      }

      setItems(out);
    } catch (err) {
      console.error("usePlanExcess error:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, workspace]);

  useEffect(() => {
    fetchExcess();
  }, [fetchExcess]);

  return {
    loading,
    hasExcess: items.length > 0,
    items,
    planName: (workspace?.plan_name as string) || "essencial",
    refetch: fetchExcess,
  };
}