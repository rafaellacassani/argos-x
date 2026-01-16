import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  Settings,
  Play,
  Pause,
  MoreHorizontal,
  MessageCircle,
  Users,
  Clock,
  Zap,
  Brain,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Agent {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "training";
  conversations: number;
  successRate: number;
  avgResponseTime: string;
  lastActive: string;
}

const agents: Agent[] = [
  {
    id: "1",
    name: "Atendente Virtual",
    description: "Responde dúvidas frequentes e qualifica leads automaticamente",
    status: "active",
    conversations: 1247,
    successRate: 89,
    avgResponseTime: "2.3s",
    lastActive: "Agora",
  },
  {
    id: "2",
    name: "Qualificador de Leads",
    description: "Coleta informações e classifica leads por potencial",
    status: "active",
    conversations: 856,
    successRate: 94,
    avgResponseTime: "1.8s",
    lastActive: "5 min",
  },
  {
    id: "3",
    name: "Suporte Técnico",
    description: "Resolve problemas técnicos e direciona para equipe quando necessário",
    status: "paused",
    conversations: 432,
    successRate: 76,
    avgResponseTime: "4.1s",
    lastActive: "2h",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-success text-success-foreground";
    case "paused":
      return "bg-warning text-warning-foreground";
    case "training":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "active":
      return "Ativo";
    case "paused":
      return "Pausado";
    case "training":
      return "Treinando";
    default:
      return status;
  }
};

export default function AIAgents() {
  const [agentsList, setAgentsList] = useState(agents);

  const toggleAgent = (id: string) => {
    setAgentsList((prev) =>
      prev.map((agent) =>
        agent.id === id
          ? { ...agent, status: agent.status === "active" ? "paused" : "active" }
          : agent
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Agentes de IA</h1>
          <p className="text-muted-foreground">Crie e gerencie seus assistentes inteligentes</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Agente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inboxia-card p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">
              {agentsList.filter((a) => a.status === "active").length}
            </p>
            <p className="text-sm text-muted-foreground">Agentes Ativos</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inboxia-card p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">
              {agentsList.reduce((sum, a) => sum + a.conversations, 0).toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Conversas Totais</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inboxia-card p-5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold">
              {Math.round(agentsList.reduce((sum, a) => sum + a.successRate, 0) / agentsList.length)}%
            </p>
            <p className="text-sm text-muted-foreground">Taxa de Sucesso Média</p>
          </div>
        </motion.div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agentsList.map((agent, index) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className="inboxia-card p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-foreground">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{agent.description}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Treinar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <MessageCircle className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{agent.conversations.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Conversas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Users className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{agent.successRate}%</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="font-semibold">{agent.avgResponseTime}</p>
                <p className="text-xs text-muted-foreground">Resp. Média</p>
              </div>
            </div>

            {/* Success Rate Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Taxa de Sucesso</span>
                <span className="text-sm font-medium">{agent.successRate}%</span>
              </div>
              <Progress value={agent.successRate} className="h-2" />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                  {getStatusLabel(agent.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Última atividade: {agent.lastActive}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={agent.status === "active"}
                  onCheckedChange={() => toggleAgent(agent.id)}
                />
                <Button variant="ghost" size="sm">
                  {agent.status === "active" ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Create New Agent Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inboxia-card p-6 border-2 border-dashed flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:border-secondary transition-colors"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">
            Criar Novo Agente
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Configure um assistente de IA personalizado para atender e qualificar seus leads automaticamente
          </p>
        </motion.div>
      </div>
    </div>
  );
}
