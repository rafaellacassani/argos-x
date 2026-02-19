import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings, RefreshCw, Briefcase, LayoutGrid, List, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLeads, Lead } from '@/hooks/useLeads';
import { LeadKanban } from '@/components/leads/LeadKanban';
import { LeadDetailModal } from '@/components/leads/LeadDetailModal';
import { CreateLeadDialog } from '@/components/leads/CreateLeadDialog';
import { LeadStats } from '@/components/leads/LeadStats';
import { LeadFilters, LeadFiltersData, DEFAULT_FILTERS, countActiveFilters, getDateRange } from '@/components/leads/LeadFilters';
import { LeadFilterChips } from '@/components/leads/LeadFilterChips';
import { useUserRole } from '@/hooks/useUserRole';
import { useTeam } from '@/hooks/useTeam';

const SESSION_KEY = 'leads-filters';

function loadSessionFilters(): LeadFiltersData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Restore Date objects
    if (parsed.dateFrom) parsed.dateFrom = new Date(parsed.dateFrom);
    if (parsed.dateTo) parsed.dateTo = new Date(parsed.dateTo);
    return parsed;
  } catch { return null; }
}

function saveSessionFilters(filters: LeadFiltersData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(filters));
}

export default function Leads() {
  const navigate = useNavigate();
  const { role, userProfileId, isSeller, canDeleteLeads, isAdminOrManager } = useUserRole();
  const {
    funnels, currentFunnel, stages, leads, tags, loading,
    setCurrentFunnel, fetchStages, fetchLeads, createLead, updateLead,
    moveLead, deleteLead, addTagToLead, removeTagFromLead,
    createFunnel, updateStage, saveSales
  } = useLeads();
  const { teamMembers, fetchTeamMembers } = useTeam();

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogStageId, setCreateDialogStageId] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [myWalletActive, setMyWalletActive] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<LeadFiltersData>(() => loadSessionFilters() || DEFAULT_FILTERS);

  // Load team members on mount
  useEffect(() => { fetchTeamMembers(); }, [fetchTeamMembers]);

  // Initialize visible stages when stages load (only if not set from session)
  useEffect(() => {
    if (stages.length > 0 && filters.visibleStageIds.length === 0) {
      setFilters(prev => ({ ...prev, visibleStageIds: stages.map(s => s.id) }));
    }
  }, [stages]);

  // Reset filters when funnel changes
  useEffect(() => {
    if (currentFunnel) {
      setFilters(prev => ({
        ...DEFAULT_FILTERS,
        visibleStageIds: [], // will be reset when stages load
      }));
    }
  }, [currentFunnel?.id]);

  // Compute unique product names from current leads
  const products = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => (l.sales || []).forEach(s => { if (s.product_name) set.add(s.product_name); }));
    return Array.from(set).sort();
  }, [leads]);

  // Build server filter params from LeadFiltersData
  const buildServerFilters = useCallback((f: LeadFiltersData) => {
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    if (f.datePreset) {
      const range = getDateRange(f.datePreset);
      dateFrom = range.from.toISOString();
      dateTo = range.to.toISOString();
    } else {
      if (f.dateFrom) dateFrom = f.dateFrom.toISOString();
      if (f.dateTo) dateTo = f.dateTo.toISOString();
    }
    return {
      responsibleUserIds: f.responsibleUserIds,
      tagIds: f.tagIds,
      valueMin: f.valueMin,
      valueMax: f.valueMax,
      product: f.product,
      dateType: f.dateType,
      dateFrom,
      dateTo,
      sources: f.sources,
    };
  }, []);

  // Fetch leads when stages or filters change
  useEffect(() => {
    if (stages.length > 0) {
      const serverFilters = buildServerFilters(filters);
      fetchLeads(stages.map(s => s.id), serverFilters);
    }
  }, [stages, filters, fetchLeads, buildServerFilters]);

  // Filter leads based on role and wallet filter
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (isSeller && myWalletActive && userProfileId) {
      result = result.filter(l => l.responsible_user === userProfileId);
    } else if (isSeller && !myWalletActive) {
      result = result.filter(l => !l.responsible_user || l.responsible_user === userProfileId);
    }
    return result;
  }, [leads, isSeller, myWalletActive, userProfileId]);

  // Visible stages based on filter
  const visibleStages = useMemo(() =>
    stages.filter(s => filters.visibleStageIds.includes(s.id)),
    [stages, filters.visibleStageIds]
  );

  const activeFilterCount = useMemo(() =>
    countActiveFilters(filters, stages.map(s => s.id)),
    [filters, stages]
  );



  const handleApplyFilters = useCallback((newFilters: LeadFiltersData) => {
    setFilters(newFilters);
    saveSessionFilters(newFilters);
  }, []);

  const handleLeadClick = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setDetailSheetOpen(true);
  }, []);

  const handleLeadDelete = useCallback(async (leadId: string) => {
    if (!canDeleteLeads) return;
    await deleteLead(leadId);
    if (selectedLead?.id === leadId) {
      setDetailSheetOpen(false);
      setSelectedLead(null);
    }
  }, [deleteLead, selectedLead, canDeleteLeads]);

  const handleLeadMove = useCallback(async (leadId: string, newStageId: string, newPosition: number) => {
    if (isSeller && userProfileId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && !lead.responsible_user) await updateLead(leadId, { responsible_user: userProfileId });
    }
    await moveLead(leadId, newStageId, newPosition);
  }, [moveLead, isSeller, userProfileId, leads, updateLead]);

  const handleMoveFromSheet = useCallback(async (leadId: string, stageId: string) => {
    if (isSeller && userProfileId) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && !lead.responsible_user) await updateLead(leadId, { responsible_user: userProfileId });
    }
    const stageLeads = leads.filter(l => l.stage_id === stageId);
    const maxPosition = stageLeads.length > 0 ? Math.max(...stageLeads.map(l => l.position)) + 1 : 0;
    await moveLead(leadId, stageId, maxPosition);
  }, [leads, moveLead, isSeller, userProfileId, updateLead]);

  const handleAddLead = useCallback((stageId: string) => {
    setCreateDialogStageId(stageId);
    setCreateDialogOpen(true);
  }, []);

  const handleOpenChat = useCallback(() => { navigate('/chats'); }, [navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (currentFunnel) {
      const stageData = await fetchStages(currentFunnel.id);
      if (stageData && stageData.length > 0) {
        await fetchLeads(stageData.map(s => s.id), buildServerFilters(filters));
      }
    }
    setIsRefreshing(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
      {/* Header */}
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
            <Button
              variant={myWalletActive ? 'default' : 'outline'}
              onClick={() => setMyWalletActive(!myWalletActive)}
              className="gap-2"
            >
              <Briefcase className="h-4 w-4" />
              Minha Carteira
              {myWalletActive && (
                <Badge variant="secondary" className="ml-1 text-xs">{filteredLeads.length}</Badge>
              )}
            </Button>

            <div className="flex border rounded-md">
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="icon" className="rounded-r-none" onClick={() => setViewMode('kanban')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-l-none" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter button */}
            <Button variant="outline" onClick={() => setFiltersOpen(true)} className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-0.5 text-xs h-5 px-1.5">{activeFilterCount}</Badge>
              )}
            </Button>

            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {isAdminOrManager && (
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
            )}
            <Button onClick={() => { setCreateDialogStageId(stages[0]?.id); setCreateDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo Lead
            </Button>
          </div>
        </div>

      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="px-4 lg:px-6 pt-3">
          <LeadFilterChips
            filters={filters}
            stages={stages}
            tags={tags}
            teamMembers={teamMembers}
            onRemove={handleApplyFilters}
          />
        </div>
      )}

      <div className="p-4 lg:px-6">
        <LeadStats stages={visibleStages} leads={filteredLeads} />
      </div>

      <div className="flex-1 overflow-hidden">
        {viewMode === 'kanban' ? (
          <LeadKanban
            stages={visibleStages}
            leads={filteredLeads}
            onLeadClick={handleLeadClick}
            onLeadDelete={handleLeadDelete}
            onLeadMove={handleLeadMove}
            onOpenChat={handleOpenChat}
            onAddLead={handleAddLead}
            onUpdateStage={updateStage}
            canDelete={canDeleteLeads}
          />
        ) : (
          <div className="p-4 lg:px-6 overflow-auto h-full">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum lead encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map(lead => {
                      const stage = stages.find(s => s.id === lead.stage_id);
                      return (
                        <TableRow
                          key={lead.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleLeadClick(lead)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.name}</p>
                              {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{lead.phone}</TableCell>
                          <TableCell>
                            {stage && (
                              <Badge variant="outline" style={{ borderColor: stage.color, color: stage.color }}>
                                {stage.name}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-emerald-600">
                            {(lead.total_sales_value || lead.value || 0) > 0
                              ? formatCurrency(lead.total_sales_value || lead.value || 0)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(lead.tags || []).slice(0, 2).map(tag => (
                                <span
                                  key={tag.id}
                                  className="text-xs px-2 py-0.5 rounded-full border"
                                  style={{
                                    backgroundColor: `${tag.color}15`,
                                    color: tag.color,
                                    borderColor: `${tag.color}30`,
                                  }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.source || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Filter panel */}
      <LeadFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onApply={handleApplyFilters}
        stages={stages}
        tags={tags}
        teamMembers={teamMembers}
        products={products}
      />

      <LeadDetailModal
        lead={selectedLead}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        stages={stages}
        tags={tags}
        onUpdate={updateLead}
        onMove={handleMoveFromSheet}
        onDelete={handleLeadDelete}
        onAddTag={addTagToLead}
        onRemoveTag={removeTagFromLead}
        onOpenChat={handleOpenChat}
        canDelete={canDeleteLeads}
        teamMembers={teamMembers}
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
