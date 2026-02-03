import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("full_name");

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch notification settings for all users
      const { data: notificationSettings, error: notifError } = await supabase
        .from("notification_settings")
        .select("*");

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
  }, [toast]);

  const createTeamMember = useCallback(
    async (data: {
      full_name: string;
      phone: string;
      email?: string;
      roles: AppRole[];
    }) => {
      try {
        // For now, we create a profile without a real auth user
        // In production, you'd send an invite email
        const tempUserId = crypto.randomUUID();

        // Create profile
        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            user_id: tempUserId,
            full_name: data.full_name,
            phone: data.phone,
            email: data.email || null,
          })
          .select()
          .single();

        if (profileError) throw profileError;

        // Create roles
        if (data.roles.length > 0) {
          const roleInserts = data.roles.map((role) => ({
            user_id: tempUserId,
            role,
          }));

          const { error: rolesError } = await supabase
            .from("user_roles")
            .insert(roleInserts);

          if (rolesError) throw rolesError;
        }

        // Create default notification settings
        await supabase.from("notification_settings").insert({
          user_id: tempUserId,
        });

        toast({
          title: "Membro adicionado",
          description: `${data.full_name} foi adicionado à equipe.`,
        });

        await fetchTeamMembers();
        return profile;
      } catch (error) {
        console.error("Error creating team member:", error);
        toast({
          title: "Erro ao adicionar membro",
          description: "Não foi possível adicionar o membro à equipe.",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast, fetchTeamMembers]
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
    async (userId: string) => {
      try {
        // Delete roles first
        await supabase.from("user_roles").delete().eq("user_id", userId);

        // Delete notification settings
        await supabase.from("notification_settings").delete().eq("user_id", userId);

        // Delete profile
        const { error } = await supabase
          .from("user_profiles")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;

        toast({
          title: "Membro removido",
          description: "O membro foi removido da equipe.",
        });

        await fetchTeamMembers();
        return true;
      } catch (error) {
        console.error("Error deleting team member:", error);
        toast({
          title: "Erro ao remover",
          description: "Não foi possível remover o membro.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast, fetchTeamMembers]
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
          const { error } = await supabase.from("notification_settings").insert({
            user_id: userId,
            ...settings,
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

  return {
    loading,
    teamMembers,
    fetchTeamMembers,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    fetchNotificationSettings,
    updateNotificationSettings,
  };
}
