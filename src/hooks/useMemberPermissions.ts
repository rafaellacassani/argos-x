import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./useWorkspace";
import { useAuth } from "./useAuth";

export interface MemberPermissions {
  id: string;
  workspace_id: string;
  user_id: string;
  allowed_pages: string[] | null;
  allowed_instance_ids: string[] | null;
  can_create_leads: boolean;
  can_edit_leads: boolean;
  can_delete_leads: boolean;
  can_create_instances: boolean;
}

const ALL_PAGES = [
  { path: "/", label: "Início" },
  { path: "/settings", label: "Conexões" },
  { path: "/ai-agents", label: "Agentes de IA" },
  { path: "/chats", label: "Chats" },
  { path: "/dashboard", label: "Painel de Dados" },
  { path: "/leads", label: "Funil de Vendas" },
  { path: "/contacts", label: "Contatos" },
  { path: "/calendar", label: "Calendário" },
  { path: "/salesbots", label: "SalesBots" },
  { path: "/campaigns", label: "Campanhas" },
  { path: "/email", label: "Email" },
  { path: "/statistics", label: "Estatísticas" },
  { path: "/planos", label: "Planos" },
  { path: "/configuracoes", label: "Configurações" },
  { path: "/treinamento", label: "Treinamento" },
];

export { ALL_PAGES };

const DEFAULT_PERMISSIONS: Omit<MemberPermissions, "id" | "workspace_id" | "user_id"> = {
  allowed_pages: null, // null = all pages
  allowed_instance_ids: null, // null = all instances
  can_create_leads: true,
  can_edit_leads: true,
  can_delete_leads: false,
  can_create_instances: false,
};

export function useMemberPermissions() {
  const { workspaceId, membership } = useWorkspace();
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<MemberPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = membership?.role === "admin";

  useEffect(() => {
    if (!workspaceId || !user) {
      setLoading(false);
      return;
    }

    // Admins have full access — no need to fetch
    if (isAdmin) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("member_permissions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching member permissions:", error);
      }

      setPermissions(data as MemberPermissions | null);
      setLoading(false);
    };

    fetchPermissions();
  }, [workspaceId, user, isAdmin]);

  // Check if user can access a specific page
  const canAccessPage = useCallback(
    (path: string): boolean => {
      if (isAdmin) return true;
      if (!permissions || permissions.allowed_pages === null) return true;
      return permissions.allowed_pages.includes(path);
    },
    [isAdmin, permissions]
  );

  // Check if user can access a specific WhatsApp instance
  const canAccessInstance = useCallback(
    (instanceId: string): boolean => {
      if (isAdmin) return true;
      if (!permissions || permissions.allowed_instance_ids === null) return true;
      return permissions.allowed_instance_ids.includes(instanceId);
    },
    [isAdmin, permissions]
  );

  const canCreateLeads = isAdmin || !permissions || permissions.can_create_leads;
  const canEditLeads = isAdmin || !permissions || permissions.can_edit_leads;
  const canDeleteLeads = isAdmin || (permissions?.can_delete_leads ?? false);
  const canCreateInstances = isAdmin || (permissions?.can_create_instances ?? false);

  // Admin functions to manage other users' permissions
  const fetchUserPermissions = useCallback(
    async (userId: string): Promise<MemberPermissions | null> => {
      if (!workspaceId) return null;
      const { data } = await supabase
        .from("member_permissions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();
      return data as MemberPermissions | null;
    },
    [workspaceId]
  );

  const saveUserPermissions = useCallback(
    async (
      userId: string,
      perms: Partial<Omit<MemberPermissions, "id" | "workspace_id" | "user_id">>
    ): Promise<boolean> => {
      if (!workspaceId) return false;

      const { error } = await supabase
        .from("member_permissions")
        .upsert(
          {
            workspace_id: workspaceId,
            user_id: userId,
            ...perms,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,user_id" }
        );

      if (error) {
        console.error("Error saving member permissions:", error);
        return false;
      }
      return true;
    },
    [workspaceId]
  );

  return {
    permissions,
    loading,
    isAdmin,
    canAccessPage,
    canAccessInstance,
    canCreateLeads,
    canEditLeads,
    canDeleteLeads,
    canCreateInstances,
    fetchUserPermissions,
    saveUserPermissions,
    ALL_PAGES,
  };
}
