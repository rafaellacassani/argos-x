import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BotFlowData } from './useSalesBots';
import { useWorkspace } from './useWorkspace';

// Helper function to execute bot flow (standalone to avoid hook rules)
async function executeBotFlow(botId: string, leadId: string) {
  try {
    console.log(`[BotFlow] Starting execution - Bot: ${botId}, Lead: ${leadId}`);
    
    // Fetch bot
    const { data: bot } = await supabase
      .from('salesbots')
      .select('flow_data, is_active, name, workspace_id')
      .eq('id', botId)
      .maybeSingle();

    if (!bot?.is_active) return;
    const wsId = bot.workspace_id;

    const flowData = bot.flow_data as unknown as BotFlowData | null;
    const nodes = flowData?.nodes || [];
    const edges = flowData?.edges || [];

    if (nodes.length === 0) return;

    // Fetch lead
    const { data: lead } = await supabase
      .from('leads')
      .select('id, phone, whatsapp_jid, instance_name')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead) return;

    // Find start node (no incoming edges)
    const targetIds = new Set(edges.map(e => e.target));
    let currentNode = nodes.find(n => !targetIds.has(n.id)) || nodes[0];

    while (currentNode) {
      // Log execution
      await supabase.from('bot_execution_logs').insert({
        bot_id: botId,
        lead_id: leadId,
        node_id: currentNode.id,
        status: 'running',
        workspace_id: wsId
      });

      let success = true;
      let message = '';

      // Execute node based on type
      if (currentNode.type === 'send_message') {
        const messageText = currentNode.data?.message as string;
        if (messageText && lead.instance_name) {
          const targetNumber = lead.whatsapp_jid || lead.phone?.replace(/\D/g, '');
          if (targetNumber) {
            const { error } = await supabase.functions.invoke('evolution-api', {
              body: {
                action: 'send-text',
                instanceName: lead.instance_name,
                data: { number: targetNumber, text: messageText }
              }
            });
            success = !error;
            message = success ? 'Mensagem enviada' : 'Falha ao enviar';
          } else {
            success = false;
            message = 'Sem número válido';
          }
        } else {
          success = false;
          message = messageText ? 'Sem instância WhatsApp' : 'Mensagem não configurada';
        }
      } else if (currentNode.type === 'tag') {
        const action = currentNode.data?.action as 'add' | 'remove';
        const tagId = currentNode.data?.tag_id as string;
        
        if (!tagId) {
          success = false;
          message = 'Tag não configurada no bloco';
        } else if (action === 'add') {
          const { error } = await supabase
            .from('lead_tag_assignments')
            .upsert({ lead_id: leadId, tag_id: tagId, workspace_id: wsId }, { onConflict: 'lead_id,tag_id' });
          success = !error;
          message = success ? 'Tag aplicada ao lead' : 'Falha ao aplicar tag';
        } else if (action === 'remove') {
          const { error } = await supabase
            .from('lead_tag_assignments')
            .delete()
            .eq('lead_id', leadId)
            .eq('tag_id', tagId);
          success = !error;
          message = success ? 'Tag removida do lead' : 'Falha ao remover tag';
        } else {
          success = false;
          message = 'Ação de tag inválida (deve ser add ou remove)';
        }
      } else if (currentNode.type === 'move_stage') {
        const targetStageId = currentNode.data?.stage_id as string;
        
        if (!targetStageId) {
          success = false;
          message = 'Etapa não configurada no bloco';
        } else {
          const { data: currentLeadData } = await supabase
            .from('leads')
            .select('stage_id')
            .eq('id', leadId)
            .maybeSingle();
          
          const fromStageId = currentLeadData?.stage_id;
          
          const { error } = await supabase
            .from('leads')
            .update({ stage_id: targetStageId, position: 0 })
            .eq('id', leadId);
          
          if (error) {
            success = false;
            message = 'Falha ao mover lead de etapa';
          } else {
            await supabase.from('lead_history').insert({
              lead_id: leadId,
              action: 'stage_changed',
              from_stage_id: fromStageId,
              to_stage_id: targetStageId,
              performed_by: 'SalesBot',
              workspace_id: wsId
            });
            success = true;
            message = 'Lead movido para nova etapa';
          }
        }
      } else {
        message = `Bloco ${currentNode.type} executado (placeholder)`;
      }

      // Update log with result
      await supabase.from('bot_execution_logs').insert({
        bot_id: botId,
        lead_id: leadId,
        node_id: currentNode.id,
        status: success ? 'success' : 'error',
        message,
        workspace_id: wsId
      });

      if (!success) break;

      const edge = edges.find(e => e.source === currentNode!.id);
      currentNode = edge ? nodes.find(n => n.id === edge.target) : undefined;
    }

    // Increment executions count
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
  } catch (err) {
    console.error('[BotFlow] Execution error:', err);
  }
}

