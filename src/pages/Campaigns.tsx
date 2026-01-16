import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Send,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Calendar,
  Paperclip,
  Play,
  Pause,
  Copy,
  Trash2,
  Eye,
  Edit,
  Filter,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "running" | "completed" | "paused";
  type: "whatsapp" | "email";
  recipients: number;
  sent: number;
  delivered: number;
  read: number;
  responded: number;
  scheduledAt?: string;
  createdAt: string;
}

const campaigns: Campaign[] = [
  { id: "1", name: "Promoção de Janeiro", status: "running", type: "whatsapp", recipients: 500, sent: 324, delivered: 318, read: 245, responded: 42, createdAt: "15/01/2026" },
  { id: "2", name: "Follow-up Leads Quentes", status: "scheduled", type: "whatsapp", recipients: 150, sent: 0, delivered: 0, read: 0, responded: 0, scheduledAt: "17/01/2026 10:00", createdAt: "14/01/2026" },
  { id: "3", name: "Reengajamento Inativos", status: "completed", type: "whatsapp", recipients: 800, sent: 800, delivered: 756, read: 523, responded: 89, createdAt: "10/01/2026" },
  { id: "4", name: "Novidades do Produto", status: "draft", type: "whatsapp", recipients: 0, sent: 0, delivered: 0, read: 0, responded: 0, createdAt: "16/01/2026" },
  { id: "5", name: "Black Friday Antecipada", status: "paused", type: "whatsapp", recipients: 1200, sent: 456, delivered: 442, read: 298, responded: 67, createdAt: "08/01/2026" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "running":
      return "bg-success/10 text-success border-success/20";
    case "scheduled":
      return "bg-secondary/10 text-secondary border-secondary/20";
    case "completed":
      return "bg-primary/10 text-primary border-primary/20";
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    case "paused":
      return "bg-warning/10 text-warning border-warning/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "running":
      return "Em execução";
    case "scheduled":
      return "Agendada";
    case "completed":
      return "Concluída";
    case "draft":
      return "Rascunho";
    case "paused":
      return "Pausada";
    default:
      return status;
  }
};

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState("all");

  const filteredCampaigns =
    activeTab === "all"
      ? campaigns
      : campaigns.filter((c) => c.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground">Gerencie suas campanhas de WhatsApp em massa</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Campanhas Ativas", value: campaigns.filter((c) => c.status === "running").length, icon: Play, color: "text-success" },
          { label: "Agendadas", value: campaigns.filter((c) => c.status === "scheduled").length, icon: Clock, color: "text-secondary" },
          { label: "Total Enviadas", value: campaigns.reduce((sum, c) => sum + c.sent, 0).toLocaleString(), icon: Send, color: "text-primary" },
          { label: "Taxa de Resposta", value: "12.4%", icon: Users, color: "text-warning" },
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
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar campanha..." className="pl-10 w-60" />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.map((campaign, index) => {
          const progress = campaign.recipients > 0 ? (campaign.sent / campaign.recipients) * 100 : 0;
          const deliveryRate = campaign.sent > 0 ? ((campaign.delivered / campaign.sent) * 100).toFixed(1) : 0;
          const readRate = campaign.delivered > 0 ? ((campaign.read / campaign.delivered) * 100).toFixed(1) : 0;
          const responseRate = campaign.read > 0 ? ((campaign.responded / campaign.read) * 100).toFixed(1) : 0;

          return (
            <motion.div
              key={campaign.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="inboxia-card p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Campaign Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-lg">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Criada em {campaign.createdAt}
                        {campaign.scheduledAt && ` · Agendada para ${campaign.scheduledAt}`}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {campaign.status !== "draft" && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">
                          {campaign.sent.toLocaleString()} de {campaign.recipients.toLocaleString()} enviadas
                        </span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}

                  {/* Stats Grid */}
                  {campaign.status !== "draft" && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-semibold">{campaign.sent.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Enviadas</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-semibold text-success">{deliveryRate}%</p>
                        <p className="text-xs text-muted-foreground">Entregues</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-semibold text-secondary">{readRate}%</p>
                        <p className="text-xs text-muted-foreground">Lidas</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-semibold text-primary">{responseRate}%</p>
                        <p className="text-xs text-muted-foreground">Respondidas</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 lg:flex-col">
                  {campaign.status === "running" && (
                    <Button variant="outline" size="sm" className="gap-2">
                      <Pause className="w-4 h-4" />
                      Pausar
                    </Button>
                  )}
                  {campaign.status === "paused" && (
                    <Button size="sm" className="gap-2">
                      <Play className="w-4 h-4" />
                      Retomar
                    </Button>
                  )}
                  {campaign.status === "draft" && (
                    <Button size="sm" className="gap-2">
                      <Send className="w-4 h-4" />
                      Enviar
                    </Button>
                  )}
                  {campaign.status === "scheduled" && (
                    <Button variant="outline" size="sm" className="gap-2">
                      <Edit className="w-4 h-4" />
                      Editar
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredCampaigns.length === 0 && (
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
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </motion.div>
      )}
    </div>
  );
}
