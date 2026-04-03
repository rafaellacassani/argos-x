import { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Copy,
  CheckCircle2,
  Eye,
  KeyRound,
  Power,
  Wifi,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WABAConnectionCardProps {
  conn: any;
  index: number;
  workspaceId: string | null;
  onRefresh: () => void;
}

export function WABAConnectionCard({ conn, index, workspaceId, onRefresh }: WABAConnectionCardProps) {
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showEditTokenModal, setShowEditTokenModal] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/facebook-webhook`;

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
  };

  const handleUpdateToken = async () => {
    if (!newToken.trim()) return;
    setSaving(true);
    try {
      // Update whatsapp_cloud_connections
      await supabase
        .from("whatsapp_cloud_connections")
        .update({ access_token: newToken.trim() })
        .eq("id", conn.id);

      // Update meta_pages token
      if (conn.meta_page_id) {
        await supabase
          .from("meta_pages")
          .update({ page_access_token: newToken.trim() })
          .eq("id", conn.meta_page_id);
      }

      toast({ title: "Token atualizado!", description: "O token de acesso foi atualizado com sucesso." });
      setShowEditTokenModal(false);
      setNewToken("");
      onRefresh();
    } catch (err) {
      console.error("Error updating token:", err);
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await supabase
        .from("whatsapp_cloud_connections")
        .update({ is_active: false })
        .eq("id", conn.id);

      if (conn.meta_page_id) {
        await supabase
          .from("meta_pages")
          .update({ is_active: false })
          .eq("id", conn.meta_page_id);
      }

      // Audit log
      await supabase.from("connection_audit_log" as any).insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "deactivated",
        details: { inbox_name: conn.inbox_name },
      });

      toast({ title: "Conexão desativada", description: `"${conn.inbox_name}" foi desativada.` });
      setShowDeactivateDialog(false);
      onRefresh();
    } catch (err) {
      console.error("Error deactivating:", err);
      toast({ title: "Erro ao desativar", variant: "destructive" });
    }
  };

  const handleReactivate = async () => {
    try {
      await supabase
        .from("whatsapp_cloud_connections")
        .update({ is_active: true })
        .eq("id", conn.id);

      if (conn.meta_page_id) {
        await supabase
          .from("meta_pages")
          .update({ is_active: true })
          .eq("id", conn.meta_page_id);
      }

      // Audit log
      await supabase.from("connection_audit_log" as any).insert({
        connection_id: conn.id,
        workspace_id: workspaceId,
        event_type: "reactivated",
        details: { inbox_name: conn.inbox_name },
      });

      toast({ title: "Conexão reativada!", description: `"${conn.inbox_name}" está ativa novamente.` });
      onRefresh();
    } catch (err) {
      console.error("Error reactivating:", err);
      toast({ title: "Erro ao reativar", variant: "destructive" });
    }
  };

  const isActive = conn.status === "active";
  const isEnabled = conn.is_active !== false;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="inboxia-card p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? "bg-success/10" : "bg-yellow-500/10"}`}>
              <Phone className={`w-6 h-6 ${isActive ? "text-success" : "text-yellow-600"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{conn.inbox_name}</h3>
                <Badge variant="outline" className="text-xs">Cloud API</Badge>
                <Badge
                  variant="outline"
                  className={isActive ? "bg-success/10 text-success border-success/20" : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"}
                >
                  {isActive ? "Ativa" : "Pendente"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" />
                {conn.phone_number}
              </p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span>Criado em {format(new Date(conn.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                {conn.last_webhook_at && (
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    Último webhook: {format(new Date(conn.last_webhook_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditTokenModal(true)} title="Editar token de acesso">
              <KeyRound className="w-4 h-4 mr-1" /> Token
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWebhookModal(true)} title="Ver configuração do webhook">
              <Eye className="w-4 h-4 mr-1" /> Webhook
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeactivateDialog(true)}
              title="Desativar conexão"
            >
              <Power className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!isActive && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-600">
              Conexão pendente. Configure o webhook no Meta para ativá-la.
            </p>
          </div>
        )}
      </motion.div>

      {/* Webhook Modal */}
      <Dialog open={showWebhookModal} onOpenChange={setShowWebhookModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuração do Webhook</DialogTitle>
            <DialogDescription>
              Use estas informações para configurar o webhook no Meta Business
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">URL de Callback</label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(webhookUrl, "URL")}>
                  {copied === "URL" ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Token de Verificação</label>
              <div className="flex gap-2">
                <Input value={conn.webhook_verify_token || ""} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(conn.webhook_verify_token || "", "Token")}>
                  {copied === "Token" ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Token Modal */}
      <Dialog open={showEditTokenModal} onOpenChange={setShowEditTokenModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar Token de Acesso</DialogTitle>
            <DialogDescription>
              Cole o novo token permanente do Meta para "{conn.inbox_name}"
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Cole aqui o novo token do Meta..."
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditTokenModal(false); setNewToken(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateToken} disabled={!newToken.trim() || saving}>
              {saving ? "Salvando..." : "Atualizar Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar "{conn.inbox_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A conexão será desativada e não receberá mais mensagens. O histórico de conversas será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
