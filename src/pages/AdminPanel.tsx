import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Play, Ban, Unlock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface WorkspaceRow {
  id: string;
  name: string;
  plan_type: string;
  trial_end: string | null;
  subscription_status: string;
  blocked_at: string | null;
  created_by: string;
  owner_email?: string;
}

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [trialDialog, setTrialDialog] = useState<{ open: boolean; workspaceId: string | null }>({
    open: false,
    workspaceId: null,
  });
  const [trialDays, setTrialDays] = useState("7");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    checkSuperAdmin();
  }, [user]);

  useEffect(() => {
    if (isSuperAdmin) fetchWorkspaces();
  }, [isSuperAdmin]);

  const checkSuperAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    // For now, any admin role = super admin access to this panel
    setIsSuperAdmin(!!(data && data.length > 0));
    setLoading(false);
  };

  const fetchWorkspaces = async () => {
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, plan_type, trial_end, subscription_status, blocked_at, created_by")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching workspaces:", error);
      return;
    }

    // Fetch owner emails
    const creatorIds = [...new Set((data || []).map((w) => w.created_by))];
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("user_id, email")
      .in("user_id", creatorIds);

    const emailMap = new Map(profiles?.map((p) => [p.user_id, p.email]) || []);

    setWorkspaces(
      (data || []).map((w) => ({
        ...w,
        owner_email: emailMap.get(w.created_by) || "—",
      }))
    );
  };

  const handleTrialManual = async () => {
    if (!trialDialog.workspaceId) return;
    setActionLoading(trialDialog.workspaceId);

    const days = parseInt(trialDays);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);

    const { error } = await supabase
      .from("workspaces")
      .update({
        plan_type: "trial_manual",
        trial_end: trialEnd.toISOString(),
        subscription_status: "trialing",
        blocked_at: null,
      })
      .eq("id", trialDialog.workspaceId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Trial ativado", description: `${days} dias de trial concedidos.` });
      fetchWorkspaces();
    }

    setTrialDialog({ open: false, workspaceId: null });
    setActionLoading(null);
  };

  const handleBlock = async (id: string) => {
    setActionLoading(id);
    await supabase
      .from("workspaces")
      .update({ blocked_at: new Date().toISOString(), plan_type: "blocked" })
      .eq("id", id);
    toast({ title: "Workspace bloqueado" });
    fetchWorkspaces();
    setActionLoading(null);
  };

  const handleUnblock = async (id: string) => {
    setActionLoading(id);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    await supabase
      .from("workspaces")
      .update({
        blocked_at: null,
        plan_type: "trial_manual",
        trial_end: trialEnd.toISOString(),
      })
      .eq("id", id);
    toast({ title: "Workspace desbloqueado", description: "7 dias de trial concedidos." });
    fetchWorkspaces();
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const getPlanBadge = (planType: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      trial_manual: "secondary",
      past_due: "destructive",
      canceled: "destructive",
      blocked: "destructive",
    };
    return (
      <Badge variant={variants[planType] || "outline"}>
        {planType}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Painel Administrativo</h1>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Email do dono</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Trial até</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspaces.map((ws) => (
              <TableRow key={ws.id}>
                <TableCell className="font-medium">{ws.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {ws.owner_email}
                </TableCell>
                <TableCell>{getPlanBadge(ws.plan_type)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ws.trial_end ? format(new Date(ws.trial_end), "dd/MM/yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={ws.blocked_at ? "destructive" : "outline"}>
                    {ws.blocked_at ? "Bloqueado" : ws.subscription_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTrialDialog({ open: true, workspaceId: ws.id })}
                    disabled={actionLoading === ws.id}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Trial
                  </Button>
                  {!ws.blocked_at ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBlock(ws.id)}
                      disabled={actionLoading === ws.id}
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      Bloquear
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnblock(ws.id)}
                      disabled={actionLoading === ws.id}
                    >
                      <Unlock className="w-3 h-3 mr-1" />
                      Desbloquear
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={trialDialog.open}
        onOpenChange={(open) => setTrialDialog({ open, workspaceId: open ? trialDialog.workspaceId : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ativar Trial Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="text-sm font-medium">Duração do trial</label>
            <Select value={trialDays} onValueChange={setTrialDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialDialog({ open: false, workspaceId: null })}>
              Cancelar
            </Button>
            <Button onClick={handleTrialManual} disabled={!!actionLoading}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
