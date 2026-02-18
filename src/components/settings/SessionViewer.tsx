import { useState, useEffect } from "react";
import { Monitor, Smartphone, Globe, MapPin, LogOut, Loader2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserSession {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_label: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

interface SessionViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
}

function getDeviceIcon(label: string | null) {
  if (!label) return Monitor;
  const lower = label.toLowerCase();
  if (lower.includes("ios") || lower.includes("android") || lower.includes("iphone")) {
    return Smartphone;
  }
  return Monitor;
}

export function SessionViewer({ open, onOpenChange, targetUserId, targetUserName }: SessionViewerProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState<UserSession | null>(null);
  const { toast } = useToast();

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("last_seen_at", { ascending: false });

    if (error) {
      console.error("Error fetching sessions:", error);
    } else {
      setSessions((data as UserSession[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && targetUserId) {
      fetchSessions();
    }
  }, [open, targetUserId]);

  const handleForceLogout = async (session: UserSession) => {
    setLoggingOut(session.id);
    try {
      const { data, error } = await supabase.functions.invoke("force-logout", {
        body: { session_id: session.id, target_user_id: session.user_id },
      });

      if (error) throw error;

      toast({
        title: "Sessão encerrada",
        description: `${targetUserName} foi deslogado com sucesso.`,
      });
      await fetchSessions();
    } catch (err) {
      console.error("Force logout error:", err);
      toast({
        title: "Erro",
        description: "Não foi possível encerrar a sessão.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(null);
      setConfirmLogout(null);
    }
  };

  const formatLocation = (session: UserSession) => {
    const parts = [session.city, session.region, session.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Localização desconhecida";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Sessões de {targetUserName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma sessão registrada</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {sessions.map((session) => {
                const DeviceIcon = getDeviceIcon(session.device_label);
                const isActive = session.is_active;

                return (
                  <div
                    key={session.id}
                    className={`p-3 rounded-lg border ${
                      isActive ? "border-border bg-card" : "border-muted bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isActive ? "bg-primary/10" : "bg-muted"}`}>
                          <DeviceIcon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {session.device_label || "Dispositivo desconhecido"}
                            </span>
                            {isActive ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/20 text-emerald-600 shrink-0">
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground shrink-0">
                                Encerrada
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{formatLocation(session)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>IP: {session.ip_address || "—"}</span>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(session.last_seen_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          disabled={loggingOut === session.id}
                          onClick={() => setConfirmLogout(session)}
                        >
                          {loggingOut === session.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmLogout} onOpenChange={(o) => !o && setConfirmLogout(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              {targetUserName} será deslogado do dispositivo "{confirmLogout?.device_label}".
              Ele precisará fazer login novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmLogout && handleForceLogout(confirmLogout)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Encerrar sessão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
