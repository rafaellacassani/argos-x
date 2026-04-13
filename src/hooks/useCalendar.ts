import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  type: string;
  color: string | null;
  lead_id: string | null;
  location: string | null;
  google_event_id: string | null;
  synced_to_google: boolean;
  last_synced_at: string | null;
  meet_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  type?: string;
  color?: string;
  lead_id?: string;
  location?: string;
}

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

async function callSyncFunction(
  path: string,
  method: string,
  body?: Record<string, unknown>,
  timeoutMs = 90000
) {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Sync function error");
    }

    return res.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo limite da sincronização excedido");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function callOAuthFunction(path: string, method: string, body?: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-oauth${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "OAuth function error");
  }
  return res.json();
}

export function useCalendar() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [checkingGoogle, setCheckingGoogle] = useState(true);
  const autoPulledRef = useRef(false);

  // Check Google connection status
  useEffect(() => {
    if (!user) {
      setCheckingGoogle(false);
      return;
    }

    const checkGoogle = async () => {
      try {
        const { data, error } = await supabase
          .from("google_calendar_tokens" as any)
          .select("google_email, sync_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && data) {
          setGoogleConnected(true);
          setGoogleEmail((data as any).google_email || null);
        } else {
          setGoogleConnected(false);
          setGoogleEmail(null);
        }
      } catch {
        setGoogleConnected(false);
      } finally {
        setCheckingGoogle(false);
      }
    };

    checkGoogle();
  }, [user]);

  // Fetch events for a period
  const fetchEvents = useCallback(async (year: number, month: number) => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("calendar_events" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("start_at", startDate)
        .lte("start_at", endDate)
        .order("start_at", { ascending: true });

      if (error) throw error;
      setEvents((data as unknown as CalendarEvent[]) || []);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  // Create event
  const createEvent = useCallback(async (data: CreateEventData) => {
    if (!user || !workspaceId) return null;

    try {
      const { data: newEvent, error } = await supabase
        .from("calendar_events" as any)
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          title: data.title,
          description: data.description || null,
          start_at: data.start_at,
          end_at: data.end_at,
          all_day: data.all_day || false,
          type: data.type || "meeting",
          color: data.color || "#3B82F6",
          lead_id: data.lead_id || null,
          location: data.location || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-push to Google if connected
      if (googleConnected && newEvent) {
        try {
          await callSyncFunction("/push", "POST", { eventId: (newEvent as any).id });
        } catch (syncErr) {
          console.error("Auto-sync to Google failed:", syncErr);
        }
      }

      return newEvent as unknown as CalendarEvent;
    } catch (err) {
      console.error("Error creating event:", err);
      toast({ title: "Erro ao criar evento", variant: "destructive" });
      return null;
    }
  }, [user, workspaceId, googleConnected]);

  // Update event
  const updateEvent = useCallback(async (id: string, data: Partial<CreateEventData>) => {
    try {
      const { error } = await supabase
        .from("calendar_events" as any)
        .update(data)
        .eq("id", id);

      if (error) throw error;

      // Auto-push to Google if connected
      if (googleConnected) {
        try {
          await callSyncFunction("/push", "POST", { eventId: id });
        } catch (syncErr) {
          console.error("Auto-sync to Google failed:", syncErr);
        }
      }

      return true;
    } catch (err) {
      console.error("Error updating event:", err);
      toast({ title: "Erro ao atualizar evento", variant: "destructive" });
      return false;
    }
  }, [googleConnected]);

  // Delete event
  const deleteEvent = useCallback(async (id: string) => {
    try {
      // Sync delete to Google first
      if (googleConnected) {
        try {
          await callSyncFunction("/delete", "DELETE", { eventId: id });
        } catch (syncErr) {
          console.error("Google sync delete failed:", syncErr);
        }
      }

      const { error } = await supabase
        .from("calendar_events" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error deleting event:", err);
      toast({ title: "Erro ao deletar evento", variant: "destructive" });
      return false;
    }
  }, [googleConnected]);

  // Connect Google Calendar
  const connectGoogle = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await callOAuthFunction("/url", "POST", { workspaceId });
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast({ title: "Erro ao gerar URL de autorização", variant: "destructive" });
      }
    } catch (err) {
      console.error("Error connecting Google:", err);
      toast({ title: "Erro ao conectar Google Calendar", variant: "destructive" });
    }
  }, [workspaceId]);

  // Disconnect Google Calendar
  const disconnectGoogle = useCallback(async () => {
    try {
      await callOAuthFunction("/disconnect", "DELETE");
      setGoogleConnected(false);
      setGoogleEmail(null);
      toast({ title: "Google Calendar desconectado" });
    } catch (err) {
      console.error("Error disconnecting Google:", err);
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    }
  }, []);

  // Pull from Google Calendar
  const pullFromGoogle = useCallback(async () => {
    if (!user) return;
    try {
      const data = await callSyncFunction("/pull", "POST", {
        userId: user.id,
        workspaceId,
        daysAhead: 60,
        daysBehind: 90,
      });

      toast({
        title: "Sincronização concluída",
        description: `${data?.imported || 0} novos eventos importados.`,
      });
    } catch (err) {
      console.error("Error pulling from Google:", err);
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    }
  }, [user, workspaceId]);

  // Auto-pull after Google connection is detected
  useEffect(() => {
    if (googleConnected && user && !autoPulledRef.current) {
      autoPulledRef.current = true;
      pullFromGoogle();
    }
  }, [googleConnected, user, pullFromGoogle]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel("calendar_events_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calendar_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setEvents((prev) => [...prev, payload.new as CalendarEvent]);
          } else if (payload.eventType === "UPDATE") {
            setEvents((prev) =>
              prev.map((e) => (e.id === (payload.new as CalendarEvent).id ? (payload.new as CalendarEvent) : e))
            );
          } else if (payload.eventType === "DELETE") {
            setEvents((prev) => prev.filter((e) => e.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return {
    events,
    loading,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    googleConnected,
    googleEmail,
    checkingGoogle,
    connectGoogle,
    disconnectGoogle,
    pullFromGoogle,
  };
}
