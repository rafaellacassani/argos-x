import { useState } from "react";
import { Bot, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface TransferToAgentButtonProps {
  leadId?: string;
  currentAgentId?: string;
  chatPhone?: string;
}

export function TransferToAgentButton({ leadId, currentAgentId, chatPhone }: TransferToAgentButtonProps) {
  const { workspace } = useWorkspace();
  const [transferring, setTransferring] = useState(false);

  // Fetch ALL AI agents for this workspace (active or not, we show active ones)
  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ["ai-agents-transfer", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, instance_name, is_active, type, agent_role")
        .eq("workspace_id", workspace.id)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspace?.id,
  });

  // Find which agent is currently serving this lead (via agent_memories)
  const { data: currentAgent } = useQuery({
    queryKey: ["lead-current-agent", leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const { data } = await supabase
        .from("agent_memories")
        .select("agent_id, is_paused")
        .eq("lead_id", leadId)
        .eq("is_paused", false)
        .order("updated_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!leadId,
  });

  const sourceAgentId = currentAgentId || currentAgent?.agent_id;
  const availableAgents = (agents || []).filter(a => a.id !== sourceAgentId);

  const handleTransfer = async (targetAgentId: string, targetAgentName: string) => {
    if (!leadId && !chatPhone) {
      toast({ title: "Lead não encontrado", description: "Não foi possível identificar o contato deste chat.", variant: "destructive" });
      return;
    }

    setTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke("transfer-to-agent", {
        body: {
          lead_id: leadId,
          target_agent_id: targetAgentId,
          source_agent_id: sourceAgentId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Transferência realizada! ✅",
        description: `Lead transferido para ${targetAgentName}. ${data?.message_sent ? "Mensagem de apresentação enviada." : ""}`,
      });
    } catch (e: any) {
      console.error("Transfer error:", e);
      toast({
        title: "Erro na transferência",
        description: e.message || "Não foi possível transferir o lead.",
        variant: "destructive",
      });
    } finally {
      setTransferring(false);
    }
  };

  if (!availableAgents.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={transferring}
          title="Transferir para IA"
        >
          {transferring ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowRightLeft className="w-5 h-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Transferir para IA
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableAgents.map((agent) => (
          <DropdownMenuItem
            key={agent.id}
            onClick={() => handleTransfer(agent.id, agent.name)}
            className="cursor-pointer"
          >
            <Bot className="w-4 h-4 mr-2 text-primary" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{agent.name}</span>
              {agent.agent_role && (
                <span className="text-xs text-muted-foreground">{agent.agent_role}</span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
