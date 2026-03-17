import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

import { toast } from 'sonner';

export type PermissionLevel = 'denied' | 'read' | 'write';

export const API_RESOURCES = [
  { key: 'leads', label: 'Leads', description: 'Gerenciar leads do funil' },
  { key: 'contacts', label: 'Contatos', description: 'Acesso à lista de contatos' },
  { key: 'messages', label: 'Mensagens', description: 'Mensagens do WhatsApp' },
  { key: 'agents', label: 'Agentes IA', description: 'Agentes de inteligência artificial' },
  { key: 'campaigns', label: 'Campanhas', description: 'Campanhas de envio em massa' },
  { key: 'calendar', label: 'Calendário', description: 'Eventos e agendamentos' },
  { key: 'tags', label: 'Tags', description: 'Etiquetas de classificação' },
  { key: 'funnels', label: 'Funis', description: 'Funis e etapas de vendas' },
  { key: 'webhooks', label: 'Webhooks', description: 'Notificações de eventos' },
] as const;

export type ApiResourceKey = typeof API_RESOURCES[number]['key'];

export type ApiPermissions = Record<ApiResourceKey, PermissionLevel>;

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: ApiPermissions;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function useApiKeys() {
  
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('api-keys', {
        method: 'GET',
      });

      if (error) throw error;
      setKeys(data?.keys || []);
    } catch (err: any) {
      console.error('Error fetching API keys:', err);
      toast.error('Erro ao carregar chaves de API');
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = useCallback(async (
    name: string,
    permissions: ApiPermissions,
    expiresAt?: string
  ): Promise<{ key: ApiKey; raw_key: string } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('api-keys', {
        method: 'POST',
        body: { name, permissions, expires_at: expiresAt || null },
      });

      if (error) throw error;

      toast.success('Chave de API criada com sucesso');
      await fetchKeys();
      return data;
    } catch (err: any) {
      console.error('Error creating API key:', err);
      toast.error('Erro ao criar chave de API');
      return null;
    }
  }, [fetchKeys]);

  const updateKey = useCallback(async (id: string, updates: Partial<Pick<ApiKey, 'name' | 'permissions' | 'is_active' | 'expires_at'>>) => {
    try {
      const { data, error } = await supabase.functions.invoke('api-keys', {
        method: 'PATCH',
        body: { id, ...updates },
      });

      if (error) throw error;

      toast.success('Chave atualizada');
      await fetchKeys();
      return data;
    } catch (err: any) {
      console.error('Error updating API key:', err);
      toast.error('Erro ao atualizar chave');
      return null;
    }
  }, [fetchKeys]);

  const deleteKey = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('api-keys', {
        method: 'DELETE',
        body: { id },
      });

      if (error) throw error;

      toast.success('Chave revogada com sucesso');
      await fetchKeys();
    } catch (err: any) {
      console.error('Error deleting API key:', err);
      toast.error('Erro ao revogar chave');
    }
  }, [fetchKeys]);

  const toggleKey = useCallback(async (id: string, isActive: boolean) => {
    await updateKey(id, { is_active: isActive });
  }, [updateKey]);

  return {
    keys,
    loading,
    fetchKeys,
    createKey,
    updateKey,
    deleteKey,
    toggleKey,
  };
}
