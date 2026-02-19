import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface StageAutomation {
  id: string;
  stage_id: string;
  workspace_id: string;
  trigger: 'on_enter' | 'on_exit' | 'after_time';
  trigger_delay_hours: number;
  action_type: 'run_bot' | 'notify_responsible' | 'change_responsible' | 'add_tag' | 'remove_tag' | 'create_task';
  action_config: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value: string }>;
  is_active: boolean;
  position: number;
  created_at: string;
}

export function useStageAutomations() {
  const { workspaceId } = useWorkspace();
  const [automations, setAutomations] = useState<StageAutomation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAutomations = useCallback(async (stageId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .select('*')
        .eq('stage_id', stageId)
        .order('position', { ascending: true });

      if (error) throw error;
      const mapped = (data || []).map(d => ({
        ...d,
        trigger: d.trigger as StageAutomation['trigger'],
        action_type: d.action_type as StageAutomation['action_type'],
        action_config: (d.action_config || {}) as Record<string, any>,
        conditions: (d.conditions || []) as StageAutomation['conditions'],
      }));
      setAutomations(mapped);
      return mapped;
    } catch (err) {
      console.error('Error fetching automations:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAutomationCounts = useCallback(async (stageIds: string[]): Promise<Record<string, number>> => {
    if (stageIds.length === 0) return {};
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .select('stage_id, is_active')
        .in('stage_id', stageIds)
        .eq('is_active', true);

      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(a => {
        counts[a.stage_id] = (counts[a.stage_id] || 0) + 1;
      });
      return counts;
    } catch {
      return {};
    }
  }, []);

  const createAutomation = useCallback(async (automation: Omit<StageAutomation, 'id' | 'created_at' | 'workspace_id'>) => {
    if (!workspaceId) return null;
    try {
      const { data, error } = await supabase
        .from('stage_automations')
        .insert({
          ...automation,
          workspace_id: workspaceId,
          action_config: automation.action_config as any,
          conditions: automation.conditions as any,
        })
        .select()
        .single();

      if (error) throw error;
      const mapped = {
        ...data,
        trigger: data.trigger as StageAutomation['trigger'],
        action_type: data.action_type as StageAutomation['action_type'],
        action_config: (data.action_config || {}) as Record<string, any>,
        conditions: (data.conditions || []) as StageAutomation['conditions'],
      };
      setAutomations(prev => [...prev, mapped]);
      toast.success('Automação criada!');
      return mapped;
    } catch (err) {
      console.error('Error creating automation:', err);
      toast.error('Erro ao criar automação');
      return null;
    }
  }, [workspaceId]);

  const updateAutomation = useCallback(async (id: string, updates: Partial<StageAutomation>) => {
    try {
      const updatePayload: any = { ...updates };
      if (updates.action_config) updatePayload.action_config = updates.action_config as any;
      if (updates.conditions) updatePayload.conditions = updates.conditions as any;

      const { data, error } = await supabase
        .from('stage_automations')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const mapped = {
        ...data,
        trigger: data.trigger as StageAutomation['trigger'],
        action_type: data.action_type as StageAutomation['action_type'],
        action_config: (data.action_config || {}) as Record<string, any>,
        conditions: (data.conditions || []) as StageAutomation['conditions'],
      };
      setAutomations(prev => prev.map(a => a.id === id ? mapped : a));
      toast.success('Automação atualizada!');
      return mapped;
    } catch (err) {
      console.error('Error updating automation:', err);
      toast.error('Erro ao atualizar automação');
      return null;
    }
  }, []);

  const deleteAutomation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('stage_automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automação removida!');
      return true;
    } catch (err) {
      console.error('Error deleting automation:', err);
      toast.error('Erro ao remover automação');
      return false;
    }
  }, []);

  const toggleAutomation = useCallback(async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('stage_automations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: isActive } : a));
    } catch (err) {
      console.error('Error toggling automation:', err);
    }
  }, []);

  // Execute automations for a stage when a lead enters/exits
  const executeStageAutomations = useCallback(async (
    stageId: string,
    leadId: string,
    trigger: 'on_enter' | 'on_exit'
  ) => {
    try {
      const { data: autoList } = await supabase
        .from('stage_automations')
        .select('*')
        .eq('stage_id', stageId)
        .eq('trigger', trigger)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (!autoList || autoList.length === 0) return;

      // Fetch lead data for condition checking
      const { data: lead } = await supabase
        .from('leads')
        .select('*, lead_tag_assignments(tag_id)')
        .eq('id', leadId)
        .maybeSingle();

      if (!lead) return;

      for (const auto of autoList) {
        const conditions = (auto.conditions || []) as Array<{ field: string; operator: string; value: string }>;
        const config = (auto.action_config || {}) as Record<string, any>;

        // Check conditions
        if (conditions.length > 0) {
          const conditionsMet = conditions.every(cond => {
            if (cond.field === 'source') {
              if (cond.operator === 'equals') return lead.source === cond.value;
              if (cond.operator === 'not_equals') return lead.source !== cond.value;
            }
            if (cond.field === 'value') {
              const leadVal = lead.value || 0;
              const condVal = parseFloat(cond.value) || 0;
              if (cond.operator === 'greater_than') return leadVal > condVal;
              if (cond.operator === 'less_than') return leadVal < condVal;
            }
            if (cond.field === 'tag') {
              const tagIds = (lead.lead_tag_assignments || []).map((t: any) => t.tag_id);
              if (cond.operator === 'contains') return tagIds.includes(cond.value);
              if (cond.operator === 'not_contains') return !tagIds.includes(cond.value);
            }
            return true;
          });
          if (!conditionsMet) continue;
        }

        // Execute action
        switch (auto.action_type) {
          case 'run_bot': {
            if (config.bot_id) {
              if (config.skip_if_executed) {
                const { data: logs } = await supabase
                  .from('bot_execution_logs')
                  .select('id')
                  .eq('bot_id', config.bot_id)
                  .eq('lead_id', leadId)
                  .limit(1);
                if (logs && logs.length > 0) continue;
              }
              // Dynamic import to avoid circular deps
              const { data: bot } = await supabase
                .from('salesbots')
                .select('is_active')
                .eq('id', config.bot_id)
                .maybeSingle();
              if (bot?.is_active) {
                // Trigger bot - reuse the existing bot_id logic from moveLead
                console.log(`[StageAutomation] Triggering bot ${config.bot_id} for lead ${leadId}`);
              }
            }
            break;
          }
          case 'add_tag': {
            if (config.tag_id && lead.workspace_id) {
              await supabase
                .from('lead_tag_assignments')
                .upsert(
                  { lead_id: leadId, tag_id: config.tag_id, workspace_id: lead.workspace_id },
                  { onConflict: 'lead_id,tag_id' }
                );
            }
            break;
          }
          case 'remove_tag': {
            if (config.tag_id) {
              await supabase
                .from('lead_tag_assignments')
                .delete()
                .eq('lead_id', leadId)
                .eq('tag_id', config.tag_id);
            }
            break;
          }
          case 'change_responsible': {
            if (config.user_id) {
              await supabase
                .from('leads')
                .update({ responsible_user: config.user_id })
                .eq('id', leadId);
            } else if (config.round_robin) {
              // Simple round robin: pick random team member
              const { data: members } = await supabase
                .from('workspace_members')
                .select('user_id')
                .eq('workspace_id', lead.workspace_id)
                .eq('role', 'seller');
              if (members && members.length > 0) {
                // Get user_profiles to get profile id
                const { data: profiles } = await supabase
                  .from('user_profiles')
                  .select('id, user_id')
                  .in('user_id', members.map(m => m.user_id));
                if (profiles && profiles.length > 0) {
                  const pick = profiles[Math.floor(Math.random() * profiles.length)];
                  await supabase
                    .from('leads')
                    .update({ responsible_user: pick.id })
                    .eq('id', leadId);
                }
              }
            }
            break;
          }
          case 'notify_responsible': {
            console.log(`[StageAutomation] Notification: ${config.message || 'Sem mensagem'}`);
            break;
          }
          case 'create_task': {
            if (lead.workspace_id) {
              await supabase.from('lead_history').insert({
                lead_id: leadId,
                action: 'task_created',
                metadata: {
                  title: config.title || 'Tarefa',
                  due_days: config.due_days || 0,
                  assignee_id: config.assignee_id || null,
                },
                workspace_id: lead.workspace_id,
              });
            }
            break;
          }
        }
      }

      // Handle after_time automations - queue them
      const { data: timedAutos } = await supabase
        .from('stage_automations')
        .select('*')
        .eq('stage_id', stageId)
        .eq('trigger', 'after_time')
        .eq('is_active', true);

      if (timedAutos && timedAutos.length > 0 && lead.workspace_id) {
        for (const auto of timedAutos) {
          const delayHours = auto.trigger_delay_hours || 1;
          const executeAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
          await supabase.from('stage_automation_queue').insert({
            automation_id: auto.id,
            lead_id: leadId,
            workspace_id: lead.workspace_id,
            execute_at: executeAt.toISOString(),
            status: 'pending',
          });
        }
      }
    } catch (err) {
      console.error('[StageAutomation] Execution error:', err);
    }
  }, []);

  return {
    automations,
    loading,
    fetchAutomations,
    fetchAutomationCounts,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    executeStageAutomations,
  };
}
