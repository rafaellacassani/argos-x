import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  instance_name: string;
  message_text: string;
  attachment_url: string | null;
  attachment_type: string | null;
  filter_tag_ids: string[];
  filter_stage_ids: string[];
  filter_responsible_ids: string[];
  total_recipients: number;
  interval_seconds: number;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  schedule_days: number[];
  scheduled_at: string | null;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  last_sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  lead_id: string;
  phone: string;
  personalized_message: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  position: number;
  lead?: {
    name: string;
    phone: string;
    email: string | null;
    company: string | null;
  };
}

export interface CreateCampaignData {
  name: string;
  instance_name: string;
  message_text: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  filter_tag_ids?: string[];
  filter_stage_ids?: string[];
  filter_responsible_ids?: string[];
  interval_seconds?: number;
  schedule_start_time?: string | null;
  schedule_end_time?: string | null;
  schedule_days?: number[];
  scheduled_at?: string | null;
}

export function useCampaigns() {
  const { workspaceId } = useWorkspace();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns((data || []).map(c => ({
        ...c,
        filter_tag_ids: (c.filter_tag_ids as string[]) || [],
        filter_stage_ids: (c.filter_stage_ids as string[]) || [],
        filter_responsible_ids: (c.filter_responsible_ids as string[]) || [],
        schedule_days: (c.schedule_days as number[]) || [1, 2, 3, 4, 5],
      })));
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      toast.error('Erro ao carregar campanhas');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel('campaigns-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `workspace_id=eq.${workspaceId}` },
        () => {
          fetchCampaigns();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchCampaigns]);

  const createCampaign = useCallback(async (data: CreateCampaignData): Promise<Campaign | null> => {
    if (!workspaceId) return null;
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          workspace_id: workspaceId,
          name: data.name,
          instance_name: data.instance_name,
          message_text: data.message_text,
          attachment_url: data.attachment_url || null,
          attachment_type: data.attachment_type || null,
          filter_tag_ids: data.filter_tag_ids || [],
          filter_stage_ids: data.filter_stage_ids || [],
          filter_responsible_ids: data.filter_responsible_ids || [],
          interval_seconds: data.interval_seconds || 30,
          schedule_start_time: data.schedule_start_time || null,
          schedule_end_time: data.schedule_end_time || null,
          schedule_days: data.schedule_days || [1, 2, 3, 4, 5],
          scheduled_at: data.scheduled_at || null,
          created_by: userProfile?.id || null,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      await fetchCampaigns();
      return campaign as unknown as Campaign;
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error('Erro ao criar campanha');
      return null;
    }
  }, [workspaceId, fetchCampaigns]);

  const updateCampaign = useCallback(async (id: string, data: Partial<CreateCampaignData>) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchCampaigns();
      return true;
    } catch (err) {
      console.error('Error updating campaign:', err);
      toast.error('Erro ao atualizar campanha');
      return false;
    }
  }, [fetchCampaigns]);

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchCampaigns();
      toast.success('Campanha excluída');
      return true;
    } catch (err) {
      console.error('Error deleting campaign:', err);
      toast.error('Erro ao excluir campanha');
      return false;
    }
  }, [fetchCampaigns]);

  const pauseCampaign = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchCampaigns();
      toast.success('Campanha pausada');
    } catch (err) {
      toast.error('Erro ao pausar campanha');
    }
  }, [fetchCampaigns]);

  const resumeCampaign = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'running', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchCampaigns();
      toast.success('Campanha retomada');
    } catch (err) {
      toast.error('Erro ao retomar campanha');
    }
  }, [fetchCampaigns]);

  const startCampaign = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('prepare-campaign', {
        body: { campaignId: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchCampaigns();
      toast.success(`Campanha iniciada! ${data.total_recipients} mensagens serão enviadas.`);
      return data;
    } catch (err: any) {
      console.error('Error starting campaign:', err);
      toast.error(err?.message || 'Erro ao iniciar campanha');
      return null;
    }
  }, [fetchCampaigns]);

  const cancelCampaign = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      await fetchCampaigns();
      toast.success('Campanha cancelada');
    } catch (err) {
      toast.error('Erro ao cancelar campanha');
    }
  }, [fetchCampaigns]);

  const duplicateCampaign = useCallback(async (campaign: Campaign) => {
    const newCampaign = await createCampaign({
      name: `${campaign.name} (cópia)`,
      instance_name: campaign.instance_name,
      message_text: campaign.message_text,
      attachment_url: campaign.attachment_url,
      attachment_type: campaign.attachment_type,
      filter_tag_ids: campaign.filter_tag_ids,
      filter_stage_ids: campaign.filter_stage_ids,
      filter_responsible_ids: campaign.filter_responsible_ids,
      interval_seconds: campaign.interval_seconds,
      schedule_start_time: campaign.schedule_start_time,
      schedule_end_time: campaign.schedule_end_time,
      schedule_days: campaign.schedule_days,
    });
    if (newCampaign) toast.success('Campanha duplicada');
    return newCampaign;
  }, [createCampaign]);

  const fetchRecipients = useCallback(async (campaignId: string): Promise<CampaignRecipient[]> => {
    try {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('*, lead:leads(name, phone, email, company)')
        .eq('campaign_id', campaignId)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CampaignRecipient[];
    } catch (err) {
      console.error('Error fetching recipients:', err);
      return [];
    }
  }, []);

  const estimateRecipients = useCallback(async (
    filterTagIds: string[],
    filterStageIds: string[],
    filterResponsibleIds: string[],
  ): Promise<number> => {
    if (!workspaceId) return 0;
    try {
      let query = supabase
        .from('leads')
        .select('id, phone', { count: 'exact', head: false })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .neq('phone', '');

      if (filterStageIds.length > 0) {
        query = query.in('stage_id', filterStageIds);
      }
      if (filterResponsibleIds.length > 0) {
        query = query.in('responsible_user', filterResponsibleIds);
      }

      const { data: leads, error } = await query;
      if (error) throw error;

      let filtered = (leads || []).filter(l => (l.phone || '').replace(/\D/g, '').length >= 10);

      if (filterTagIds.length > 0) {
      const { data: tagAssignments } = await supabase
          .from('lead_tag_assignments')
          .select('lead_id')
          .in('tag_id', filterTagIds);

        const tagLeadIds = new Set((tagAssignments || []).map(t => t.lead_id));
        filtered = filtered.filter(l => tagLeadIds.has(l.id));
      }

      return filtered.length;
    } catch {
      return 0;
    }
  }, [workspaceId]);

  return {
    campaigns,
    loading,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    pauseCampaign,
    resumeCampaign,
    startCampaign,
    cancelCampaign,
    duplicateCampaign,
    fetchRecipients,
    estimateRecipients,
  };
}
