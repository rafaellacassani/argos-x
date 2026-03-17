import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface CustomFieldDefinition {
  id: string;
  workspace_id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: string[];
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface CustomFieldValue {
  id: string;
  lead_id: string;
  field_definition_id: string;
  workspace_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export function useCustomFields() {
  const { workspaceId } = useWorkspace();
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDefinitions = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_custom_field_definitions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('position', { ascending: true });
      if (error) throw error;
      setDefinitions((data || []).map(d => ({
        ...d,
        field_type: d.field_type as CustomFieldDefinition['field_type'],
        options: (d.options as string[]) || [],
      })));
    } catch (err) {
      console.error('Error fetching custom field definitions:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchDefinitions(); }, [fetchDefinitions]);

  const createDefinition = useCallback(async (data: {
    field_key: string;
    field_label: string;
    field_type: string;
    options?: string[];
  }) => {
    if (!workspaceId) return null;
    const maxPos = definitions.length > 0 ? Math.max(...definitions.map(d => d.position)) + 1 : 0;
    const { data: result, error } = await supabase
      .from('lead_custom_field_definitions')
      .insert({
        workspace_id: workspaceId,
        field_key: data.field_key,
        field_label: data.field_label,
        field_type: data.field_type,
        options: data.options || [],
        position: maxPos,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe um campo com essa chave');
      } else {
        toast.error('Erro ao criar campo');
      }
      return null;
    }
    toast.success('Campo criado com sucesso');
    await fetchDefinitions();
    return result;
  }, [workspaceId, definitions, fetchDefinitions]);

  const updateDefinition = useCallback(async (id: string, updates: Partial<CustomFieldDefinition>) => {
    const { error } = await supabase
      .from('lead_custom_field_definitions')
      .update(updates)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar campo');
      return false;
    }
    await fetchDefinitions();
    return true;
  }, [fetchDefinitions]);

  const deleteDefinition = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('lead_custom_field_definitions')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erro ao excluir campo');
      return false;
    }
    toast.success('Campo excluído');
    await fetchDefinitions();
    return true;
  }, [fetchDefinitions]);

  // Get values for a specific lead
  const getLeadCustomValues = useCallback(async (leadId: string): Promise<Record<string, string>> => {
    if (!workspaceId) return {};
    const { data, error } = await supabase
      .from('lead_custom_field_values')
      .select('field_definition_id, value')
      .eq('lead_id', leadId)
      .eq('workspace_id', workspaceId);
    if (error) return {};
    const map: Record<string, string> = {};
    (data || []).forEach(v => {
      map[v.field_definition_id] = v.value || '';
    });
    return map;
  }, [workspaceId]);

  // Save a single custom field value for a lead
  const saveLeadCustomValue = useCallback(async (leadId: string, fieldDefinitionId: string, value: string) => {
    if (!workspaceId) return false;
    const { error } = await supabase
      .from('lead_custom_field_values')
      .upsert({
        lead_id: leadId,
        field_definition_id: fieldDefinitionId,
        workspace_id: workspaceId,
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id,field_definition_id' });
    return !error;
  }, [workspaceId]);

  // Save multiple custom field values for a lead at once
  const saveLeadCustomValues = useCallback(async (leadId: string, values: Record<string, string>) => {
    if (!workspaceId) return false;
    const rows = Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([fieldDefId, value]) => ({
        lead_id: leadId,
        field_definition_id: fieldDefId,
        workspace_id: workspaceId,
        value,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return true;
    const { error } = await supabase
      .from('lead_custom_field_values')
      .upsert(rows, { onConflict: 'lead_id,field_definition_id' });
    return !error;
  }, [workspaceId]);

  return {
    definitions: definitions.filter(d => d.is_active),
    allDefinitions: definitions,
    loading,
    fetchDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    getLeadCustomValues,
    saveLeadCustomValue,
    saveLeadCustomValues,
  };
}
