import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TagRule {
  id: string;
  match_phrase: string;
  tag_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tag?: {
    id: string;
    name: string;
    color: string;
  };
}

export function useTagRules() {
  const [rules, setRules] = useState<TagRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all tag rules
  const fetchRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tag_rules')
        .select(`
          *,
          tag:lead_tags(id, name, color)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules((data || []) as TagRule[]);
      return data;
    } catch (err) {
      console.error('Error fetching tag rules:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new tag rule
  const createRule = useCallback(async (matchPhrase: string, tagId: string) => {
    try {
      const { data, error } = await supabase
        .from('tag_rules')
        .insert({
          match_phrase: matchPhrase,
          tag_id: tagId,
          is_active: true
        })
        .select(`
          *,
          tag:lead_tags(id, name, color)
        `)
        .single();

      if (error) throw error;

      setRules(prev => [data as TagRule, ...prev]);
      toast.success('Regra de tag criada com sucesso!');
      return data;
    } catch (err) {
      console.error('Error creating tag rule:', err);
      toast.error('Erro ao criar regra de tag');
      return null;
    }
  }, []);

  // Update a tag rule
  const updateRule = useCallback(async (ruleId: string, updates: Partial<Pick<TagRule, 'match_phrase' | 'tag_id' | 'is_active'>>) => {
    try {
      const { data, error } = await supabase
        .from('tag_rules')
        .update(updates)
        .eq('id', ruleId)
        .select(`
          *,
          tag:lead_tags(id, name, color)
        `)
        .single();

      if (error) throw error;

      setRules(prev => prev.map(r => r.id === ruleId ? data as TagRule : r));
      toast.success('Regra atualizada!');
      return data;
    } catch (err) {
      console.error('Error updating tag rule:', err);
      toast.error('Erro ao atualizar regra');
      return null;
    }
  }, []);

  // Delete a tag rule
  const deleteRule = useCallback(async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('tag_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success('Regra removida!');
      return true;
    } catch (err) {
      console.error('Error deleting tag rule:', err);
      toast.error('Erro ao remover regra');
      return false;
    }
  }, []);

  // Check a message against all active rules and return matching tag IDs
  const checkMessageAgainstRules = useCallback((message: string): string[] => {
    const lowercaseMessage = message.toLowerCase();
    const matchingTagIds: string[] = [];

    for (const rule of rules) {
      if (!rule.is_active) continue;
      
      const phrase = rule.match_phrase.toLowerCase();
      if (lowercaseMessage.includes(phrase)) {
        matchingTagIds.push(rule.tag_id);
      }
    }

    return [...new Set(matchingTagIds)]; // Remove duplicates
  }, [rules]);

  // Initial fetch
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    checkMessageAgainstRules
  };
}
