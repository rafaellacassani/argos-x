import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export type AppRole = "admin" | "manager" | "seller";

export type NotificationType = "weekly_report" | "no_response" | "both" | "none";

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  roles: AppRole[];
  notification_type: NotificationType;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  notify_no_response: boolean;
  no_response_minutes: number;
  notify_weekly_report: boolean;
  weekly_report_day: number;
  weekly_report_hour: number;
}

export function useTeam() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const { workspaceId } = useWorkspace();

  // Helper function to convert booleans to notification type
  const getNotificationType = (
    notifyNoResponse: boolean | null,
    notifyWeeklyReport: boolean | null
  ): NotificationType => {
    const noResponse = notifyNoResponse ?? false;
    const weeklyReport = notifyWeeklyReport ?? false;
    
    if (noResponse && weeklyReport) return "both";
    if (noResponse) return "no_response";
    if (weeklyReport) return "weekly_report";
    return "none";
  };

  const fetchTeamMembers = useCallback(async () => {
    if (!workspaceId) return [];
    setLoading(true);
    try {
      // 1. Fetch workspace members to know which users belong to this workspace
      const { data: wsMembers, error: wsMembersError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      if (wsMembersError) throw wsMembersError;

      const memberUserIds = (wsMembers || []).map(m => m.user_id).filter(id => id !== "00000000-0000-0000-0000-000000000000");

      if (memberUserIds.length === 0) {
        setTeamMembers([]);
        return [];
      }

      // 2. Fetch profiles only for workspace members
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .in("user_id", memberUserIds)
        .order("full_name");

      if (profilesError) throw profilesError;

      // 3. Fetch roles only for workspace members
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .in("user_id", memberUserIds);

      if (rolesError) throw rolesError;

      // 4. Fetch notification settings only for workspace members
      const { data: notificationSettings, error: notifError } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (notifError) throw notifError;

      // Combine profiles with roles and notification settings
      const membersWithRoles: UserProfile[] = (profiles || []).map((profile) => {
        const userSettings = (notificationSettings || []).find(
          (ns) => ns.user_id === profile.user_id
        );
        
        return {
          ...profile,
          roles: (roles || [])
            .filter((r) => r.user_id === profile.user_id)
            .map((r) => r.role as AppRole),
          notification_type: getNotificationType(
            userSettings?.notify_no_response ?? null,
            userSettings?.notify_weekly_report ?? null
          ),
        };
      });

      setTeamMembers(membersWithRoles);
      return membersWithRoles;
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Erro ao carregar equipe",
        description: "Não foi possível carregar os membros da equipe.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast, workspaceId]);

  const createTeamMember = useCallback(
    async (data: {
      full_name: string;
      phone: string;
      email: string;
      roles: AppRole[];
    }) => {
      try {
        if (!workspaceId) throw new Error("Workspace não encontrado");
        if (!data.email) throw new Error("Email é obrigatório para enviar o convite");

        const { data: result, error } = await supabase.functions.invoke("invite-member", {
          body: {
            email: data.email,
            full_name: data.full_name,
            phone: data.phone,
            role: data.roles[0] || "seller",
            workspace_id: workspaceId,
          },
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        const isExisting = result?.already_registered;

        toast({
          title: isExisting ? "Membro adicionado" : "Convite enviado",
          description: isExisting
            ? `${data.full_name} foi adicionado ao workspace.`
            : `Um convite foi enviado para ${data.email}.`,
        });

        await fetchTeamMembers();
        return result;
      } catch (error: any) {
        console.error("Error creating team member:", error);
        toast({
          title: "Erro ao convidar membro",
          description: error?.message || "Não foi possível enviar o convite.",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, fetchTeamMembers, workspaceId]
  );

  const updateTeamMember = useCallback(
    async (
      userId: string,
      data: {
        full_name?: string;
        phone?: string;
        email?: string;
        roles?: AppRole[];
      }
    ) => {
      try {
        // Update profile
        if (data.full_name || data.phone || data.email !== undefined) {
          const { error: profileError } = await supabase
            .from("user_profiles")
            .update({
              full_name: data.full_name,
              phone: data.phone,
              email: data.email,
            })
            .eq("user_id", userId);

          if (profileError) throw profileError;
        }

        // Update roles if provided
        if (data.roles) {
          // Delete existing roles
          await supabase.from("user_roles").delete().eq("user_id", userId);

          // Insert new roles
          if (data.roles.length > 0) {
            const roleInserts = data.roles.map((role) => ({
              user_id: userId,
              role,
            }));

            const { error: rolesError } = await supabase
              .from("user_roles")
              .insert(roleInserts);

            if (rolesError) throw rolesError;
          }
        }

        toast({
          title: "Membro atualizado",
          description: "As informações foram atualizadas com sucesso.",
        });

        await fetchTeamMembers();
        return true;
      } catch (error) {
        console.error("Error updating team member:", error);
        toast({
          title: "Erro ao atualizar",
          description: "Não foi possível atualizar as informações.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchTeamMembers]
  );

  const deleteTeamMember = useCallback(
    async (
      userId: string,
      options?: {
        transferToUserId?: string;
      }
    ) => {
      try {
        if (!workspaceId) throw new Error("Workspace não encontrado");

        // 1) Resolve profile ids
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (profileError) throw profileError;
        const profileId = profile?.id;
        if (!profileId) throw new Error("Perfil do usuário não encontrado");

        let transferProfileId: string | null = null;
        if (options?.transferToUserId) {
          const { data: transferProfile, error: transferError } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("user_id", options.transferToUserId)
            .single();

          if (transferError) throw transferError;
          transferProfileId = transferProfile?.id || null;

          if (!transferProfileId) {
            throw new Error("Responsável de destino inválido");
          }
        }

        // 2) Check dependencies that reference user_profiles.id
        const [leadsCountRes, campaignsCountRes, salesCountRes] = await Promise.all([
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("responsible_user", profileId),
          supabase
            .from("campaigns")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("created_by", profileId),
          supabase
            .from("lead_sales")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("created_by", profileId),
        ]);

        if (leadsCountRes.error) throw leadsCountRes.error;
        if (campaignsCountRes.error) throw campaignsCountRes.error;
        if (salesCountRes.error) throw salesCountRes.error;

        const leadsCount = leadsCountRes.count || 0;
        const campaignsCount = campaignsCountRes.count || 0;
        const salesCount = salesCountRes.count || 0;
        const hasDependencies = leadsCount > 0 || campaignsCount > 0 || salesCount > 0;

        // 3) Require transfer target if there are assigned records
        if (hasDependencies && !transferProfileId) {
          throw new Error(
            `Este membro possui ${leadsCount} lead(s), ${campaignsCount} campanha(s) e ${salesCount} venda(s) vinculadas. Selecione um responsável para transferir antes de excluir.`
          );
        }

        // 4) Reassign ownership data before deletion
        if (transferProfileId) {
          const { error: leadsUpdateError } = await supabase
            .from("leads")
            .update({ responsible_user: transferProfileId })
            .eq("workspace_id", workspaceId)
            .eq("responsible_user", profileId);
          if (leadsUpdateError) throw leadsUpdateError;

          const { error: campaignsUpdateError } = await supabase
            .from("campaigns")
            .update({ created_by: transferProfileId })
            .eq("workspace_id", workspaceId)
            .eq("created_by", profileId);
          if (campaignsUpdateError) throw campaignsUpdateError;

          const { error: salesUpdateError } = await supabase
            .from("lead_sales")
            .update({ created_by: transferProfileId })
            .eq("workspace_id", workspaceId)
            .eq("created_by", profileId);
          if (salesUpdateError) throw salesUpdateError;

          const { error: scheduledUpdateError } = await supabase
            .from("scheduled_messages")
            .update({ created_by: transferProfileId })
            .eq("workspace_id", workspaceId)
            .eq("created_by", profileId);
          if (scheduledUpdateError) throw scheduledUpdateError;
        }

        // 5) Delete from tables that reference user_profile_id
        const { error: npError } = await supabase
          .from("notification_preferences")
          .delete()
          .eq("user_profile_id", profileId)
          .eq("workspace_id", workspaceId);
        if (npError) console.warn("Error deleting notification_preferences:", npError);

        const { error: alertError } = await supabase
          .from("alert_log")
          .delete()
          .eq("user_profile_id", profileId)
          .eq("workspace_id", workspaceId);
        if (alertError) console.warn("Error deleting alert_log:", alertError);

        // 6) Delete from tables that reference user_id directly
        const tablesToClean = [
          { table: "notification_settings" as const, col: "user_id" as const },
          { table: "user_roles" as const, col: "user_id" as const },
          { table: "calendar_events" as const, col: "user_id" as const },
          { table: "google_calendar_tokens" as const, col: "user_id" as const },
          { table: "email_accounts" as const, col: "user_id" as const },
        ];

        for (const { table, col } of tablesToClean) {
          const { error } = await supabase.from(table).delete().eq(col, userId);
          if (error) console.warn(`Error deleting ${table}:`, error);
        }

        // 7) If we didn't transfer scheduled messages ownership, delete them
        if (!transferProfileId) {
          const { error } = await supabase
            .from("scheduled_messages")
            .delete()
            .eq("created_by", profileId)
            .eq("workspace_id", workspaceId);
          if (error) console.warn("Error deleting scheduled_messages:", error);
        }

        // 8) Remove from workspace_members
        const { error: wmError } = await supabase
          .from("workspace_members")
          .delete()
          .eq("user_id", userId)
          .eq("workspace_id", workspaceId);
        if (wmError) console.warn("Error deleting workspace_members:", wmError);

        // 9) Finally delete profile
        const { error: deleteProfileError } = await supabase
          .from("user_profiles")
          .delete()
          .eq("user_id", userId);

        if (deleteProfileError) throw deleteProfileError;

        toast({
          title: "Membro removido",
          description: transferProfileId
            ? "Membro removido e carteira transferida com sucesso."
            : "O membro foi removido da equipe.",
        });

        await fetchTeamMembers();
        return true;
      } catch (error: any) {
        console.error("Error deleting team member:", error);
        toast({
          title: "Erro ao remover",
          description: error?.message || "Não foi possível remover o membro.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchTeamMembers, workspaceId]
  );

  const fetchNotificationSettings = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      return data as NotificationSettings | null;
    } catch (error) {
      console.error("Error fetching notification settings:", error);
      return null;
    }
  }, []);

  const updateNotificationSettings = useCallback(
    async (
      userId: string,
      settings: Partial<Omit<NotificationSettings, "id" | "user_id">>
    ) => {
      try {
        // Check if settings exist
        const existing = await fetchNotificationSettings(userId);

        if (existing) {
          const { error } = await supabase
            .from("notification_settings")
            .update(settings)
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          if (!workspaceId) throw new Error("Workspace não encontrado");
          const { error } = await supabase.from("notification_settings").insert({
            user_id: userId,
            ...settings,
            workspace_id: workspaceId
          });

          if (error) throw error;
        }

        toast({
          title: "Configurações salvas",
          description: "As preferências de notificação foram atualizadas.",
        });

        return true;
      } catch (error) {
        console.error("Error updating notification settings:", error);
        toast({
          title: "Erro ao salvar",
          description: "Não foi possível salvar as configurações.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchNotificationSettings]
  );

  const resendInvite = useCallback(
    async (email: string, fullName: string, role: AppRole) => {
      try {
        if (!workspaceId) throw new Error("Workspace não encontrado");

        const { data: result, error } = await supabase.functions.invoke("invite-member", {
          body: {
            email,
            full_name: fullName,
            phone: "",
            role,
            workspace_id: workspaceId,
            resend: true,
          },
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);

        toast({
          title: "Convite reenviado",
          description: `Um novo convite foi enviado para ${email}.`,
        });

        return true;
      } catch (error: any) {
        console.error("Error resending invite:", error);
        toast({
          title: "Erro ao reenviar convite",
          description: error?.message || "Não foi possível reenviar o convite.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, workspaceId]
  );

  return {
    loading,
    teamMembers,
    fetchTeamMembers,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    fetchNotificationSettings,
    updateNotificationSettings,
    resendInvite,
  };
}
