import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';
import { useWorkspace } from '@/hooks/useWorkspace';

export interface BotNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface BotEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface BotFlowData {
  nodes: BotNode[];
  edges: BotEdge[];
}

export interface SalesBot {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  flow_data: BotFlowData;
  is_active: boolean;
  executions_count: number;
  conversions_count: number;
  created_at: string;
  updated_at: string;
  template_name?: string | null;
}

function parseFlowData(data: Json | null): BotFlowData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { nodes: [], edges: [] };
  }
  const obj = data as Record<string, Json>;
  return {
    nodes: Array.isArray(obj.nodes) ? (obj.nodes as unknown as BotNode[]) : [],
    edges: Array.isArray(obj.edges) ? (obj.edges as unknown as BotEdge[]) : [],
  };
}

function parseTriggerConfig(data: Json | null): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  return data as Record<string, unknown>;
}

export function useSalesBots() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();

  const fetchBots = useCallback(async (): Promise<SalesBot[]> => {
    if (!workspaceId) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salesbots')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(bot => ({
        ...bot,
        trigger_config: parseTriggerConfig(bot.trigger_config),
        flow_data: parseFlowData(bot.flow_data),
      }));
    } catch (error) {
      console.error('Error fetching bots:', error);
      toast({
        title: 'Erro ao carregar bots',
        description: 'Não foi possível carregar a lista de bots.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast, workspaceId]);

  const fetchBot = useCallback(async (id: string): Promise<SalesBot | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salesbots')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        trigger_config: parseTriggerConfig(data.trigger_config),
        flow_data: parseFlowData(data.flow_data),
      };
    } catch (error) {
      console.error('Error fetching bot:', error);
      toast({
        title: 'Erro ao carregar bot',
        description: 'Não foi possível carregar os dados do bot.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createBot = useCallback(async (bot: Partial<SalesBot> & { template_name?: string }): Promise<SalesBot | null> => {
    if (!workspaceId) return null;
    setLoading(true);
    try {
      const flowData = bot.flow_data || { nodes: [], edges: [] };
      const triggerConfig = bot.trigger_config || {};
      
      const insertData: Record<string, unknown> = {
        name: bot.name || 'Novo Bot',
        description: bot.description || null,
        trigger_type: bot.trigger_type || 'message_received',
        trigger_config: triggerConfig as Json,
        flow_data: flowData as unknown as Json,
        is_active: bot.is_active || false,
        workspace_id: workspaceId,
      };
      if (bot.template_name) {
        insertData.template_name = bot.template_name;
      }

      const { data, error } = await supabase
        .from('salesbots')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Bot criado',
        description: 'O bot foi criado com sucesso.',
      });

      return {
        ...data,
        trigger_config: parseTriggerConfig(data.trigger_config),
        flow_data: parseFlowData(data.flow_data),
      };
    } catch (error) {
      console.error('Error creating bot:', error);
      toast({
        title: 'Erro ao criar bot',
        description: 'Não foi possível criar o bot.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const updateBot = useCallback(async (id: string, updates: Partial<SalesBot>): Promise<boolean> => {
    setLoading(true);
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
      if (updates.trigger_config !== undefined) updateData.trigger_config = updates.trigger_config as Json;
      if (updates.flow_data !== undefined) updateData.flow_data = updates.flow_data as unknown as Json;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      const { error } = await supabase
        .from('salesbots')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Bot atualizado',
        description: 'As alterações foram salvas.',
      });

      return true;
    } catch (error) {
      console.error('Error updating bot:', error);
      toast({
        title: 'Erro ao atualizar bot',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const deleteBot = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('salesbots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Bot excluído',
        description: 'O bot foi excluído com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Error deleting bot:', error);
      toast({
        title: 'Erro ao excluir bot',
        description: 'Não foi possível excluir o bot.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const duplicateBot = useCallback(async (id: string): Promise<SalesBot | null> => {
    const bot = await fetchBot(id);
    if (!bot) return null;

    return createBot({
      name: `${bot.name} (cópia)`,
      description: bot.description,
      trigger_type: bot.trigger_type,
      trigger_config: bot.trigger_config,
      flow_data: bot.flow_data,
      is_active: false,
    });
  }, [fetchBot, createBot]);

  const toggleBotActive = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('salesbots')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: isActive ? 'Bot ativado' : 'Bot desativado',
        description: isActive 
          ? 'O bot está ativo e processando mensagens.'
          : 'O bot foi pausado.',
      });

      return true;
    } catch (error) {
      console.error('Error toggling bot:', error);
      return false;
    }
  }, [toast]);

  return {
    loading,
    fetchBots,
    fetchBot,
    createBot,
    updateBot,
    deleteBot,
    duplicateBot,
    toggleBotActive,
  };
}
