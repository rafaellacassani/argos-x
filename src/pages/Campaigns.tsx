import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Send,
  Clock,
  Users,
  Play,
  Pause,
  Copy,
  Trash2,
  Eye,
  Edit,
  Search,
  MoreHorizontal,
  Rocket,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useCampaigns, Campaign } from "@/hooks/useCampaigns";
import CreateCampaignDialog from "@/components/campaigns/CreateCampaignDialog";
import CampaignDetailDialog from "@/components/campaigns/CampaignDetailDialog";

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground border-border" },
  scheduled: { label: "Agendada", color: "bg-secondary/10 text-secondary border-secondary/20" },
  running: { label: "Em execução", color: "bg-success/10 text-success border-success/20" },
  paused: { label: "Pausada", color: "bg-warning/10 text-warning border-warning/20" },
  completed: { label: "Concluída", color: "bg-primary/10 text-primary border-primary/20" },
  canceled: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Campaigns() {
  const {
    campaigns,
    loading,
    pauseCampaign,
    resumeCampaign,
    startCampaign,
    cancelCampaign,
    deleteCampaign,
    duplicateCampaign,
  } = useCampaigns();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = campaigns.filter((c) => {
    if (activeTab !== "all" && c.status !== activeTab) return false;
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    running: campaigns.filter((c) => c.status === "running").length,
    scheduled: campaigns.filter((c) => c.status === "scheduled").length,
    totalSent: campaigns.reduce((sum, c) => sum + c.sent_count, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground">Gerencie suas campanhas de WhatsApp em massa</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Campanhas Ativas", value: stats.running, icon: Play, color: "text-success" },
          { label: "Agendadas", value: stats.scheduled, icon: Clock, color: "text-secondary" },
          { label: "Total Enviadas", value: stats.totalSent.toLocaleString(), icon: Send, color: "text-primary" },
          { label: "Taxa de Resposta", value: "—", icon: Users, color: "text-warning" },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="inboxia-card p-5 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="inboxia-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="running">Em Execução</TabsTrigger>
              <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
              <TabsTrigger value="draft">Rascunhos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar campanha..."
              className="pl-10 w-60"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="inboxia-card p-12 text-center">
          <p className="text-muted-foreground">Carregando campanhas...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((campaign, index) => {
            const progress = campaign.total_recipients > 0 ? (campaign.sent_count / campaign.total_recipients) * 100 : 0;
            const sc = statusConfig[campaign.status] || statusConfig.draft;

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="inboxia-card p-6"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Criada em {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                          {campaign.scheduled_at && ` · Agendada para ${new Date(campaign.scheduled_at).toLocaleString("pt-BR")}`}
                          {" · "}{campaign.instance_name}
                        </p>
                      </div>
                      <Badge className={`${sc.color} border`}>{sc.label}</Badge>
                    </div>

                    {campaign.status !== "draft" && campaign.total_recipients > 0 && (
                      <>
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">
                              {campaign.sent_count.toLocaleString()} de {campaign.total_recipients.toLocaleString()} enviadas
                            </span>
                            <span className="font-medium">{progress.toFixed(0)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-semibold">{campaign.sent_count.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Enviadas</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-semibold text-destructive">{campaign.failed_count}</p>
                            <p className="text-xs text-muted-foreground">Falhas</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-lg font-semibold text-success">
                              {campaign.sent_count > 0
                                ? ((campaign.sent_count / campaign.total_recipients) * 100).toFixed(1) + "%"
                                : "0%"}
                            </p>
                            <p className="text-xs text-muted-foreground">Taxa</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 lg:flex-col">
                    {campaign.status === "draft" && (
                      <Button size="sm" className="gap-2" onClick={() => startCampaign(campaign.id)}>
                        <Rocket className="w-4 h-4" /> Iniciar
                      </Button>
                    )}
                    {campaign.status === "running" && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => pauseCampaign(campaign.id)}>
                        <Pause className="w-4 h-4" /> Pausar
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button size="sm" className="gap-2" onClick={() => resumeCampaign(campaign.id)}>
                        <Play className="w-4 h-4" /> Retomar
                      </Button>
                    )}
                    {campaign.status === "scheduled" && (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => cancelCampaign(campaign.id)}>
                        <XCircle className="w-4 h-4" /> Cancelar
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailCampaign(campaign)}>
                          <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateCampaign(campaign)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(campaign.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="inboxia-card p-12 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
            <Send className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg mb-2">Nenhuma campanha encontrada</h3>
          <p className="text-muted-foreground mb-4">Crie sua primeira campanha de WhatsApp em massa</p>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </motion.div>
      )}

      {/* Dialogs */}
      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />

      {detailCampaign && (
        <CampaignDetailDialog
          open={!!detailCampaign}
          onOpenChange={(v) => { if (!v) setDetailCampaign(null); }}
          campaign={detailCampaign}
        />
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todos os destinatários e dados desta campanha serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirm) deleteCampaign(deleteConfirm); setDeleteConfirm(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
