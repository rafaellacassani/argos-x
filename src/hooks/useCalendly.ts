import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function callCalendlyApi(path: string, method: string, body?: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/calendly-api/${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 200) {
    throw new Error(data.error || "Calendly API error");
  }
  return data;
}

export function useCalendly() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [calendlyConnected, setCalendlyConnected] = useState(false);
  const [calendlyEmail, setCalendlyEmail] = useState<string | null>(null);
  const [schedulingUrl, setSchedulingUrl] = useState<string | null>(null);
  const [calendlyAllowed, setCalendlyAllowed] = useState(false);
  const [checkingCalendly, setCheckingCalendly] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Check if Calendly is allowed for this workspace
  useEffect(() => {
    if (!workspaceId) {
      setCheckingCalendly(false);
      return;
    }

    const check = async () => {
      try {
        const { data: allowed } = await supabase
          .from("calendly_allowed_workspaces" as any)
          .select("workspace_id")
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        setCalendlyAllowed(!!allowed);

        if (allowed) {
          const { data: conn } = await supabase
            .from("calendly_connections" as any)
            .select("calendly_email, scheduling_url, sync_enabled")
            .eq("workspace_id", workspaceId)
            .maybeSingle();

          if (conn) {
            setCalendlyConnected(true);
            setCalendlyEmail((conn as any).calendly_email || null);
            setSchedulingUrl((conn as any).scheduling_url || null);
          }
        }
      } catch {
        // silent
      } finally {
        setCheckingCalendly(false);
      }
    };

    check();
  }, [workspaceId]);

  const connectCalendly = useCallback(async (apiToken: string) => {
    if (!workspaceId) return false;
    setConnecting(true);
    try {
      const result = await callCalendlyApi("connect", "POST", { workspaceId, apiToken });
      if (result.success) {
        setCalendlyConnected(true);
        setCalendlyEmail(result.email);
        setSchedulingUrl(result.schedulingUrl);
        toast({ title: "Calendly conectado com sucesso!", description: `Conta: ${result.email}` });

        // Auto-sync events
        try {
          await callCalendlyApi("sync", "POST", { workspaceId });
        } catch (e) {
          console.warn("Auto-sync failed:", e);
        }

        return true;
      }
      throw new Error(result.error);
    } catch (err: any) {
      console.error("Error connecting Calendly:", err);
      toast({
        title: "Erro ao conectar Calendly",
        description: err.message || "Verifique o token e tente novamente",
        variant: "destructive",
      });
      return false;
    } finally {
      setConnecting(false);
    }
  }, [workspaceId]);

  const disconnectCalendly = useCallback(async () => {
    if (!workspaceId) return;
    try {
      await callCalendlyApi("disconnect", "DELETE", { workspaceId });
      setCalendlyConnected(false);
      setCalendlyEmail(null);
      setSchedulingUrl(null);
      toast({ title: "Calendly desconectado" });
    } catch (err) {
      console.error("Error disconnecting Calendly:", err);
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    }
  }, [workspaceId]);

  const syncCalendlyEvents = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const result = await callCalendlyApi("sync", "POST", { workspaceId });
      toast({
        title: "Sincronização Calendly concluída",
        description: `${result.imported || 0} novos eventos importados.`,
      });
    } catch (err) {
      console.error("Error syncing Calendly:", err);
      toast({ title: "Erro ao sincronizar Calendly", variant: "destructive" });
    }
  }, [workspaceId]);

  return {
    calendlyConnected,
    calendlyEmail,
    schedulingUrl,
    calendlyAllowed,
    checkingCalendly,
    connecting,
    connectCalendly,
    disconnectCalendly,
    syncCalendlyEvents,
  };
}
