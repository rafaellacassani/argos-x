import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Campaign, CampaignRecipient, useCampaigns } from "@/hooks/useCampaigns";
import { Download, Send, CheckCircle2, XCircle, Clock, Users, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  scheduled: { label: "Agendada", color: "bg-secondary/10 text-secondary" },
  running: { label: "Em execução", color: "bg-success/10 text-success" },
  paused: { label: "Pausada", color: "bg-warning/10 text-warning" },
  completed: { label: "Concluída", color: "bg-primary/10 text-primary" },
  canceled: { label: "Cancelada", color: "bg-destructive/10 text-destructive" },
};

const recipientStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "text-muted-foreground" },
  sent: { label: "Enviado", color: "text-success" },
  failed: { label: "Falhou", color: "text-destructive" },
  skipped: { label: "Ignorado", color: "text-warning" },
};

export default function CampaignDetailDialog({ open, onOpenChange, campaign }: Props) {
  const { fetchRecipients } = useCampaigns();
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open && campaign.id) {
      loadRecipients();
    }
  }, [open, campaign.id]);

  const loadRecipients = async () => {
    setLoading(true);
    const data = await fetchRecipients(campaign.id);
    setRecipients(data);
    setLoading(false);
  };

  const filteredRecipients = recipients.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (r.lead?.name || "").toLowerCase().includes(s) ||
        r.phone.includes(s)
      );
    }
    return true;
  });

  const pending = campaign.total_recipients - campaign.sent_count - campaign.failed_count;
  const progress = campaign.total_recipients > 0 ? (campaign.sent_count / campaign.total_recipients) * 100 : 0;
  const sc = statusConfig[campaign.status] || statusConfig.draft;

  const exportCSV = () => {
    const headers = ["Nome", "Telefone", "Status", "Enviado em", "Erro"];
    const rows = filteredRecipients.map((r) => [
      r.lead?.name || "",
      r.phone,
      recipientStatusConfig[r.status]?.label || r.status,
      r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "",
      r.error_message || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanha-${campaign.name}-destinatarios.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-display text-xl">{campaign.name}</DialogTitle>
            <Badge className={sc.color}>{sc.label}</Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="recipients">Destinatários ({campaign.total_recipients})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: campaign.total_recipients, icon: Users, color: "text-foreground" },
                { label: "Enviadas", value: campaign.sent_count, icon: Send, color: "text-success" },
                { label: "Falhas", value: campaign.failed_count, icon: XCircle, color: "text-destructive" },
                { label: "Pendentes", value: Math.max(0, pending), icon: Clock, color: "text-muted-foreground" },
              ].map((m) => (
                <div key={m.label} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <p className={`text-2xl font-display font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{campaign.sent_count} de {campaign.total_recipients} enviadas</span>
                <span className="font-medium">{progress.toFixed(0)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            {/* Config */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Instância</p>
                <p className="font-medium">{campaign.instance_name}</p>
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Intervalo</p>
                <p className="font-medium">{campaign.interval_seconds}s entre mensagens</p>
              </div>
              {campaign.schedule_start_time && (
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Janela de envio</p>
                  <p className="font-medium">{campaign.schedule_start_time} — {campaign.schedule_end_time}</p>
                </div>
              )}
              {campaign.scheduled_at && (
                <div className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Agendada para</p>
                  <p className="font-medium">{new Date(campaign.scheduled_at).toLocaleString("pt-BR")}</p>
                </div>
              )}
            </div>

            {/* Message preview */}
            <div>
              <p className="text-sm font-medium mb-2">Mensagem</p>
              <div className="p-4 rounded-lg bg-[#dcf8c6] text-[#111] text-sm whitespace-pre-wrap max-w-md border">
                {campaign.message_text}
              </div>
              {campaign.attachment_url && (
                <div className="mt-2 p-2 rounded border inline-flex items-center gap-2 text-sm">
                  📎 Anexo: <a href={campaign.attachment_url} target="_blank" rel="noreferrer" className="text-secondary underline">Ver arquivo</a>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="recipients" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="skipped">Ignorados</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">Telefone</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Enviado em</th>
                      <th className="text-left p-3 font-medium">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipients.slice(0, 100).map((r) => {
                      const rs = recipientStatusConfig[r.status] || recipientStatusConfig.pending;
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="p-3">{r.lead?.name || "—"}</td>
                          <td className="p-3 font-mono text-xs">{r.phone}</td>
                          <td className="p-3">
                            <span className={`font-medium ${rs.color}`}>{rs.label}</span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {r.sent_at ? new Date(r.sent_at).toLocaleString("pt-BR") : "—"}
                          </td>
                          <td className="p-3 text-xs text-destructive truncate max-w-[200px]">{r.error_message || ""}</td>
                        </tr>
                      );
                    })}
                    {filteredRecipients.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum destinatário encontrado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredRecipients.length > 100 && (
                  <p className="p-3 text-sm text-muted-foreground text-center border-t">
                    Mostrando 100 de {filteredRecipients.length} destinatários. Exporte o CSV para ver todos.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