export interface LeadSale {
  id: string;
  lead_id: string;
  product_name: string;
  value: number;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  company?: string;
  value: number;
  status: 'active' | 'won' | 'lost' | 'archived';
  stage_id: string;
  source: string;
  whatsapp_jid?: string;
  instance_name?: string;
  responsible_user?: string;
  notes?: string;
  position: number;
  created_at: string;
  updated_at: string;
  tags?: LeadTag[];
  sales?: LeadSale[];
  total_sales_value?: number;
  sales_count?: number;
}

export interface Funnel {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages?: FunnelStage[];
}

export interface FunnelStage {
  id: string;
  funnel_id: string;
  name: string;
  color: string;
  position: number;
  is_win_stage: boolean;
  is_loss_stage: boolean;
  bot_id?: string | null;
  created_at: string;
  updated_at: string;
  leads?: Lead[];
}

export interface LeadTag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  action: string;
  from_stage_id?: string;
  to_stage_id?: string;
  performed_by?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  from_stage?: FunnelStage;
  to_stage?: FunnelStage;
}

export function useLeads() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [currentFunnel, setCurrentFunnel] = useState<Funnel | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tags, setTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { workspaceId } = useWorkspace();

  // Fetch all funnels
  const fetchFunnels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFunnels(data || []);
      
      const defaultFunnel = data?.find(f => f.is_default) || data?.[0];
      if (defaultFunnel && !currentFunnel) {
        setCurrentFunnel(defaultFunnel);
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching funnels:', err);
      setError('Erro ao carregar funis');
      return [];
    }
  }, [currentFunnel]);

  // Fetch stages for current funnel
  const fetchStages = useCallback(async (funnelId: string) => {
    try {
      const { data, error } = await supabase
        .from('funnel_stages')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('position', { ascending: true });

      if (error) throw error;
      setStages(data || []);
      return data;
    } catch (err) {
      console.error('Error fetching stages:', err);
      setError('Erro ao carregar estágios');
      return [];
    }
  }, []);

  // Fetch leads for current funnel with optional server-side filters
  const fetchLeads = useCallback(async (stageIds: string[], filters?: {
    responsibleUserIds?: string[];
    tagIds?: string[];
    valueMin?: number | null;
    valueMax?: number | null;
    product?: string;
    dateFrom?: string | null;
    dateTo?: string | null;
    dateType?: 'created_at' | 'sale_date';
    sources?: string[];
    unassigned?: boolean;
  }) => {
    if (stageIds.length === 0) return [];
    
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .in('stage_id', stageIds)
        .order('position', { ascending: true });

      // Apply server-side filters
      if (filters) {
        if (filters.unassigned) {
          query = query.is('responsible_user', null);
        } else if (filters.responsibleUserIds && filters.responsibleUserIds.length > 0) {
          query = query.in('responsible_user', filters.responsibleUserIds);
        }
        if (filters.valueMin !== null && filters.valueMin !== undefined) {
          query = query.gte('value', filters.valueMin);
        }
        if (filters.valueMax !== null && filters.valueMax !== undefined) {
          query = query.lte('value', filters.valueMax);
        }
        if (filters.sources && filters.sources.length > 0) {
          query = query.in('source', filters.sources);
        }
        if (filters.dateType === 'created_at' || !filters.dateType) {
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let leadIds = (data || []).map(l => l.id);
      
      const [tagAssignments, salesData] = await Promise.all([
        leadIds.length > 0
          ? supabase.from('lead_tag_assignments').select('lead_id, tag_id, lead_tags(*)').in('lead_id', leadIds)
          : Promise.resolve({ data: [] as any[] }),
        leadIds.length > 0
          ? supabase.from('lead_sales').select('*').in('lead_id', leadIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      let leadsWithData = (data || []).map(lead => {
        const leadTags = (tagAssignments.data || [])
          .filter(t => t.lead_id === lead.id)
          .map(t => t.lead_tags)
          .filter(Boolean);
        
        const leadSales = (salesData.data || []).filter(s => s.lead_id === lead.id);
        const totalSalesValue = leadSales.reduce((sum, s) => sum + Number(s.value || 0), 0);

        return {
          ...lead,
          tags: leadTags,
          sales: leadSales as LeadSale[],
          total_sales_value: totalSalesValue,
          sales_count: leadSales.length
        };
      });

      // Client-side filters that require joined data
      if (filters?.tagIds && filters.tagIds.length > 0) {
        leadsWithData = leadsWithData.filter(lead =>
          (lead.tags || []).some((t: any) => filters.tagIds!.includes(t.id))
        );
      }
      if (filters?.product && filters.product.trim()) {
        const search = filters.product.trim().toLowerCase();
        leadsWithData = leadsWithData.filter(lead =>
          (lead.sales || []).some((s: any) => s.product_name?.toLowerCase().includes(search))
        );
      }
      // Sale date filter (needs sales data)
      if (filters?.dateType === 'sale_date') {
        if (filters.dateFrom || filters.dateTo) {
          leadsWithData = leadsWithData.filter(lead => {
            return (lead.sales || []).some((s: any) => {
              const sd = s.sale_date;
              if (!sd) return false;
              if (filters.dateFrom && sd < filters.dateFrom) return false;
              if (filters.dateTo && sd > filters.dateTo) return false;
              return true;
            });
          });
        }
      }
      
      setLeads(leadsWithData as Lead[]);
      return leadsWithData;
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Erro ao carregar leads');
      return [];
    }
  }, []);

  // Fetch all tags
  const fetchTags = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('lead_tags')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTags(data || []);
      return data;
    } catch (err) {
      console.error('Error fetching tags:', err);
      return [];
    }
  }, []);

  // Create a new tag
  const createTag = useCallback(async (name: string, color: string): Promise<LeadTag | null> => {
    if (!workspaceId) return null;
    try {
      const { data, error } = await supabase
        .from('lead_tags')
        .insert({ name, color, workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      
      setTags(prev => [...prev, data]);
      toast.success('Tag criada com sucesso!');
      return data as LeadTag;
    } catch (err) {
      console.error('Error creating tag:', err);
      toast.error('Erro ao criar tag');
      return null;
    }
  }, [workspaceId]);

  // Update a tag
  const updateTag = useCallback(async (tagId: string, updates: { name?: string; color?: string }): Promise<LeadTag | null> => {
    try {
      const { data, error } = await supabase
        .from('lead_tags')
        .update(updates)
        .eq('id', tagId)
        .select()
        .single();

      if (error) throw error;
      
      setTags(prev => prev.map(t => t.id === tagId ? { ...t, ...data } : t));
      toast.success('Tag atualizada!');
      return data as LeadTag;
    } catch (err) {
      console.error('Error updating tag:', err);
      toast.error('Erro ao atualizar tag');
      return null;
    }
  }, []);

  // Delete a tag
  const deleteTag = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      await supabase
        .from('lead_tag_assignments')
        .delete()
        .eq('tag_id', tagId);

      const { error } = await supabase
        .from('lead_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
      
      setTags(prev => prev.filter(t => t.id !== tagId));
      toast.success('Tag removida!');
      return true;
    } catch (err) {
      console.error('Error deleting tag:', err);
      toast.error('Erro ao remover tag');
      return false;
    }
  }, []);

  // Get tag usage count
  const getTagUsageCount = useCallback(async (tagId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('lead_tag_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tagId);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('Error getting tag usage count:', err);
      return 0;
    }
  }, []);

  // Get all tags with usage counts
  const getTagsWithCounts = useCallback(async (): Promise<Array<LeadTag & { usageCount: number }>> => {
    try {
      const { data: tagsData, error: tagsError } = await supabase
        .from('lead_tags')
        .select('*')
        .order('name', { ascending: true });

      if (tagsError) throw tagsError;

      const { data: countsData, error: countsError } = await supabase
        .from('lead_tag_assignments')
        .select('tag_id');

      if (countsError) throw countsError;

      const countMap = new Map<string, number>();
      (countsData || []).forEach(item => {
        countMap.set(item.tag_id, (countMap.get(item.tag_id) || 0) + 1);
      });

      return (tagsData || []).map(tag => ({
        ...tag,
        usageCount: countMap.get(tag.id) || 0
      }));
    } catch (err) {
      console.error('Error fetching tags with counts:', err);
      return [];
    }
  }, []);

  // Create a new lead
  const createLead = useCallback(async (leadData: Partial<Lead>) => {
    if (!workspaceId) return null;
    try {
      let stageId = leadData.stage_id;
      if (!stageId && currentFunnel) {
        const { data: firstStage } = await supabase
          .from('funnel_stages')
          .select('id')
          .eq('funnel_id', currentFunnel.id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        stageId = firstStage?.id;
      }

      if (!stageId) {
        throw new Error('Nenhum estágio encontrado');
      }

      const { data: maxPosData } = await supabase
        .from('leads')
        .select('position')
        .eq('stage_id', stageId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const newPosition = (maxPosData?.position || 0) + 1;

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: leadData.name || 'Novo Lead',
          phone: leadData.phone || '',
          email: leadData.email,
          avatar_url: leadData.avatar_url,
          company: leadData.company,
          value: leadData.value || 0,
          stage_id: stageId,
          source: leadData.source || 'manual',
          whatsapp_jid: leadData.whatsapp_jid,
          instance_name: leadData.instance_name,
          responsible_user: leadData.responsible_user,
          notes: leadData.notes,
          position: newPosition,
          workspace_id: workspaceId
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('lead_history').insert({
        lead_id: data.id,
        action: 'created',
        to_stage_id: stageId,
        metadata: { source: leadData.source || 'manual' },
        workspace_id: workspaceId
      });

      if (leadData.source === 'whatsapp') {
        const { data: whatsappTag } = await supabase
          .from('lead_tags')
          .select('id')
          .eq('name', 'WhatsApp')
          .maybeSingle();
        
        if (whatsappTag) {
          await supabase.from('lead_tag_assignments').insert({
            lead_id: data.id,
            tag_id: whatsappTag.id,
            workspace_id: workspaceId
          });
        }
      }

      setLeads(prev => [...prev, { ...data, tags: [] }]);
      toast.success('Lead criado com sucesso!');
      return data;
    } catch (err) {
      console.error('Error creating lead:', err);
      toast.error('Erro ao criar lead');
      return null;
    }
  }, [currentFunnel, workspaceId]);

  // Update a lead
  const updateLead = useCallback(async (leadId: string, updates: Partial<Lead>) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;

      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...data } : l));
      toast.success('Lead atualizado!');
      return data;
    } catch (err) {
      console.error('Error updating lead:', err);
      toast.error('Erro ao atualizar lead');
      return null;
    }
  }, []);

  // Move lead to different stage
  const moveLead = useCallback(async (
    leadId: string, 
    newStageId: string, 
    newPosition: number,
    performedBy?: string
  ) => {
    try {
      const currentLead = leads.find(l => l.id === leadId);
      const oldStageId = currentLead?.stage_id;

      if (oldStageId && oldStageId !== newStageId) {
        const leadsInOldStage = leads
          .filter(l => l.stage_id === oldStageId && l.id !== leadId)
          .map((l, idx) => ({ ...l, position: idx }));
        
        for (const lead of leadsInOldStage) {
          await supabase
            .from('leads')
            .update({ position: lead.position })
            .eq('id', lead.id);
        }
      }

      const { data, error } = await supabase
        .from('leads')
        .update({ stage_id: newStageId, position: newPosition })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;

      if (oldStageId && oldStageId !== newStageId && workspaceId) {
        await supabase.from('lead_history').insert({
          lead_id: leadId,
          action: 'stage_changed',
          from_stage_id: oldStageId,
          to_stage_id: newStageId,
          performed_by: performedBy,
          workspace_id: workspaceId
        });

        const { data: stageData } = await supabase
          .from('funnel_stages')
          .select('bot_id')
          .eq('id', newStageId)
          .maybeSingle();

        if (stageData?.bot_id) {
          const { data: botData } = await supabase
            .from('salesbots')
            .select('is_active')
            .eq('id', stageData.bot_id)
            .maybeSingle();

          if (botData?.is_active) {
            executeBotFlow(stageData.bot_id!, leadId);
          }
        }
      }

      setLeads(prev => prev.map(l => 
        l.id === leadId 
          ? { ...l, stage_id: newStageId, position: newPosition }
          : l
      ));

      return data;
    } catch (err) {
      console.error('Error moving lead:', err);
      toast.error('Erro ao mover lead');
      return null;
    }
  }, [leads, workspaceId]);

  // Delete a lead
  const deleteLead = useCallback(async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast.success('Lead removido!');
      return true;
    } catch (err) {
      console.error('Error deleting lead:', err);
      toast.error('Erro ao remover lead');
      return false;
    }
  }, []);

  // Get lead history
  const getLeadHistory = useCallback(async (leadId: string): Promise<LeadHistory[]> => {
    try {
      const { data, error } = await supabase
        .from('lead_history')
        .select(`
          *,
          from_stage:funnel_stages!lead_history_from_stage_id_fkey(*),
          to_stage:funnel_stages!lead_history_to_stage_id_fkey(*)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as LeadHistory[];
    } catch (err) {
      console.error('Error fetching lead history:', err);
      return [];
    }
  }, []);

  // Add tag to lead
  const addTagToLead = useCallback(async (leadId: string, tagId: string) => {
    if (!workspaceId) return false;
    try {
      const { error } = await supabase
        .from('lead_tag_assignments')
        .insert({ lead_id: leadId, tag_id: tagId, workspace_id: workspaceId });

      if (error) throw error;

      const tag = tags.find(t => t.id === tagId);
      if (tag) {
        setLeads(prev => prev.map(l => 
          l.id === leadId 
            ? { ...l, tags: [...(l.tags || []), tag] }
            : l
        ));
      }
      return true;
    } catch (err) {
      console.error('Error adding tag:', err);
      return false;
    }
  }, [tags, workspaceId]);

  // Remove tag from lead
  const removeTagFromLead = useCallback(async (leadId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('lead_tag_assignments')
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;

      setLeads(prev => prev.map(l => 
        l.id === leadId 
          ? { ...l, tags: l.tags?.filter(t => t.id !== tagId) || [] }
          : l
      ));
      return true;
    } catch (err) {
      console.error('Error removing tag:', err);
      return false;
    }
  }, []);

  // Sales CRUD functions
  const addSale = useCallback(async (leadId: string, productName: string, value: number): Promise<LeadSale | null> => {
    if (!workspaceId) return null;
    try {
      const { data, error } = await supabase
        .from('lead_sales')
        .insert({ lead_id: leadId, product_name: productName, value, workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      
      setLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          const newSales = [...(l.sales || []), data as LeadSale];
          return {
            ...l,
            sales: newSales,
            total_sales_value: newSales.reduce((sum, s) => sum + Number(s.value), 0),
            sales_count: newSales.length
          };
        }
        return l;
      }));
      
      return data as LeadSale;
    } catch (err) {
      console.error('Error adding sale:', err);
      toast.error('Erro ao adicionar venda');
      return null;
    }
  }, [workspaceId]);

  const updateSale = useCallback(async (saleId: string, updates: { product_name?: string; value?: number }): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('lead_sales')
        .update(updates)
        .eq('id', saleId)
        .select()
        .single();

      if (error) throw error;
      
      setLeads(prev => prev.map(l => {
        const saleIndex = l.sales?.findIndex(s => s.id === saleId);
        if (saleIndex !== undefined && saleIndex >= 0 && l.sales) {
          const newSales = [...l.sales];
          newSales[saleIndex] = { ...newSales[saleIndex], ...data };
          return {
            ...l,
            sales: newSales,
            total_sales_value: newSales.reduce((sum, s) => sum + Number(s.value), 0)
          };
        }
        return l;
      }));
      
      return true;
    } catch (err) {
      console.error('Error updating sale:', err);
      toast.error('Erro ao atualizar venda');
      return false;
    }
  }, []);

  const deleteSale = useCallback(async (saleId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('lead_sales')
        .delete()
        .eq('id', saleId);

      if (error) throw error;
      
      setLeads(prev => prev.map(l => {
        if (l.sales?.some(s => s.id === saleId)) {
          const newSales = l.sales.filter(s => s.id !== saleId);
          return {
            ...l,
            sales: newSales,
            total_sales_value: newSales.reduce((sum, s) => sum + Number(s.value), 0),
            sales_count: newSales.length
          };
        }
        return l;
      }));
      
      return true;
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast.error('Erro ao remover venda');
      return false;
    }
  }, []);

  const saveSales = useCallback(async (
    leadId: string, 
    sales: Array<{ id?: string; product_name: string; value: number }>,
    originalSales: LeadSale[]
  ): Promise<boolean> => {
    if (!workspaceId) return false;
    try {
      const currentIds = new Set(sales.filter(s => s.id).map(s => s.id));
      const deletedSales = originalSales.filter(s => !currentIds.has(s.id));
      const newSales = sales.filter(s => !s.id && s.product_name.trim());
      const updatedSales = sales.filter(s => s.id && s.product_name.trim());

      for (const sale of deletedSales) {
        await supabase.from('lead_sales').delete().eq('id', sale.id);
      }

      if (newSales.length > 0) {
        await supabase.from('lead_sales').insert(
          newSales.map(s => ({ lead_id: leadId, product_name: s.product_name, value: s.value, workspace_id: workspaceId }))
        );
      }

      for (const sale of updatedSales) {
        const original = originalSales.find(o => o.id === sale.id);
        if (original && (original.product_name !== sale.product_name || original.value !== sale.value)) {
          await supabase
            .from('lead_sales')
            .update({ product_name: sale.product_name, value: sale.value })
            .eq('id', sale.id);
        }
      }

      return true;
    } catch (err) {
      console.error('Error saving sales:', err);
      toast.error('Erro ao salvar vendas');
      return false;
    }
  }, [workspaceId]);

  // Check if lead exists for a WhatsApp JID
  const findLeadByWhatsAppJid = useCallback(async (jid: string): Promise<Lead | null> => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('whatsapp_jid', jid)
        .maybeSingle();

      if (error) throw error;
      return data as Lead | null;
    } catch (err) {
      console.error('Error finding lead:', err);
      return null;
    }
  }, []);

  // Create funnel
  const createFunnel = useCallback(async (name: string, description?: string) => {
    if (!workspaceId) return null;
    try {
      const { data: funnel, error: funnelError } = await supabase
        .from('funnels')
        .insert({ name, description, workspace_id: workspaceId })
        .select()
        .single();

      if (funnelError) throw funnelError;

      const defaultStages = [
        { name: 'Leads de Entrada', color: '#6B7280', position: 0 },
        { name: 'Em Qualificação', color: '#0171C3', position: 1 },
        { name: 'Lixo', color: '#EF4444', position: 2, is_loss_stage: true },
        { name: 'Reunião Agendada', color: '#F59E0B', position: 3 },
        { name: 'Venda Realizada', color: '#22C55E', position: 4, is_win_stage: true },
        { name: 'No Show', color: '#8B5CF6', position: 5 },
      ];

      for (const stage of defaultStages) {
        await supabase.from('funnel_stages').insert({
          funnel_id: funnel.id,
          ...stage,
          workspace_id: workspaceId
        });
      }

      setFunnels(prev => [...prev, funnel]);
      toast.success('Funil criado com sucesso!');
      return funnel;
    } catch (err) {
      console.error('Error creating funnel:', err);
      toast.error('Erro ao criar funil');
      return null;
    }
  }, [workspaceId]);

  // Update stage
  const updateStage = useCallback(async (stageId: string, updates: Partial<FunnelStage>) => {
    try {
      const { data, error } = await supabase
        .from('funnel_stages')
        .update(updates)
        .eq('id', stageId)
        .select()
        .single();

      if (error) throw error;

      setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...data } : s));
      return data;
    } catch (err) {
      console.error('Error updating stage:', err);
      toast.error('Erro ao atualizar fase');
      return null;
    }
  }, []);

  // Get statistics
  const getStatistics = useCallback(() => {
    const stats = stages.map(stage => {
      const stageLeads = leads.filter(l => l.stage_id === stage.id);
      const totalValue = stageLeads.reduce((sum, l) => sum + (l.value || 0), 0);
      return { stage, count: stageLeads.length, totalValue };
    });

    const totalLeads = leads.length;
    const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
    const wonLeads = leads.filter(l => 
      stages.find(s => s.id === l.stage_id)?.is_win_stage
    ).length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    return { byStage: stats, totalLeads, totalValue, wonLeads, conversionRate };
  }, [stages, leads]);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFunnels();
      await fetchTags();
      setLoading(false);
    };
    loadData();
  }, [fetchFunnels, fetchTags]);

  // Fetch stages and leads when funnel changes
  useEffect(() => {
    if (currentFunnel) {
      const loadFunnelData = async () => {
        const stageData = await fetchStages(currentFunnel.id);
        if (stageData && stageData.length > 0) {
          await fetchLeads(stageData.map(s => s.id));
        }
      };
      loadFunnelData();
    }
  }, [currentFunnel, fetchStages, fetchLeads]);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead;
            if (stages.some(s => s.id === newLead.stage_id)) {
              setLeads(prev => [...prev, { ...newLead, tags: [] }]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => 
              l.id === payload.new.id ? { ...l, ...payload.new } : l
            ));
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stages]);

  // Create a new stage
  const createStage = useCallback(async (funnelId: string, name: string, color: string) => {
    if (!workspaceId) return null;
    try {
      const position = stages.length;
      const { data, error } = await supabase
        .from('funnel_stages')
        .insert({
          funnel_id: funnelId,
          workspace_id: workspaceId,
          name,
          color,
          position,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchStages(funnelId);
      toast.success('Etapa criada com sucesso!');
      return data as FunnelStage;
    } catch (err) {
      console.error('Error creating stage:', err);
      toast.error('Erro ao criar etapa');
      return null;
    }
  }, [workspaceId, stages.length, fetchStages]);

  // Delete a stage
  const deleteStage = useCallback(async (stageId: string): Promise<{ success: boolean; error?: string; count?: number }> => {
    if (!workspaceId) return { success: false, error: 'no_workspace' };
    try {
      // Check if there are leads in this stage
      const { count, error: countError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('stage_id', stageId)
        .eq('workspace_id', workspaceId);

      if (countError) throw countError;

      if ((count || 0) > 0) {
        return { success: false, error: 'has_leads', count: count || 0 };
      }

      const { error } = await supabase
        .from('funnel_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;

      if (currentFunnel) await fetchStages(currentFunnel.id);
      toast.success('Etapa excluída!');
      return { success: true };
    } catch (err) {
      console.error('Error deleting stage:', err);
      toast.error('Erro ao excluir etapa');
      return { success: false, error: 'unknown' };
    }
  }, [workspaceId, currentFunnel, fetchStages]);

  return {
    funnels,
    currentFunnel,
    setCurrentFunnel,
    stages,
    leads,
    tags,
    loading,
    error,
    fetchFunnels,
    fetchStages,
    fetchLeads,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    getTagUsageCount,
    getTagsWithCounts,
    createLead,
    updateLead,
    moveLead,
    deleteLead,
    getLeadHistory,
    addTagToLead,
    removeTagFromLead,
    addSale,
    updateSale,
    deleteSale,
    saveSales,
    findLeadByWhatsAppJid,
    createFunnel,
    updateStage,
    createStage,
    deleteStage,
    getStatistics,
  };
}
