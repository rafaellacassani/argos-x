import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEvolutionAPI } from './useEvolutionAPI';
import type { BotNode, BotEdge, BotFlowData } from './useSalesBots';

export interface ExecutionLog {
  bot_id: string;
  lead_id: string;
  node_id: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message?: string;
}

export interface FlowExecutionResult {
  success: boolean;
  nodesExecuted: number;
  errors: string[];
}

export function useBotFlowExecution() {
  const { sendText } = useEvolutionAPI();

  const logExecution = useCallback(async (log: ExecutionLog) => {
    const { error } = await supabase
      .from('bot_execution_logs')
      .insert({
        bot_id: log.bot_id,
        lead_id: log.lead_id,
        node_id: log.node_id,
        status: log.status,
        message: log.message
      });
    
    if (error) {
      console.error('[BotFlow] Failed to log execution:', error);
    }
  }, []);

  const findStartNode = useCallback((nodes: BotNode[], edges: BotEdge[]): BotNode | null => {
    // Start node = node that is NOT a target of any edge
    const targetIds = new Set(edges.map(e => e.target));
    const startNode = nodes.find(n => !targetIds.has(n.id));
    return startNode || nodes[0] || null;
  }, []);

  const getNextNode = useCallback((currentNodeId: string, nodes: BotNode[], edges: BotEdge[]): BotNode | null => {
    const edge = edges.find(e => e.source === currentNodeId);
    if (!edge) return null;
    return nodes.find(n => n.id === edge.target) || null;
  }, []);

  const executeNode = useCallback(async (
    node: BotNode,
    lead: { id: string; phone: string; whatsapp_jid?: string | null; instance_name?: string | null },
    botId: string
  ): Promise<{ success: boolean; message: string }> => {
    console.log(`[BotFlow] Executing node: ${node.type} (${node.id})`);

    switch (node.type) {
      case 'send_message': {
        const messageText = node.data?.message as string;
        if (!messageText) {
          return { success: false, message: 'Mensagem não configurada no bloco' };
        }

        // Determine phone number - prefer whatsapp_jid
        let targetNumber = lead.whatsapp_jid || lead.phone;
        if (!targetNumber) {
          return { success: false, message: 'Lead sem telefone ou WhatsApp JID' };
        }

        // Clean phone number if not a JID
        if (!targetNumber.includes('@')) {
          targetNumber = targetNumber.replace(/\D/g, '');
          if (targetNumber.length < 10) {
            return { success: false, message: 'Número de telefone inválido' };
          }
        }

        // Get instance name
        const instanceName = lead.instance_name;
        if (!instanceName) {
          return { success: false, message: 'Lead sem instância WhatsApp vinculada' };
        }

        // Send message via Evolution API
        const sent = await sendText(instanceName, targetNumber, messageText);
        return {
          success: sent,
          message: sent ? 'Mensagem enviada com sucesso' : 'Falha ao enviar mensagem'
        };
      }

      case 'condition':
        console.log(`[BotFlow] Condition block - placeholder (passing through)`);
        return { success: true, message: 'Condição avaliada (placeholder)' };

      case 'wait':
        console.log(`[BotFlow] Wait block - skipping delay in execution`);
        return { success: true, message: 'Delay ignorado na execução automática' };

      case 'tag': {
        const action = node.data?.action as 'add' | 'remove';
        const tagId = node.data?.tag_id as string;
        
        if (!tagId) {
          return { success: false, message: 'Tag não configurada no bloco' };
        }
        
        if (action === 'add') {
          const { error } = await supabase
            .from('lead_tag_assignments')
            .insert({ lead_id: lead.id, tag_id: tagId });
          console.log(`[BotFlow] Tag ADD: ${tagId} -> Lead ${lead.id}`, error || 'OK');
          return { 
            success: !error, 
            message: error ? 'Falha ao aplicar tag' : 'Tag aplicada ao lead' 
          };
        } else if (action === 'remove') {
          const { error } = await supabase
            .from('lead_tag_assignments')
            .delete()
            .eq('lead_id', lead.id)
            .eq('tag_id', tagId);
          console.log(`[BotFlow] Tag REMOVE: ${tagId} -> Lead ${lead.id}`, error || 'OK');
          return { 
            success: !error, 
            message: error ? 'Falha ao remover tag' : 'Tag removida do lead' 
          };
        }
        return { success: false, message: 'Ação de tag inválida' };
      }

      case 'move_stage': {
        const targetStageId = node.data?.stage_id as string;
        
        if (!targetStageId) {
          return { success: false, message: 'Etapa não configurada no bloco' };
        }
        
        // Get current stage for history
        const { data: currentLead } = await supabase
          .from('leads')
          .select('stage_id')
          .eq('id', lead.id)
          .maybeSingle();
        
        const fromStageId = currentLead?.stage_id;
        
        // Update lead's stage
        const { error } = await supabase
          .from('leads')
          .update({ stage_id: targetStageId, position: 0 })
          .eq('id', lead.id);
        
        if (error) {
          return { success: false, message: 'Falha ao mover lead de etapa' };
        }
        
        // Record history
        await supabase.from('lead_history').insert({
          lead_id: lead.id,
          action: 'stage_changed',
          from_stage_id: fromStageId,
          to_stage_id: targetStageId,
          performed_by: 'SalesBot'
        });
        
        console.log(`[BotFlow] Move Stage: ${fromStageId} -> ${targetStageId}`);
        return { success: true, message: 'Lead movido para nova etapa' };
      }

      case 'webhook':
        console.log(`[BotFlow] Webhook block - placeholder`);
        return { success: true, message: 'Webhook executado (placeholder)' };

      default:
        console.log(`[BotFlow] Unknown block type: ${node.type}`);
        return { success: true, message: `Bloco ${node.type} não implementado` };
    }
  }, [sendText]);

  const executeFlow = useCallback(async (
    botId: string,
    leadId: string
  ): Promise<FlowExecutionResult> => {
    const result: FlowExecutionResult = {
      success: true,
      nodesExecuted: 0,
      errors: []
    };

    console.log(`[BotFlow] Starting flow execution - Bot: ${botId}, Lead: ${leadId}`);

    try {
      // Fetch bot flow data
      const { data: bot, error: botError } = await supabase
        .from('salesbots')
        .select('flow_data, is_active, name')
        .eq('id', botId)
        .maybeSingle();

      if (botError || !bot) {
        console.error('[BotFlow] Bot not found:', botError);
        result.success = false;
        result.errors.push('Bot não encontrado');
        return result;
      }

      if (!bot.is_active) {
        console.log('[BotFlow] Bot is inactive, skipping execution');
        return result;
      }

      // Parse flow data safely
      const rawFlowData = bot.flow_data as unknown;
      const flowData = rawFlowData as BotFlowData | null;
      const nodes = flowData?.nodes || [];
      const edges = flowData?.edges || [];

      if (nodes.length === 0) {
        console.log('[BotFlow] No nodes in flow');
        return result;
      }

      // Fetch lead data
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, phone, whatsapp_jid, instance_name')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !lead) {
        console.error('[BotFlow] Lead not found:', leadError);
        result.success = false;
        result.errors.push('Lead não encontrado');
        return result;
      }

      // Find start node and execute flow
      let currentNode = findStartNode(nodes, edges);
      
      while (currentNode) {
        // Log pending
        await logExecution({
          bot_id: botId,
          lead_id: leadId,
          node_id: currentNode.id,
          status: 'running'
        });

        // Execute node
        const execResult = await executeNode(currentNode, lead, botId);
        result.nodesExecuted++;

        // Log result
        await logExecution({
          bot_id: botId,
          lead_id: leadId,
          node_id: currentNode.id,
          status: execResult.success ? 'success' : 'error',
          message: execResult.message
        });

        if (!execResult.success) {
          result.success = false;
          result.errors.push(`${currentNode.type}: ${execResult.message}`);
          break; // Stop flow on error
        }

        // Get next node
        currentNode = getNextNode(currentNode.id, nodes, edges);
      }

      // Update bot executions count directly
      const { data: currentBot } = await supabase
        .from('salesbots')
        .select('executions_count')
        .eq('id', botId)
        .maybeSingle();
      
      if (currentBot) {
        await supabase
          .from('salesbots')
          .update({ executions_count: (currentBot.executions_count || 0) + 1 })
          .eq('id', botId);
      }

      console.log(`[BotFlow] Flow completed - Nodes executed: ${result.nodesExecuted}`);
      
    } catch (error) {
      console.error('[BotFlow] Unexpected error:', error);
      result.success = false;
      result.errors.push('Erro inesperado na execução');
    }

    return result;
  }, [findStartNode, getNextNode, executeNode, logExecution]);

  const getBotForStage = useCallback(async (stageId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('funnel_stages')
      .select('bot_id')
      .eq('id', stageId)
      .maybeSingle();

    if (error || !data?.bot_id) return null;
    return data.bot_id;
  }, []);

  const triggerBotForStage = useCallback(async (stageId: string, leadId: string): Promise<void> => {
    const botId = await getBotForStage(stageId);
    if (!botId) {
      console.log('[BotFlow] No bot linked to stage:', stageId);
      return;
    }

    console.log(`[BotFlow] Triggering bot ${botId} for lead ${leadId} on stage ${stageId}`);
    
    // Execute in background (don't await to not block UI)
    executeFlow(botId, leadId).then(result => {
      if (result.success) {
        console.log(`[BotFlow] ✓ Flow completed successfully (${result.nodesExecuted} nodes)`);
      } else {
        console.error('[BotFlow] ✗ Flow failed:', result.errors);
      }
    });
  }, [getBotForStage, executeFlow]);

  return {
    executeFlow,
    triggerBotForStage,
    getBotForStage,
    logExecution
  };
}
