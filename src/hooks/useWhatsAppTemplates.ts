import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface WhatsAppTemplate {
  id: string;
  workspace_id: string;
  cloud_connection_id: string;
  template_id: string;
  template_name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  synced_at: string;
  created_at: string;
}

export function useWhatsAppTemplates() {
  const { workspaceId } = useWorkspace();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchTemplates = useCallback(async (connectionId?: string) => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('template_name');

      if (connectionId) {
        query = query.eq('cloud_connection_id', connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTemplates((data || []) as unknown as WhatsAppTemplate[]);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const syncTemplates = useCallback(async (connectionId: string) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-templates', {
        body: { connectionId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${data.upserted} templates sincronizados`);
      await fetchTemplates(connectionId);
      return data;
    } catch (err: any) {
      console.error('Error syncing templates:', err);
      toast.error(err?.message || 'Erro ao sincronizar templates');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [fetchTemplates]);

  const [creating, setCreating] = useState(false);

  const createTemplate = useCallback(async (connectionId: string, payload: {
    name: string;
    language: string;
    category: string;
    components: any[];
  }) => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-whatsapp-template', {
        body: { connectionId, ...payload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Template criado com sucesso! Status: ' + (data.status || 'PENDING'));
      await fetchTemplates(connectionId);
      return data;
    } catch (err: any) {
      console.error('Error creating template:', err);
      toast.error(err?.message || 'Erro ao criar template');
      return null;
    } finally {
      setCreating(false);
    }
  }, [fetchTemplates]);

  const getApprovedTemplates = useCallback(() => {
    return templates.filter(t => t.status === 'APPROVED');
  }, [templates]);

  return {
    templates,
    loading,
    syncing,
    creating,
    fetchTemplates,
    syncTemplates,
    createTemplate,
    getApprovedTemplates,
  };
}
