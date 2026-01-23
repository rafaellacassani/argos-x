import { useState, useCallback } from 'react';
import { useEvolutionAPI } from './useEvolutionAPI';
import { useToast } from '@/hooks/use-toast';
import { BotNode } from './useSalesBots';
import { supabase } from '@/integrations/supabase/client';

export interface ExecutionStatus {
  nodeId: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  timestamp?: string;
}

export interface TestLead {
  id: string;
  name: string;
  phone: string;
  whatsapp_jid?: string;
  instance_name?: string;
}

export function useBotExecution() {
  const [executionStatuses, setExecutionStatuses] = useState<Record<string, ExecutionStatus>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const { sendText, listInstances } = useEvolutionAPI();
  const { toast } = useToast();

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // If starts with +, remove it (already removed by replace above)
    // Brazilian numbers: should be 55 + DDD + number
    if (digits.length === 11 && digits.startsWith('9')) {
      // Mobile number without country code (e.g., 99999999999)
      return `55${digits}`;
    }
    if (digits.length === 10) {
      // Landline without country code
      return `55${digits}`;
    }
    if (digits.length === 13 && digits.startsWith('55')) {
      // Already formatted with country code
      return digits;
    }
    if (digits.length === 12 && digits.startsWith('55')) {
      // Landline with country code
      return digits;
    }
    return digits;
  };

  const validatePhoneNumber = (phone: string): { valid: boolean; formatted: string; error?: string } => {
    if (!phone || phone.trim() === '') {
      return { valid: false, formatted: '', error: 'Número de telefone não informado' };
    }

    const formatted = formatPhoneNumber(phone);
    
    if (formatted.length < 10 || formatted.length > 15) {
      return { valid: false, formatted, error: 'Número de telefone inválido' };
    }

    return { valid: true, formatted };
  };

  const updateNodeStatus = useCallback((nodeId: string, status: ExecutionStatus) => {
    setExecutionStatuses(prev => ({
      ...prev,
      [nodeId]: status,
    }));
  }, []);

  const clearNodeStatus = useCallback((nodeId: string) => {
    setExecutionStatuses(prev => {
      const newStatuses = { ...prev };
      delete newStatuses[nodeId];
      return newStatuses;
    });
  }, []);

  const clearAllStatuses = useCallback(() => {
    setExecutionStatuses({});
  }, []);

  const executeSendMessageNode = useCallback(async (
    node: BotNode,
    lead: TestLead,
    options: {
      instanceName: string;
      forceWithoutConversation?: boolean;
    }
  ): Promise<ExecutionStatus> => {
    const nodeId = node.id;
    const message = (node.data.message as string) || '';
    const { instanceName, forceWithoutConversation } = options;

    // Mark as running
    const runningStatus: ExecutionStatus = {
      nodeId,
      status: 'running',
      message: 'Enviando mensagem...',
      timestamp: new Date().toISOString(),
    };
    updateNodeStatus(nodeId, runningStatus);

    try {
      // Validate message
      if (!message.trim()) {
        throw new Error('Mensagem vazia');
      }

      // Validate instance
      if (!instanceName) {
        throw new Error('Nenhuma instância WhatsApp selecionada');
      }

      // Validate phone number
      const phoneValidation = validatePhoneNumber(lead.phone);
      if (!phoneValidation.valid) {
        throw new Error(phoneValidation.error);
      }

      // Check if lead has previous conversation (whatsapp_jid)
      if (!lead.whatsapp_jid && !forceWithoutConversation) {
        throw new Error('Lead nunca conversou. Marque "Tentar enviar mesmo se nunca conversou" para forçar.');
      }

      // Send message via Evolution API
      const success = await sendText(instanceName, phoneValidation.formatted, message);

      if (!success) {
        throw new Error('Falha ao enviar mensagem via API');
      }

      const successStatus: ExecutionStatus = {
        nodeId,
        status: 'success',
        message: 'Mensagem enviada com sucesso',
        timestamp: new Date().toISOString(),
      };
      updateNodeStatus(nodeId, successStatus);
      
      toast({
        title: '✅ Mensagem enviada',
        description: `Mensagem enviada com sucesso para ${lead.name}`,
      });
      
      return successStatus;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorStatus: ExecutionStatus = {
        nodeId,
        status: 'error',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      };
      updateNodeStatus(nodeId, errorStatus);
      
      toast({
        title: '❌ Erro ao enviar',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return errorStatus;
    }
  }, [sendText, updateNodeStatus]);

  const fetchTestLeads = useCallback(async (): Promise<TestLead[]> => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, whatsapp_jid, instance_name')
        .limit(20)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching test leads:', error);
      return [];
    }
  }, []);

  const testNodeExecution = useCallback(async (
    node: BotNode,
    leadId: string,
    instanceName: string,
    forceWithoutConversation: boolean
  ): Promise<ExecutionStatus> => {
    setIsExecuting(true);
    try {
      // Fetch the lead data
      const { data: lead, error } = await supabase
        .from('leads')
        .select('id, name, phone, whatsapp_jid, instance_name')
        .eq('id', leadId)
        .single();

      if (error || !lead) {
        throw new Error('Lead não encontrado');
      }

      if (node.type === 'send_message') {
        return await executeSendMessageNode(node, lead, {
          instanceName,
          forceWithoutConversation,
        });
      }

      throw new Error(`Tipo de bloco "${node.type}" não suportado para execução`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorStatus: ExecutionStatus = {
        nodeId: node.id,
        status: 'error',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      };
      updateNodeStatus(node.id, errorStatus);
      return errorStatus;
    } finally {
      setIsExecuting(false);
    }
  }, [executeSendMessageNode, updateNodeStatus]);

  return {
    executionStatuses,
    isExecuting,
    updateNodeStatus,
    clearNodeStatus,
    clearAllStatuses,
    executeSendMessageNode,
    fetchTestLeads,
    testNodeExecution,
    validatePhoneNumber,
    listInstances,
  };
}
