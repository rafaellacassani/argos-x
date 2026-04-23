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

// Extract real error message from supabase.functions.invoke errors
function extractErrorMessage(error: any, data: any): string {
  // If data has an error field, use it
  if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  
  // Try to extract from FunctionsHttpError context
  if (error?.context?.body) {
    try {
      const body = typeof error.context.body === 'string' ? JSON.parse(error.context.body) : error.context.body;
      if (body?.error) return body.error;
    } catch { /* ignore */ }
    if (typeof error.context.body === 'string') return error.context.body.substring(0, 500);
  }
  
  // Fallback to error message
  if (error?.message) return error.message;
  return 'Unknown error';
}

// Check if error is a network/timeout issue worth retrying
function isRetryableError(errorMsg: string): boolean {
  return /timeout|network|fetch|ECONNRESET|socket|aborted|502|503|504/i.test(errorMsg);
}

const ABANDONED_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 5;

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

  // Auto-cleanup abandoned campaigns
  const cleanupAbandonedCampaigns = useCallback(async (loadedCampaigns: FollowupCampaign[]) => {
    const now = Date.now();
    const abandoned = loadedCampaigns.filter(
      (c) => c.status === 'running' && (now - new Date(c.updated_at).getTime()) > ABANDONED_THRESHOLD_MS
    );

    for (const campaign of abandoned) {
      console.warn(`[followup] Auto-canceling abandoned campaign ${campaign.id} (last updated: ${campaign.updated_at})`);
      await supabase
        .from('followup_campaigns')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', campaign.id);
    }

    if (abandoned.length > 0) {
      toast.info(`${abandoned.length} campanha(s) abandonada(s) foram canceladas automaticamente`);
    }

    return abandoned.length;
  }, []);

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
      const loaded = (data || []) as unknown as FollowupCampaign[];
      
      // Auto-cleanup abandoned campaigns
      const cleanedCount = await cleanupAbandonedCampaigns(loaded);
      
      if (cleanedCount > 0) {
        // Re-fetch after cleanup
        const { data: refreshed } = await supabase
          .from('followup_campaigns')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });
        setCampaigns((refreshed || []) as unknown as FollowupCampaign[]);
      } else {
        setCampaigns(loaded);
      }
    } catch (err) {
      console.error('Error fetching followup campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, cleanupAbandonedCampaigns]);

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
    audienceType: string = "no_reply_from_lead",
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
          audience_type: audienceType,
        },
      });
      const errMsg = extractErrorMessage(error, data);
      if (error && !data?.contacts) throw new Error(errMsg);
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

  // Invoke edge function with 1x retry for retryable errors
  const invokeWithRetry = useCallback(async (body: Record<string, any>): Promise<{ data: any; error: any }> => {
    const result = await supabase.functions.invoke('followup-inteligente', { body });
    
    if (result.error && !result.data) {
      const errMsg = extractErrorMessage(result.error, result.data);
      if (isRetryableError(errMsg)) {
        console.warn(`[followup] Retryable error, retrying in 2s: ${errMsg}`);
        await new Promise((r) => setTimeout(r, 2000));
        return supabase.functions.invoke('followup-inteligente', { body });
      }
    }
    
    return result;
  }, []);

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

    let campaignId: string | null = null;

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
      campaignId = (campaign as any).id;
      setCurrentCampaignId(campaignId);

      // Insert all contacts — wrapped in try/catch to revert campaign on failure
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
      
      if (insertErr) {
        console.error('[followup] Failed to insert contacts, reverting campaign:', insertErr);
        await supabase
          .from('followup_campaigns')
          .update({ status: 'canceled', updated_at: new Date().toISOString() } as any)
          .eq('id', campaignId);
        throw new Error(`Erro ao inserir contatos: ${insertErr.message}`);
      }

      let sentCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let consecutiveFailures = 0;

      for (let i = 0; i < contacts.length; i++) {
        if (canceledRef.current) break;

        // Wait while paused
        while (pausedRef.current && !canceledRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (canceledRef.current) break;

        const contact = contacts[i];

        try {
          // Generate personalized message (with retry)
          const { data: genData, error: genError } = await invokeWithRetry({
            action: 'generate',
            agent_id: agentId,
            context_prompt: contextPrompt,
            contact_phone: contact.phone,
            contact_name: contact.name || null,
            sender_id: contact.sender_id,
            instance_type: instanceType,
            instance_name: instanceName,
            meta_page_id: metaPageId,
            workspace_id: workspaceId,
          });

          const genErrMsg = extractErrorMessage(genError, genData);
          if ((genError && !genData?.message) || genData?.error) {
            throw new Error(genData?.error || genErrMsg);
          }

          const generatedMessage = genData.message;

          // Send message (with retry)
          const { data: sendData, error: sendError } = await invokeWithRetry({
            action: 'send',
            instance_type: instanceType,
            instance_name: instanceName,
            meta_page_id: metaPageId,
            contact_phone: contact.phone,
            sender_id: contact.sender_id,
            message: generatedMessage,
            workspace_id: workspaceId,
          });

          const sendErrMsg = extractErrorMessage(sendError, sendData);
          if ((sendError && !sendData?.success) || sendData?.error) {
            throw new Error(sendData?.error || sendErrMsg);
          }

          sentCount++;
          consecutiveFailures = 0; // Reset on success

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
            campaign_id: campaignId!,
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
          consecutiveFailures++;
          const errorMsg = err.message || 'Unknown error';
          console.error(`[followup] Error for ${contact.phone} (consecutive: ${consecutiveFailures}):`, errorMsg);

          const isSafetyBlock = /bloqueada por segurança|unsafe_followup_message/i.test(errorMsg);
          const isSendError = !isSafetyBlock && (
            errorMsg.includes('Send failed') ||
            errorMsg.includes('Evolution API') ||
            errorMsg.includes('Graph API')
          );

          const status = isSendError ? 'failed' : 'skipped';
          if (isSendError) {
            failedCount++;
          } else {
            skippedCount++;
          }

          await supabase
            .from('followup_campaign_contacts')
            .update({
              status,
              skip_reason: errorMsg.substring(0, 500),
            } as any)
            .eq('campaign_id', campaignId)
            .eq('contact_phone', contact.phone);

          const logEntry: FollowupContactResult = {
            id: `${i}`,
            campaign_id: campaignId!,
            contact_phone: contact.phone,
            contact_name: contact.name,
            sender_id: contact.sender_id || null,
            last_message_preview: contact.last_message,
            message_sent: null,
            status,
            skip_reason: errorMsg,
            sent_at: null,
          };
          setExecutionLog((prev) => [...prev, logEntry]);

          // Auto-pause after MAX_CONSECUTIVE_FAILURES consecutive failures
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !pausedRef.current) {
            pausedRef.current = true;
            // Persist pause state in DB so user can resume from history
            await supabase
              .from('followup_campaigns')
              .update({ status: 'paused', updated_at: new Date().toISOString() } as any)
              .eq('id', campaignId);
            toast.error(
              `Follow-up pausado automaticamente: ${MAX_CONSECUTIVE_FAILURES} falhas consecutivas. Verifique os erros e retome manualmente.`,
              { duration: 10000 }
            );
          }
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

      // Finalize campaign — respect paused state (don't override with completed)
      const finalStatus = canceledRef.current
        ? 'canceled'
        : pausedRef.current
          ? 'paused'
          : 'completed';
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

      if (canceledRef.current) {
        toast.success(`Follow-up cancelado: ${sentCount} enviados`);
      } else if (pausedRef.current) {
        toast.info(`Follow-up pausado: ${sentCount} enviados, ${failedCount} falhas. Você pode retomar pelo histórico.`);
      } else {
        toast.success(`Follow-up concluído: ${sentCount} enviados, ${failedCount} falhas`);
      }

    } catch (err: any) {
      console.error('Followup error:', err);
      toast.error(err?.message || 'Erro ao executar follow-up');
      
      // If campaign was created but failed during setup, mark as canceled
      if (campaignId) {
        await supabase
          .from('followup_campaigns')
          .update({ status: 'canceled', updated_at: new Date().toISOString() } as any)
          .eq('id', campaignId);
      }
    } finally {
      setExecuting(false);
      fetchCampaigns();
    }
  }, [workspaceId, fetchCampaigns, invokeWithRetry]);

  const pauseFollowup = useCallback(() => {
    pausedRef.current = true;
    toast.info('Follow-up pausado');
  }, []);

  const resumeFollowup = useCallback(() => {
    pausedRef.current = false;
    toast.info('Follow-up retomado');
  }, []);

  const cancelFollowup = useCallback(async (campaignId?: string) => {
    const targetCampaignId = campaignId || currentCampaignId;

    if (!targetCampaignId) {
      toast.error('Nenhuma campanha em execução para cancelar');
      return;
    }

    if (targetCampaignId === currentCampaignId) {
      canceledRef.current = true;
    }

    const { error } = await supabase
      .from('followup_campaigns')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', targetCampaignId);

    if (error) {
      console.error('Cancel followup error:', error);
      toast.error('Erro ao cancelar follow-up');
      return;
    }

    await fetchCampaigns();
    toast.info('Follow-up cancelado');
  }, [currentCampaignId, fetchCampaigns]);

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
