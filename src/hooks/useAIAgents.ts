import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  type: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  trigger_config: Record<string, any>;
  fallback_config: Record<string, any>;
  pause_code: string;
  resume_keyword: string;
  message_split_enabled: boolean;
  message_split_length: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  lead_id: string | null;
  session_id: string;
  input_message: string;
  output_message: string | null;
  tools_used: string[];
  tokens_used: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  executed_at: string;
}

export interface CreateAgentData {
  name: string;
  description?: string;
  type: string;
  system_prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: string[];
  pause_code?: string;
  resume_keyword?: string;
  message_split_enabled?: boolean;
  message_split_length?: number;
}

export function useAIAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AIAgent[];
    }
  });

  const createAgent = useMutation({
    mutationFn: async (agentData: CreateAgentData) => {
      if (!workspaceId) throw new Error("Workspace não encontrado");
      const { data, error } = await supabase
        .from("ai_agents")
        .insert({
          name: agentData.name,
          description: agentData.description || null,
          type: agentData.type,
          system_prompt: agentData.system_prompt,
          model: agentData.model || "google/gemini-3-flash-preview",
          temperature: agentData.temperature || 0.7,
          max_tokens: agentData.max_tokens || 2048,
          tools: agentData.tools || [],
          pause_code: agentData.pause_code || "251213",
          resume_keyword: agentData.resume_keyword || "Atendimento finalizado",
          message_split_enabled: agentData.message_split_enabled ?? true,
          message_split_length: agentData.message_split_length || 400,
          workspace_id: workspaceId
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({
        title: "Agente criado",
        description: "O agente de IA foi criado com sucesso."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar agente",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateAgent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIAgent> & { id: string }) => {
      const { data, error } = await supabase
        .from("ai_agents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({
        title: "Agente atualizado",
        description: "As alterações foram salvas."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_agents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({
        title: "Agente excluído",
        description: "O agente foi removido."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const toggleAgent = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("ai_agents")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast({
        title: data.is_active ? "Agente ativado" : "Agente pausado",
        description: data.is_active 
          ? "O agente está pronto para atender." 
          : "O agente foi pausado."
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    agents,
    isLoading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgent
  };
}

export function useAgentExecutions(agentId?: string) {
  return useQuery({
    queryKey: ["agent-executions", agentId],
    queryFn: async () => {
      let query = supabase
        .from("agent_executions")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(100);

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AgentExecution[];
    },
    enabled: true
  });
}

export function useAgentStats(agentId: string) {
  return useQuery({
    queryKey: ["agent-stats", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_executions")
        .select("status, tokens_used, latency_ms")
        .eq("agent_id", agentId);

      if (error) throw error;

      const total = data.length;
      const successful = data.filter(e => e.status === "success").length;
      const avgLatency = data.reduce((sum, e) => sum + (e.latency_ms || 0), 0) / (total || 1);
      const totalTokens = data.reduce((sum, e) => sum + (e.tokens_used || 0), 0);

      return {
        total_executions: total,
        success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
        avg_latency_ms: Math.round(avgLatency),
        total_tokens: totalTokens
      };
    },
    enabled: !!agentId
  });
}
