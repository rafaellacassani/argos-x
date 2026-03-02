import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  alert_instance_name?: string | null;
  logo_url?: string | null;
  // Plan/access fields for local validation
  plan_type?: string;
  subscription_status?: string;
  trial_end?: string | null;
  blocked_at?: string | null;
  updated_at?: string;
  // Limits fields
  plan_name?: string | null;
  lead_limit?: number | null;
  extra_leads?: number | null;
  whatsapp_limit?: number | null;
  user_limit?: number | null;
  ai_interactions_limit?: number | null;
  ai_interactions_used?: number | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "admin" | "manager" | "seller";
  invited_at: string;
  accepted_at: string | null;
  invited_email: string | null;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaceId: string | null;
  membership: WorkspaceMember | null;
  userProfileId: string | null;
  loading: boolean;
  hasWorkspace: boolean;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  inviteMember: (email: string, role: "admin" | "manager" | "seller") => Promise<boolean>;
  fetchMembers: () => Promise<WorkspaceMember[]>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: "admin" | "manager" | "seller") => Promise<boolean>;
  refreshWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      setWorkspace(null);
      setMembership(null);
      setUserProfileId(null);
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load, not on background refreshes
    if (!initialLoadDone) {
      setLoading(true);
    }
    try {
      // Fetch membership and profile in parallel
      const [memberResult, profileResult] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("*")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (profileResult.data) {
        setUserProfileId(profileResult.data.id);
      }

      if (memberResult.error) throw memberResult.error;

      if (memberResult.data) {
        setMembership(memberResult.data as WorkspaceMember);
        
        // Fetch workspace with ALL needed fields (plan, limits, access)
        const { data: wsData, error: wsError } = await supabase
          .from("workspaces")
          .select("*")
          .eq("id", memberResult.data.workspace_id)
          .single();

        if (wsError) throw wsError;
        setWorkspace(wsData as Workspace);
      } else {
        // Check for pending invitations by email
        const userEmail = user.email;
        if (userEmail) {
          const { data: invite } = await supabase
            .from("workspace_members")
            .select("*")
            .eq("invited_email", userEmail)
            .is("accepted_at", null)
            .limit(1)
            .maybeSingle();

          if (invite) {
            const { data: acceptData, error: acceptError } = await supabase.functions.invoke("accept-invite");

            if (!acceptError && acceptData?.workspace_id) {
              loadWorkspace();
              return;
            } else {
              console.error("Error accepting invite via edge function:", acceptError);
            }
          }
        }
        setWorkspace(null);
        setMembership(null);
      }
    } catch (err) {
      console.error("Error loading workspace:", err);
      setWorkspace(null);
      setMembership(null);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [user]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const refreshWorkspace = useCallback(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!user) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error("No session available for workspace creation");
        return null;
      }

      const response = await supabase.functions.invoke("create-workspace", {
        body: { name },
      });

      if (response.error) {
        console.error("Edge function error:", response.error);
        return null;
      }

      const { workspace: ws } = response.data;
      if (!ws) {
        console.error("No workspace returned from edge function");
        return null;
      }

      setWorkspace(ws as Workspace);
      setMembership({
        id: "",
        workspace_id: ws.id,
        user_id: user.id,
        role: "admin",
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        invited_email: null,
      });

      return ws as Workspace;
    } catch (err) {
      console.error("Error creating workspace:", err);
      return null;
    }
  }, [user]);

  const inviteMember = useCallback(async (email: string, role: "admin" | "manager" | "seller"): Promise<boolean> => {
    if (!workspace) return false;
    
    try {
      const { error } = await supabase
        .from("workspace_members")
        .insert({
          workspace_id: workspace.id,
          user_id: "00000000-0000-0000-0000-000000000000",
          role,
          invited_email: email,
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error inviting member:", err);
      return false;
    }
  }, [workspace]);

  const fetchMembers = useCallback(async (): Promise<WorkspaceMember[]> => {
    if (!workspace) return [];
    
    try {
      const { data, error } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", workspace.id);

      if (error) throw error;
      return (data || []) as WorkspaceMember[];
    } catch (err) {
      console.error("Error fetching members:", err);
      return [];
    }
  }, [workspace]);

  const removeMember = useCallback(async (memberId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error removing member:", err);
      return false;
    }
  }, []);

  const updateMemberRole = useCallback(async (memberId: string, role: "admin" | "manager" | "seller"): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("workspace_members")
        .update({ role })
        .eq("id", memberId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error updating member role:", err);
      return false;
    }
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      workspaceId: workspace?.id ?? null,
      membership,
      userProfileId,
      loading,
      hasWorkspace: !!workspace,
      createWorkspace,
      inviteMember,
      fetchMembers,
      removeMember,
      updateMemberRole,
      refreshWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
