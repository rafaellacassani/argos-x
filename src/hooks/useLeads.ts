import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  // Fetch all funnels
  const fetchFunnels = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFunnels(data || []);
      
      // Set default funnel as current
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

  // Fetch leads for current funnel
  const fetchLeads = useCallback(async (stageIds: string[]) => {
    if (stageIds.length === 0) return [];
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('stage_id', stageIds)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Fetch tags for each lead
      const leadsWithTags = await Promise.all(
        (data || []).map(async (lead) => {
          const { data: tagData } = await supabase
            .from('lead_tag_assignments')
            .select('tag_id, lead_tags(*)')
            .eq('lead_id', lead.id);
          
          return {
            ...lead,
            tags: tagData?.map(t => t.lead_tags).filter(Boolean) || []
          };
        })
      );
      
      setLeads(leadsWithTags as Lead[]);
      return leadsWithTags;
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
    try {
      const { data, error } = await supabase
        .from('lead_tags')
        .insert({ name, color })
        .select()
        .single();

      if (error) throw error;
      
      setTags(prev => [...prev, data]);
      return data as LeadTag;
    } catch (err) {
      console.error('Error creating tag:', err);
      return null;
    }
  }, []);

  // Create a new lead
  const createLead = useCallback(async (leadData: Partial<Lead>) => {
    try {
      // Get the first stage of the current funnel if not specified
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

      // Get max position in the stage
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
          position: newPosition
        })
        .select()
        .single();

      if (error) throw error;

      // Add history entry
      await supabase.from('lead_history').insert({
        lead_id: data.id,
        action: 'created',
        to_stage_id: stageId,
        metadata: { source: leadData.source || 'manual' }
      });

      // Add WhatsApp tag if from WhatsApp
      if (leadData.source === 'whatsapp') {
        const { data: whatsappTag } = await supabase
          .from('lead_tags')
          .select('id')
          .eq('name', 'WhatsApp')
          .maybeSingle();
        
        if (whatsappTag) {
          await supabase.from('lead_tag_assignments').insert({
            lead_id: data.id,
            tag_id: whatsappTag.id
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
  }, [currentFunnel]);

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
      // Get current lead
      const currentLead = leads.find(l => l.id === leadId);
      const oldStageId = currentLead?.stage_id;

      // Update positions of leads in old stage (if changing stages)
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

      // Update the moved lead
      const { data, error } = await supabase
        .from('leads')
        .update({ 
          stage_id: newStageId, 
          position: newPosition 
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;

      // Add history entry if stage changed
      if (oldStageId && oldStageId !== newStageId) {
        await supabase.from('lead_history').insert({
          lead_id: leadId,
          action: 'stage_changed',
          from_stage_id: oldStageId,
          to_stage_id: newStageId,
          performed_by: performedBy
        });
      }

      // Update local state
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
  }, [leads]);

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
    try {
      const { error } = await supabase
        .from('lead_tag_assignments')
        .insert({ lead_id: leadId, tag_id: tagId });

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
  }, [tags]);

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
    try {
      const { data: funnel, error: funnelError } = await supabase
        .from('funnels')
        .insert({ name, description })
        .select()
        .single();

      if (funnelError) throw funnelError;

      // Create default stages
      const defaultStages = [
        { name: 'Entrada', color: '#E5E7EB', position: 0 },
        { name: 'Em Andamento', color: '#0171C3', position: 1 },
        { name: 'Concluído', color: '#22C55E', position: 2, is_win_stage: true }
      ];

      for (const stage of defaultStages) {
        await supabase.from('funnel_stages').insert({
          funnel_id: funnel.id,
          ...stage
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
  }, []);

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
      return {
        stage,
        count: stageLeads.length,
        totalValue
      };
    });

    const totalLeads = leads.length;
    const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
    const wonLeads = leads.filter(l => 
      stages.find(s => s.id === l.stage_id)?.is_win_stage
    ).length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    return {
      byStage: stats,
      totalLeads,
      totalValue,
      wonLeads,
      conversionRate
    };
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

  return {
    // State
    funnels,
    currentFunnel,
    stages,
    leads,
    tags,
    loading,
    error,
    
    // Actions
    setCurrentFunnel,
    createLead,
    updateLead,
    moveLead,
    deleteLead,
    getLeadHistory,
    addTagToLead,
    removeTagFromLead,
    findLeadByWhatsAppJid,
    createFunnel,
    updateStage,
    getStatistics,
    createTag,
    fetchTags,
    
    // Refresh
    refreshLeads: () => fetchLeads(stages.map(s => s.id)),
    refreshFunnels: fetchFunnels
  };
}
