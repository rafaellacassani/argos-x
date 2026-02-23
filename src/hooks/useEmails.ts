import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EmailAccount {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: string;
  email_address: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface Email {
  id: string;
  email_account_id: string;
  workspace_id: string;
  provider_id: string;
  thread_id: string | null;
  from_name: string | null;
  from_email: string | null;
  to_emails: string[];
  cc_emails: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  folder: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachments: any[];
  received_at: string;
  created_at: string;
}

export function useEmails() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const [emailAccount, setEmailAccount] = useState<EmailAccount | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch email account for current workspace
  const fetchEmailAccount = useCallback(async () => {
    if (!workspace?.id) return;
    
    const { data, error } = await supabase
      .from("email_accounts")
      .select("id, workspace_id, user_id, provider, email_address, is_active, last_synced_at, created_at")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching email account:", error);
      return;
    }
    setEmailAccount(data as EmailAccount | null);
  }, [workspace?.id]);

  // Fetch emails from local cache
  const fetchEmails = useCallback(async (folder: string = "inbox") => {
    if (!workspace?.id || !emailAccount?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("emails")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("email_account_id", emailAccount.id)
      .eq("folder", folder)
      .order("received_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching emails:", error);
    } else {
      setEmails((data as Email[]) || []);
    }
    setLoading(false);
  }, [workspace?.id, emailAccount?.id]);

  // Connect Gmail
  const connectGmail = useCallback(async () => {
    if (!workspace?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/gmail-oauth/url`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ workspaceId: workspace.id }),
        }
      );

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Erro ao gerar URL de autorização");
      }
    } catch (err) {
      console.error("Connect Gmail error:", err);
      toast.error("Erro ao conectar Gmail");
    }
  }, [workspace?.id]);

  // Disconnect Gmail
  const disconnectGmail = useCallback(async () => {
    if (!emailAccount?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/gmail-oauth/disconnect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ emailAccountId: emailAccount.id }),
        }
      );

      const data = await res.json();
      if (data.success) {
        setEmailAccount(null);
        setEmails([]);
        toast.success("Gmail desconectado");
      } else {
        toast.error("Erro ao desconectar");
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Erro ao desconectar Gmail");
    }
  }, [emailAccount?.id]);

  // Sync emails
  const syncEmails = useCallback(async () => {
    if (!emailAccount?.id) return;
    setSyncing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/sync-emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ emailAccountId: emailAccount.id }),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success(`${data.synced} emails sincronizados`);
        // Refresh list
        await fetchEmails();
      } else {
        toast.error("Erro na sincronização");
      }
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Erro ao sincronizar emails");
    } finally {
      setSyncing(false);
    }
  }, [emailAccount?.id, fetchEmails]);

  // Send email
  const sendEmail = useCallback(async (to: string, subject: string, bodyHtml: string, cc?: string, replyToEmailId?: string) => {
    if (!emailAccount?.id) return false;
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            emailAccountId: emailAccount.id,
            to,
            cc,
            subject,
            bodyHtml,
            replyToEmailId,
          }),
        }
      );

      const data = await res.json();
      if (data.success) {
        toast.success("Email enviado com sucesso!");
        return true;
      } else {
        toast.error("Erro ao enviar email");
        return false;
      }
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Erro ao enviar email");
      return false;
    } finally {
      setSending(false);
    }
  }, [emailAccount?.id]);

  // Email actions (mark read, star, archive, etc.)
  const performAction = useCallback(async (emailId: string, action: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/email-actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ emailId, action }),
        }
      );

      const data = await res.json();
      if (data.success) {
        // Update local state
        setEmails(prev => prev.map(e => {
          if (e.id !== emailId) return e;
          switch (action) {
            case "mark_read": return { ...e, is_read: true };
            case "mark_unread": return { ...e, is_read: false };
            case "star": return { ...e, is_starred: true };
            case "unstar": return { ...e, is_starred: false };
            case "archive": return { ...e, folder: "archive" };
            case "trash": return { ...e, folder: "trash" };
            case "move_to_inbox": return { ...e, folder: "inbox" };
            default: return e;
          }
        }).filter(e => {
          // Remove from current view if moved
          if (["archive", "trash"].includes(action)) return e.id !== emailId;
          return true;
        }));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Action error:", err);
      return false;
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEmailAccount();
  }, [fetchEmailAccount]);

  // Fetch emails when account is available
  useEffect(() => {
    if (emailAccount) {
      fetchEmails();
    } else {
      setLoading(false);
    }
  }, [emailAccount, fetchEmails]);

  // Realtime subscription
  useEffect(() => {
    if (!workspace?.id) return;

    const channel = supabase
      .channel("emails-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emails",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          // Refresh on any change
          if (emailAccount) fetchEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspace?.id, emailAccount, fetchEmails]);

  return {
    emailAccount,
    emails,
    loading,
    syncing,
    sending,
    connectGmail,
    disconnectGmail,
    syncEmails,
    sendEmail,
    performAction,
    fetchEmails,
    fetchEmailAccount,
  };
}
