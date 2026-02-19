import { motion } from "framer-motion";
import {
  Brain,
  MessageCircle,
  Users,
  Clock,
  MoreHorizontal,
  Settings,
  Sparkles,
  Play,
  Pause,
  Trash2,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AIAgent } from "@/hooks/useAIAgents";

interface AgentCardProps {
  agent: AIAgent;
  stats?: {
    total_executions: number;
    success_rate: number;
    avg_latency_ms: number;
  };
  index: number;
  onToggle: (id: string, is_active: boolean) => void;
  onEdit: (agent: AIAgent) => void;
  onDelete: (id: string) => void;
}

const agentTypeLabels: Record<string, string> = {
  sdr: "SDR / Pré-qualificação",
  support: "Suporte Técnico",
  scheduler: "Agendamento",
  collector: "Cobrança",
  followup: "Follow-up",
  custom: "Personalizado",
};

const agentTypeColors: Record<string, string> = {
  sdr: "from-emerald-500 to-teal-600",
  support: "from-blue-500 to-indigo-600",
  scheduler: "from-purple-500 to-violet-600",
  collector: "from-orange-500 to-red-600",
  followup: "from-pink-500 to-rose-600",
  custom: "from-gray-500 to-slate-600",
};

export function AgentCard({ 
  agent, 
  stats, 
  index, 
  onToggle, 
  onEdit, 
  onDelete 
}: AgentCardProps) {
  const typeLabel = agentTypeLabels[agent.type] || agent.type;
  const gradientClass = agentTypeColors[agent.type] || agentTypeColors.custom;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 * index }}
      className="inboxia-card p-6 cursor-pointer"
      onClick={() => onEdit(agent)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
            <Brain className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground">
              {agent.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {agent.description || typeLabel}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(agent)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(agent)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Sparkles className="w-4 h-4 mr-2" />
              Testar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => onDelete(agent.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <MessageCircle className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <p className="font-semibold">
            {stats?.total_executions?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-muted-foreground">Conversas</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <p className="font-semibold">{stats?.success_rate || 0}%</p>
          <p className="text-xs text-muted-foreground">Sucesso</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <p className="font-semibold">
            {stats?.avg_latency_ms ? `${(stats.avg_latency_ms / 1000).toFixed(1)}s` : "0s"}
          </p>
          <p className="text-xs text-muted-foreground">Resp. Média</p>
        </div>
      </div>

      {/* Success Rate Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
          <span className="text-sm font-medium">{stats?.success_rate || 0}%</span>
        </div>
        <Progress value={stats?.success_rate || 0} className="h-2" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              agent.is_active
                ? "bg-success/10 text-success"
                : "bg-warning/10 text-warning"
            }`}
          >
            {agent.is_active ? "Ativo" : "Pausado"}
          </span>
          <span className="text-xs text-muted-foreground">
            {agent.model?.split("/")[1] || "gemini"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={agent.is_active}
            onCheckedChange={(checked) => onToggle(agent.id, checked)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(agent.id, !agent.is_active)}
          >
            {agent.is_active ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
