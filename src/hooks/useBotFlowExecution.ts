import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEvolutionAPI } from './useEvolutionAPI';
import { useWorkspace } from './useWorkspace';
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
  const { workspaceId } = useWorkspace();

  const logExecution = useCallback(async (log: ExecutionLog) => {
    if (!workspaceId) return;
    const { error } = await supabase
      .from('bot_execution_logs')
      .insert({
        bot_id: log.bot_id,
        lead_id: log.lead_id,
        node_id: log.node_id,
        status: log.status,
        message: log.message,
        workspace_id: workspaceId
      });
    
    if (error) {
      console.error('[BotFlow] Failed to log execution:', error);
    }
  }, [workspaceId]);

  const findStartNode = useCallback((nodes: BotNode[], edges: BotEdge[]): BotNode | null => {
    const targetIds = new Set(edges.map(e => e.target));
    const startNode = nodes.find(n => !targetIds.has(n.id));
    return startNode || nodes[0] || null;
  }, []);

  const getNextNode = useCallback((currentNodeId: string, nodes: BotNode[], edges: BotEdge[], label?: string): BotNode | null => {
    let edge: BotEdge | undefined;
    if (label) {
      edge = edges.find(e => e.source === currentNodeId && e.label === label);
    }
    if (!edge) {
      edge = edges.find(e => e.source === currentNodeId);
    }
    if (!edge) return null;
    return nodes.find(n => n.id === edge.target) || null;
  }, []);

  const evaluateCondition = useCallback(async (
    node: BotNode,
    leadId: string
  ): Promise<{ result: boolean; message: string }> => {
    const field = node.data?.field as string;
    const operator = node.data?.operator as 'equals' | 'contains' | 'not_equals';
    const value = node.data?.value as string;

    if (!field || !operator || value === undefined) {
      return { result: false, message: 'Condição não configurada corretamente' };
    }

    const { data: lead } = await supabase
      .from('leads')
      .select('name, phone, stage_id')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead) {
      return { result: false, message: 'Lead não encontrado' };
    }

    let fieldValue: string | string[] = '';

    if (field === 'tags') {
      const { data: tagAssignments } = await supabase
        .from('lead_tag_assignments')
        .select('tag_id, lead_tags(name)')
        .eq('lead_id', leadId);

      const tagNames = tagAssignments?.map(t => 
        (t.lead_tags as { name: string } | null)?.name || ''
      ).filter(Boolean) || [];
      const tagIds = tagAssignments?.map(t => t.tag_id) || [];
      fieldValue = [...tagNames, ...tagIds];
    } else if (field === 'stage_id') {
      fieldValue = lead.stage_id || '';
    } else if (field === 'name') {
      fieldValue = lead.name || '';
    } else if (field === 'phone') {
      fieldValue = lead.phone || '';
    }

    let result = false;
    const normalizedValue = value.toLowerCase();

    if (Array.isArray(fieldValue)) {
      const normalizedArray = fieldValue.map(v => v.toLowerCase());
      switch (operator) {
        case 'equals': result = normalizedArray.includes(normalizedValue); break;
        case 'contains': result = normalizedArray.some(v => v.includes(normalizedValue)); break;
        case 'not_equals': result = !normalizedArray.includes(normalizedValue); break;
      }
    } else {
      const normalizedField = fieldValue.toLowerCase();
      switch (operator) {
        case 'equals': result = normalizedField === normalizedValue; break;
        case 'contains': result = normalizedField.includes(normalizedValue); break;
        case 'not_equals': result = normalizedField !== normalizedValue; break;
      }
    }

    return { result, message: `Condição avaliada: ${result ? 'verdadeiro' : 'falso'}` };
  }, []);

  const executeNode = useCallback(async (
    node: BotNode,
    lead: { id: string; phone: string; whatsapp_jid?: string | null; instance_name?: string | null },
    botId: string
  ): Promise<{ success: boolean; message: string; conditionResult?: boolean }> => {
    switch (node.type) {
      case 'send_message': {
        const messageText = node.data?.message as string;
        if (!messageText) return { success: false, message: 'Mensagem não configurada no bloco' };

        let targetNumber = lead.whatsapp_jid || lead.phone;
        if (!targetNumber) return { success: false, message: 'Lead sem telefone ou WhatsApp JID' };

        if (!targetNumber.includes('@')) {
          targetNumber = targetNumber.replace(/\D/g, '');
          if (targetNumber.length < 10) return { success: false, message: 'Número de telefone inválido' };
        }

        const instanceName = lead.instance_name;
        if (!instanceName) return { success: false, message: 'Lead sem instância WhatsApp vinculada' };

        const sent = await sendText(instanceName, targetNumber, messageText);
        return { success: sent, message: sent ? 'Mensagem enviada com sucesso' : 'Falha ao enviar mensagem' };
      }

      case 'condition': {
        const conditionEval = await evaluateCondition(node, lead.id);
        return { success: true, message: conditionEval.message, conditionResult: conditionEval.result };
      }

      case 'wait':
        return { success: true, message: 'Delay ignorado na execução automática' };

      case 'tag': {
        const action = node.data?.action as 'add' | 'remove';
        const tagId = node.data?.tag_id as string;
        if (!tagId) return { success: false, message: 'Tag não configurada no bloco' };
        
        if (action === 'add') {
          if (!workspaceId) return { success: false, message: 'Workspace não encontrado' };
          const { error } = await supabase
            .from('lead_tag_assignments')
            .insert({ lead_id: lead.id, tag_id: tagId, workspace_id: workspaceId });
          return { success: !error, message: error ? 'Falha ao aplicar tag' : 'Tag aplicada ao lead' };
        } else if (action === 'remove') {
          const { error } = await supabase
            .from('lead_tag_assignments')
            .delete()
            .eq('lead_id', lead.id)
            .eq('tag_id', tagId);
          return { success: !error, message: error ? 'Falha ao remover tag' : 'Tag removida do lead' };
        }
        return { success: false, message: 'Ação de tag inválida' };
      }

      case 'move_stage': {
        const targetStageId = node.data?.stage_id as string;
        if (!targetStageId) return { success: false, message: 'Etapa não configurada no bloco' };
        
        const { data: currentLead } = await supabase
          .from('leads')
          .select('stage_id')
          .eq('id', lead.id)
          .maybeSingle();
        
        const fromStageId = currentLead?.stage_id;
        
        const { error } = await supabase
          .from('leads')
          .update({ stage_id: targetStageId, position: 0 })
          .eq('id', lead.id);
        
        if (error) return { success: false, message: 'Falha ao mover lead de etapa' };
        
        if (workspaceId) {
          await supabase.from('lead_history').insert({
            lead_id: lead.id,
            action: 'stage_changed',
            from_stage_id: fromStageId,
            to_stage_id: targetStageId,
            performed_by: 'SalesBot',
            workspace_id: workspaceId
          });
        }
        
        return { success: true, message: 'Lead movido para nova etapa' };
      }

      case 'action':
      case 'webhook': {
        const webhookUrl = node.data?.url as string;
        const method = (node.data?.method as 'POST' | 'GET') || 'POST';

        if (!webhookUrl || !webhookUrl.startsWith('https://')) {
          return { success: false, message: 'URL inválida ou não configurada (requer https://)' };
        }

        const fullLeadData: Record<string, unknown> = {
          id: lead.id, phone: lead.phone, whatsapp_jid: lead.whatsapp_jid, instance_name: lead.instance_name
        };

        const { data: leadDetails } = await supabase
          .from('leads')
          .select('name, email, company, value, stage_id, source, notes')
          .eq('id', lead.id)
          .maybeSingle();

        if (leadDetails) Object.assign(fullLeadData, leadDetails);

        const { data: tagAssignments } = await supabase
          .from('lead_tag_assignments')
          .select('tag_id, lead_tags(name, color)')
          .eq('lead_id', lead.id);

        fullLeadData.tags = tagAssignments?.map(t => ({
          id: t.tag_id,
          name: (t.lead_tags as { name: string; color: string } | null)?.name,
          color: (t.lead_tags as { name: string; color: string } | null)?.color
        })) || [];

        const payloadFields = node.data?.payload_fields as string[] | undefined;
        let payload: Record<string, unknown> = fullLeadData;
        if (payloadFields && payloadFields.length > 0) {
          payload = {};
          for (const field of payloadFields) {
            if (field in fullLeadData) payload[field] = fullLeadData[field];
          }
        }

        payload.bot_id = botId;
        payload.executed_at = new Date().toISOString();

        try {
          const response = await fetch(webhookUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'POST' ? JSON.stringify(payload) : undefined
          });

          return response.ok 
            ? { success: true, message: `Webhook executado (${response.status})` }
            : { success: false, message: `Webhook falhou (${response.status})` };
        } catch (error) {
          return { success: false, message: `Erro ao chamar webhook: ${error instanceof Error ? error.message : 'Erro desconhecido'}` };
        }
      }

      default:
        return { success: true, message: `Bloco ${node.type} não implementado` };
    }
  }, [sendText, evaluateCondition, workspaceId]);

  const executeFlow = useCallback(async (
    botId: string,
    leadId: string
  ): Promise<FlowExecutionResult> => {
    const result: FlowExecutionResult = { success: true, nodesExecuted: 0, errors: [] };

    try {
      const { data: bot, error: botError } = await supabase
        .from('salesbots')
        .select('flow_data, is_active, name')
        .eq('id', botId)
        .maybeSingle();

      if (botError || !bot) { result.success = false; result.errors.push('Bot não encontrado'); return result; }
      if (!bot.is_active) return result;

      const rawFlowData = bot.flow_data as unknown;
      const flowData = rawFlowData as BotFlowData | null;
      const nodes = flowData?.nodes || [];
      const edges = flowData?.edges || [];

      if (nodes.length === 0) return result;

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, phone, whatsapp_jid, instance_name')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError || !lead) { result.success = false; result.errors.push('Lead não encontrado'); return result; }

      let currentNode = findStartNode(nodes, edges);
      
      while (currentNode) {
        await logExecution({ bot_id: botId, lead_id: leadId, node_id: currentNode.id, status: 'running' });

        const execResult = await executeNode(currentNode, lead, botId);
        result.nodesExecuted++;

        await logExecution({
          bot_id: botId, lead_id: leadId, node_id: currentNode.id,
          status: execResult.success ? 'success' : 'error', message: execResult.message
        });

        if (!execResult.success) { result.success = false; result.errors.push(`${currentNode.type}: ${execResult.message}`); break; }

        if (currentNode.type === 'condition' && execResult.conditionResult !== undefined) {
          currentNode = getNextNode(currentNode.id, nodes, edges, execResult.conditionResult ? 'true' : 'false');
        } else {
          currentNode = getNextNode(currentNode.id, nodes, edges);
        }
      }

      const { data: currentBot } = await supabase
        .from('salesbots')
        .select('executions_count')
        .eq('id', botId)
        .maybeSingle();
      
      if (currentBot) {
        await supabase.from('salesbots')
          .update({ executions_count: (currentBot.executions_count || 0) + 1 })
          .eq('id', botId);
      }
    } catch (error) {
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
    if (!botId) return;

    const { data: bot } = await supabase
      .from('salesbots')
      .select('is_active')
      .eq('id', botId)
      .maybeSingle();

    if (bot?.is_active) {
      await executeFlow(botId, leadId);
    }
  }, [getBotForStage, executeFlow]);

  return { executeFlow, triggerBotForStage, getBotForStage };
}
