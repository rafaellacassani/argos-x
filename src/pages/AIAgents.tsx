import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Plus, MessageCircle, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIAgents, useAgentStats, AIAgent } from "@/hooks/useAIAgents";
import { AgentCard } from "@/components/agents/AgentCard";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";
import { AgentDetailDialog } from "@/components/agents/AgentDetailDialog";
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

export default function AIAgents() {
  const { agents, isLoading, createAgent, updateAgent, deleteAgent, toggleAgent } = useAIAgents();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);

  const activeAgents = agents.filter((a) => a.is_active).length;
  const totalConversations = 0; // Will be calculated from executions
  const avgSuccessRate = agents.length > 0 ? 85 : 0; // Placeholder

  const handleToggle = (id: string, is_active: boolean) => {
    toggleAgent.mutate({ id, is_active });
  };

  const handleEdit = (agent: AIAgent) => {
    setSelectedAgent(agent);
  };

  const handleDelete = (id: string) => {
    setAgentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (agentToDelete) {
      deleteAgent.mutate(agentToDelete);
      setAgentToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Agentes de IA
          </h1>
          <p className="text-muted-foreground">
            Crie e gerencie seus assistentes inteligentes
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
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
            <p className="text-2xl font-display font-bold">{activeAgents}</p>
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
              {totalConversations.toLocaleString()}
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
            <p className="text-2xl font-display font-bold">{avgSuccessRate}%</p>
            <p className="text-sm text-muted-foreground">Taxa de Sucesso Média</p>
          </div>
        </motion.div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map((agent, index) => (
          <AgentCardWithStats
            key={agent.id}
            agent={agent}
            index={index}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ))}

        {/* Create New Agent Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => setCreateDialogOpen(true)}
          className="inboxia-card p-6 border-2 border-dashed flex flex-col items-center justify-center text-center min-h-[300px] cursor-pointer hover:border-secondary transition-colors"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">
            Criar Novo Agente
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Configure um assistente de IA personalizado para atender e qualificar
            seus leads automaticamente
          </p>
        </motion.div>
      </div>

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={(data) => {
          createAgent.mutate(data);
          setCreateDialogOpen(false);
        }}
        isLoading={createAgent.isPending}
      />

      {/* Agent Detail Dialog */}
      <AgentDetailDialog
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => { if (!open) setSelectedAgent(null); }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agente e todo seu histórico de
              conversas serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wrapper component that fetches stats for each agent
function AgentCardWithStats({
  agent,
  index,
  onToggle,
  onEdit,
  onDelete,
}: {
  agent: any;
  index: number;
  onToggle: (id: string, is_active: boolean) => void;
  onEdit: (agent: any) => void;
  onDelete: (id: string) => void;
}) {
  const { data: stats } = useAgentStats(agent.id);

  return (
    <AgentCard
      agent={agent}
      stats={stats}
      index={index}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}
