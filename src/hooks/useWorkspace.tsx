import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
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
  loading: boolean;
  hasWorkspace: boolean;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  inviteMember: (email: string, role: "admin" | "manager" | "seller") => Promise<boolean>;
  fetchMembers: () => Promise<WorkspaceMember[]>;
  removeMember: (memberId: string) => Promise<boolean>;
  updateMemberRole: (memberId: string, role: "admin" | "manager" | "seller") => Promise<boolean>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Load workspace for current user
  useEffect(() => {
    if (!user) {
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const loadWorkspace = async () => {
      setLoading(true);
      try {
        // Find user's accepted membership
        const { data: memberData, error: memberError } = await supabase
          .from("workspace_members")
          .select("*")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1)
          .maybeSingle();

        if (memberError) throw memberError;

        if (memberData) {
          setMembership(memberData as WorkspaceMember);
          
          // Fetch workspace details
          const { data: wsData, error: wsError } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", memberData.workspace_id)
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
              // Auto-accept the invite
              const { error: acceptError } = await supabase
                .from("workspace_members")
                .update({ user_id: user.id, accepted_at: new Date().toISOString() })
                .eq("id", invite.id);

              if (!acceptError) {
                // Reload
                loadWorkspace();
                return;
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
      }
    };

    loadWorkspace();
  }, [user]);

  const createWorkspace = useCallback(async (name: string): Promise<Workspace | null> => {
    if (!user) return null;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const syncAuthSession = async () => {
      // Em alguns navegadores/condições, o estado do Auth pode estar ok no React,
      // mas o token não estar sendo anexado nas chamadas do PostgREST.
      // Forçamos o carregamento/refresh e re-set da sessão antes de gravar.
      const { data: sessionData } = await supabase.auth.getSession();
      const current = sessionData.session;

      if (current?.access_token && current.refresh_token) {
        await supabase.auth.setSession({
          access_token: current.access_token,
          refresh_token: current.refresh_token,
        });
        return current;
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("Failed to refresh session before workspace create:", refreshError);
        return null;
      }

      const next = refreshed.session;
      if (next?.access_token && next.refresh_token) {
        await supabase.auth.setSession({
          access_token: next.access_token,
          refresh_token: next.refresh_token,
        });
      }

      return next ?? null;
    };

    const isRlsAuthError = (err: unknown) => {
      const anyErr = err as { code?: string; message?: string } | null;
      const msg = anyErr?.message ?? "";
      return anyErr?.code === "42501" || msg.toLowerCase().includes("row-level security policy");
    };

    try {
      const session = await syncAuthSession();
      if (!session?.access_token) {
        console.error("Workspace create blocked: no session/access_token available");
        return null;
      }

      const attemptInsert = async () => {
        const { data: ws, error: wsError } = await supabase
          .from("workspaces")
          .insert({ name, slug: `${slug}-${Date.now()}`, created_by: user.id })
          .select()
          .single();

        if (wsError) throw wsError;
        return ws as Workspace;
      };

      let workspace = await attemptInsert();

      // Retry 1x se cair como anon (RLS 42501) por sessão não anexada.
      // Isso evita o “Mesmo erro” intermitente após login/refresh.
      try {
        // Add creator as admin member
        const { error: memberError } = await supabase.from("workspace_members").insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: "admin" as const,
          accepted_at: new Date().toISOString(),
        });

        if (memberError) throw memberError;
      } catch (memberErr) {
        if (isRlsAuthError(memberErr)) {
          await syncAuthSession();
          const { error: memberErrorRetry } = await supabase.from("workspace_members").insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: "admin" as const,
            accepted_at: new Date().toISOString(),
          });
          if (memberErrorRetry) throw memberErrorRetry;
        } else {
          throw memberErr;
        }
      }

      setWorkspace(workspace);
      setMembership({
        id: "",
        workspace_id: workspace.id,
        user_id: user.id,
        role: "admin",
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        invited_email: null,
      });

      return workspace;
    } catch (err) {
      if (isRlsAuthError(err)) {
        // Uma segunda tentativa completa (sincroniza sessão e tenta inserir novamente)
        try {
          await syncAuthSession();
          const { data: ws, error: wsError } = await supabase
            .from("workspaces")
            .insert({ name, slug: `${slug}-${Date.now()}`, created_by: user.id })
            .select()
            .single();

          if (wsError) throw wsError;

          const workspace = ws as Workspace;

          const { error: memberError } = await supabase.from("workspace_members").insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: "admin" as const,
            accepted_at: new Date().toISOString(),
          });

          if (memberError) throw memberError;

          setWorkspace(workspace);
          setMembership({
            id: "",
            workspace_id: workspace.id,
            user_id: user.id,
            role: "admin",
            invited_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            invited_email: null,
          });

          return workspace;
        } catch (retryErr) {
          console.error("Error creating workspace (after auth retry):", retryErr);
          return null;
        }
      }

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
          user_id: "00000000-0000-0000-0000-000000000000", // placeholder until accepted
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
      loading,
      hasWorkspace: !!workspace,
      createWorkspace,
      inviteMember,
      fetchMembers,
      removeMember,
      updateMemberRole,
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
