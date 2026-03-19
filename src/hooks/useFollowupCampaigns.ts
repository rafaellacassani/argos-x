import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { toast } from 'sonner';

export interface FollowupCampaign {
  id: string;
  workspace_id: string;
  meta_page_id: string | null;
  instance_name: string | null;
  instance_type: string;
  agent_id: string;
  context_prompt: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface FollowupContact {
  phone: string;
  name: string | null;
  sender_id?: string;
  last_message: string;
}

export interface FollowupContactResult {
  id: string;
  campaign_id: string;
  contact_phone: string;
  contact_name: string | null;
  sender_id: string | null;
  last_message_preview: string | null;
  message_sent: string | null;
  status: string;
  skip_reason: string | null;
  sent_at: string | null;
}

export function useFollowupCampaigns() {
  const { workspaceId } = useWorkspace();
  const [campaigns, setCampaigns] = useState<FollowupCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedContacts, setScannedContacts] = useState<FollowupContact[]>([]);
  const [executing, setExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<FollowupContactResult[]>([]);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const canceledRef = useRef(false);

  const fetchCampaigns = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('followup_campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns((data || []) as unknown as FollowupCampaign[]);
    } catch (err) {
      console.error('Error fetching followup campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Realtime for campaign progress
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel('followup-campaigns-rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'followup_campaigns',
        filter: `workspace_id=eq.${workspaceId}`,
      }, () => { fetchCampaigns(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, fetchCampaigns]);

  const scanContacts = useCallback(async (
    instanceType: string,
    instanceName: string | null,
    metaPageId: string | null,
  ) => {
    if (!workspaceId) return;
    setScanning(true);
    setScannedContacts([]);
    try {
      const { data, error } = await supabase.functions.invoke('followup-inteligente', {
        body: {
          action: 'scan',
          instance_type: instanceType,
          instance_name: instanceName,
          meta_page_id: metaPageId,
          workspace_id: workspaceId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setScannedContacts(data.contacts || []);
      toast.success(`${data.total} contatos sem resposta encontrados`);
    } catch (err: any) {
      console.error('Scan error:', err);
      toast.error(err?.message || 'Erro ao buscar contatos');
    } finally {
      setScanning(false);
    }
  }, [workspaceId]);

  const startFollowup = useCallback(async (
    instanceType: string,
    instanceName: string | null,
    metaPageId: string | null,
    agentId: string,
    contextPrompt: string,
    contacts: FollowupContact[],
  ) => {
    if (!workspaceId || contacts.length === 0) return;

    pausedRef.current = false;
    canceledRef.current = false;
    setExecuting(true);
    setExecutionLog([]);

    try {
      // Create campaign record
      const { data: campaign, error: createError } = await supabase
        .from('followup_campaigns')
        .insert({
          workspace_id: workspaceId,
          instance_type: instanceType,
          instance_name: instanceName,
          meta_page_id: metaPageId,
          agent_id: agentId,
          context_prompt: contextPrompt,
          status: 'running',
          total_contacts: contacts.length,
        } as any)
        .select()
        .single();

      if (createError) throw createError;
      const campaignId = (campaign as any).id;
      setCurrentCampaignId(campaignId);

      // Insert all contacts
      const contactRows = contacts.map((c) => ({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        contact_phone: c.phone,
        contact_name: c.name,
        sender_id: c.sender_id || null,
        last_message_preview: c.last_message?.substring(0, 200) || null,
        status: 'pending',
      }));

      const { error: insertErr } = await supabase
        .from('followup_campaign_contacts')
        .insert(contactRows as any);
      if (insertErr) throw insertErr;

      let sentCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        if (canceledRef.current) break;

        // Wait while paused
        while (pausedRef.current && !canceledRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (canceledRef.current) break;

        const contact = contacts[i];

        try {
          // Generate personalized message
          const { data: genData, error: genError } = await supabase.functions.invoke('followup-inteligente', {
            body: {
              action: 'generate',
              agent_id: agentId,
              context_prompt: contextPrompt,
              contact_phone: contact.phone,
              sender_id: contact.sender_id,
              instance_type: instanceType,
              instance_name: instanceName,
              meta_page_id: metaPageId,
              workspace_id: workspaceId,
            },
          });

          if (genError || genData?.error) {
            throw new Error(genData?.error || genError?.message || 'AI generation failed');
          }

          const generatedMessage = genData.message;

          // Send message
          const { data: sendData, error: sendError } = await supabase.functions.invoke('followup-inteligente', {
            body: {
              action: 'send',
              instance_type: instanceType,
              instance_name: instanceName,
              meta_page_id: metaPageId,
              contact_phone: contact.phone,
              sender_id: contact.sender_id,
              message: generatedMessage,
              workspace_id: workspaceId,
            },
          });

          if (sendError || sendData?.error) {
            throw new Error(sendData?.error || sendError?.message || 'Send failed');
          }

          sentCount++;

          // Update contact record
          await supabase
            .from('followup_campaign_contacts')
            .update({
              status: 'sent',
              message_sent: generatedMessage,
              sent_at: new Date().toISOString(),
            } as any)
            .eq('campaign_id', campaignId)
            .eq('contact_phone', contact.phone);

          const logEntry: FollowupContactResult = {
            id: `${i}`,
            campaign_id: campaignId,
            contact_phone: contact.phone,
            contact_name: contact.name,
            sender_id: contact.sender_id || null,
            last_message_preview: contact.last_message,
            message_sent: generatedMessage,
            status: 'sent',
            skip_reason: null,
            sent_at: new Date().toISOString(),
          };
          setExecutionLog((prev) => [...prev, logEntry]);

        } catch (err: any) {
          failedCount++;
          console.error(`[followup] Failed for ${contact.phone}:`, err.message);

          await supabase
            .from('followup_campaign_contacts')
            .update({
              status: 'failed',
              skip_reason: err.message?.substring(0, 500),
            } as any)
            .eq('campaign_id', campaignId)
            .eq('contact_phone', contact.phone);

          const logEntry: FollowupContactResult = {
            id: `${i}`,
            campaign_id: campaignId,
            contact_phone: contact.phone,
            contact_name: contact.name,
            sender_id: contact.sender_id || null,
            last_message_preview: contact.last_message,
            message_sent: null,
            status: 'failed',
            skip_reason: err.message,
            sent_at: null,
          };
          setExecutionLog((prev) => [...prev, logEntry]);
        }

        // Update campaign counters
        await supabase
          .from('followup_campaigns')
          .update({
            sent_count: sentCount,
            skipped_count: skippedCount,
            failed_count: failedCount,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', campaignId);

        // Interval of 3 seconds between sends
        if (i < contacts.length - 1 && !canceledRef.current) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      // Finalize campaign
      const finalStatus = canceledRef.current ? 'canceled' : 'completed';
      await supabase
        .from('followup_campaigns')
        .update({
          status: finalStatus,
          sent_count: sentCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', campaignId);

      toast.success(
        canceledRef.current
          ? `Follow-up cancelado: ${sentCount} enviados`
          : `Follow-up concluído: ${sentCount} enviados, ${failedCount} falhas`
      );

    } catch (err: any) {
      console.error('Followup error:', err);
      toast.error(err?.message || 'Erro ao executar follow-up');
    } finally {
      setExecuting(false);
      fetchCampaigns();
    }
  }, [workspaceId, fetchCampaigns]);

  const pauseFollowup = useCallback(() => {
    pausedRef.current = true;
    toast.info('Follow-up pausado');
  }, []);

  const resumeFollowup = useCallback(() => {
    pausedRef.current = false;
    toast.info('Follow-up retomado');
  }, []);

  const cancelFollowup = useCallback(() => {
    canceledRef.current = true;
    toast.info('Follow-up cancelado');
  }, []);

  const isPaused = useCallback(() => pausedRef.current, []);

  return {
    campaigns,
    loading,
    scanning,
    scannedContacts,
    executing,
    executionLog,
    currentCampaignId,
    fetchCampaigns,
    scanContacts,
    startFollowup,
    pauseFollowup,
    resumeFollowup,
    cancelFollowup,
    isPaused,
  };
}
