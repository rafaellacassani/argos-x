import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeads, Lead, LeadHistory } from '@/hooks/useLeads';
import { LeadKanban } from '@/components/leads/LeadKanban';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { LeadStats } from '@/components/leads/LeadStats';

export default function Leads() {
  const navigate = useNavigate();
  const {
    funnels,
    currentFunnel,
    stages,
    leads,
    tags,
    loading,
    setCurrentFunnel,
    createLead,
    updateLead,
    moveLead,
    deleteLead,
    getLeadHistory,
    addTagToLead,
    removeTagFromLead,
    refreshLeads,
    createFunnel,
    updateStage
  } = useLeads();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadHistory, setLeadHistory] = useState<LeadHistory[]>([]);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogStageId, setCreateDialogStageId] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (selectedLead) {
      getLeadHistory(selectedLead.id).then(setLeadHistory);
    }
  }, [selectedLead, getLeadHistory]);

  const handleLeadClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setDetailSheetOpen(true);
  }, []);

  const handleLeadDelete = useCallback(async (leadId: string) => {
    await deleteLead(leadId);
    if (selectedLead?.id === leadId) {
      setDetailSheetOpen(false);
      setSelectedLead(null);
    }
  }, [deleteLead, selectedLead]);

  const handleLeadMove = useCallback(async (leadId: string, newStageId: string, newPosition: number) => {
    await moveLead(leadId, newStageId, newPosition);
  }, [moveLead]);

  const handleMoveFromSheet = useCallback(async (leadId: string, stageId: string) => {
    const stageLeads = leads.filter(l => l.stage_id === stageId);
    const maxPosition = stageLeads.length > 0 ? Math.max(...stageLeads.map(l => l.position)) + 1 : 0;
    await moveLead(leadId, stageId, maxPosition);
  }, [leads, moveLead]);

  const handleAddLead = useCallback((stageId: string) => {
    setCreateDialogStageId(stageId);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenChat = useCallback(() => {
    navigate('/chats');
  }, [navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshLeads();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 w-[300px]" />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="h-full flex flex-col bg-muted/30"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4 lg:p-6 border-b bg-background">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Funil de Vendas</h1>
            {funnels.length > 0 && (
              <Select
                value={currentFunnel?.id}
                onValueChange={(id) => {
                  const funnel = funnels.find(f => f.id === id);
                  if (funnel) setCurrentFunnel(funnel);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  {funnels.map(funnel => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.name}{funnel.is_default && ' (Padrão)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const name = prompt('Nome do novo funil:');
                  if (name) createFunnel(name);
                }}>Criar Novo Funil</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => { setCreateDialogStageId(stages[0]?.id); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo Lead
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 lg:px-6">
        <LeadStats stages={stages} leads={leads} />
      </div>

      <div className="flex-1 overflow-hidden">
        <LeadKanban
          stages={stages}
          leads={leads}
          onLeadClick={handleLeadClick}
          onLeadDelete={handleLeadDelete}
          onLeadMove={handleLeadMove}
          onOpenChat={handleOpenChat}
          onAddLead={handleAddLead}
          onUpdateStage={updateStage}
        />
      </div>

      <LeadDetailSheet
        lead={selectedLead}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        stages={stages}
        tags={tags}
        history={leadHistory}
        onUpdate={updateLead}
        onMove={handleMoveFromSheet}
        onDelete={handleLeadDelete}
        onAddTag={addTagToLead}
        onRemoveTag={removeTagFromLead}
        onOpenChat={handleOpenChat}
      />

      <CreateLeadDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={createLead}
        defaultStageId={createDialogStageId}
      />
    </motion.div>
  );
}
