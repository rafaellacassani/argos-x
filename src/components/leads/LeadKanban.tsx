import { memo, useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, X, Check, CheckSquare, Trash2, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { LeadColumn } from './LeadColumn';
import { useStageAutomations } from '@/hooks/useStageAutomations';
import type { Lead, FunnelStage, LeadTag } from '@/hooks/useLeads';

const STAGE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b',
  '#84cc16', '#f43f5e',
];

const MAX_BULK_SELECTION = 200;

interface TeamMember {
  id: string;
  full_name: string;
}

interface LeadKanbanProps {
  stages: FunnelStage[];
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onLeadMove: (leadId: string, newStageId: string, newPosition: number) => void;
  onOpenChat?: (jid: string) => void;
  onAddLead?: (stageId: string) => void;
  onEditStage?: (stage: FunnelStage) => void;
  onUpdateStage?: (stageId: string, updates: Partial<FunnelStage>) => void;
  onDeleteStage?: (stageId: string) => Promise<{ success: boolean; error?: string; count?: number }>;
  onAddStage?: (funnelId: string, name: string, color: string) => Promise<FunnelStage | null>;
  onBulkMove?: (leadIds: string[], targetStageId: string) => Promise<void>;
  onBulkDelete?: (leadIds: string[]) => Promise<void>;
  onReorderStage?: (stageId: string, direction: 'left' | 'right') => Promise<void>;
  currentFunnelId?: string;
  canDelete?: boolean;
  teamMembers?: TeamMember[];
  tags?: LeadTag[];
}

export const LeadKanban = memo(function LeadKanban({
  stages,
  leads,
  onLeadClick,
  onLeadDelete,
  onLeadMove,
  onOpenChat,
  onAddLead,
  onEditStage,
  onUpdateStage,
  onDeleteStage,
  onAddStage,
  onBulkMove,
  onBulkDelete,
  onReorderStage,
  currentFunnelId,
  canDelete = true,
  teamMembers = [],
  tags = [],
}: LeadKanbanProps) {
  const { fetchAutomationCounts } = useStageAutomations();
  const [automationCounts, setAutomationCounts] = useState<Record<string, number>>({});
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('');
  const newStageInputRef = useRef<HTMLInputElement>(null);

  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const defaultNewColor = useMemo(() => {
    const usedColors = new Set(stages.map(s => s.color));
    return STAGE_COLORS.find(c => !usedColors.has(c)) || STAGE_COLORS[0];
  }, [stages]);

  const loadCounts = useCallback(async () => {
    if (stages.length > 0) {
      const counts = await fetchAutomationCounts(stages.map(s => s.id));
      setAutomationCounts(counts);
    }
  }, [stages, fetchAutomationCounts]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  useEffect(() => {
    if (isAddingStage && newStageInputRef.current) {
      newStageInputRef.current.focus();
    }
  }, [isAddingStage]);

  // Exit bulk mode clears selection
  const handleExitBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedLeadIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        if (next.size >= MAX_BULK_SELECTION) return prev;
        next.add(leadId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback((stageId: string, leadIds: string[]) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      const allSelected = leadIds.every(id => next.has(id));
      if (allSelected) {
        leadIds.forEach(id => next.delete(id));
      } else {
        for (const id of leadIds) {
          if (next.size >= MAX_BULK_SELECTION) break;
          next.add(id);
        }
      }
      return next;
    });
  }, []);

  const handleBulkMove = useCallback(async (targetStageId: string) => {
    if (!onBulkMove || selectedLeadIds.size === 0) return;
    await onBulkMove(Array.from(selectedLeadIds), targetStageId);
    handleExitBulk();
  }, [onBulkMove, selectedLeadIds, handleExitBulk]);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!onBulkDelete || selectedLeadIds.size === 0) return;
    await onBulkDelete(Array.from(selectedLeadIds));
    setBulkDeleteOpen(false);
    handleExitBulk();
  }, [onBulkDelete, selectedLeadIds, handleExitBulk]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (bulkMode) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const destinationLeads = leads
      .filter(l => l.stage_id === destination.droppableId)
      .sort((a, b) => a.position - b.position);

    let newPosition: number;
    if (destinationLeads.length === 0) {
      newPosition = 0;
    } else if (destination.index === 0) {
      newPosition = (destinationLeads[0]?.position || 0) - 1;
    } else if (destination.index >= destinationLeads.length) {
      newPosition = (destinationLeads[destinationLeads.length - 1]?.position || 0) + 1;
    } else {
      const before = destinationLeads[destination.index - 1]?.position || 0;
      const after = destinationLeads[destination.index]?.position || before + 2;
      newPosition = (before + after) / 2;
    }

    onLeadMove(draggableId, destination.droppableId, newPosition);
  }, [leads, onLeadMove, bulkMode]);

  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = leads
      .filter(lead => lead.stage_id === stage.id)
      .sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<string, Lead[]>);

  const handleStartAddStage = useCallback(() => {
    setNewStageName('');
    setNewStageColor(defaultNewColor);
    setIsAddingStage(true);
  }, [defaultNewColor]);

  const handleCancelAddStage = useCallback(() => {
    setIsAddingStage(false);
    setNewStageName('');
  }, []);

  const handleConfirmAddStage = useCallback(async () => {
    const trimmed = newStageName.trim();
    if (!trimmed || !currentFunnelId || !onAddStage) return;
    await onAddStage(currentFunnelId, trimmed, newStageColor);
    setIsAddingStage(false);
    setNewStageName('');
  }, [newStageName, newStageColor, currentFunnelId, onAddStage]);

  const handleNewStageKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirmAddStage();
    else if (e.key === 'Escape') handleCancelAddStage();
  }, [handleConfirmAddStage, handleCancelAddStage]);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <TooltipProvider>
        <div className="relative h-full flex flex-col">
          {/* Bulk mode toggle */}
          <div className="flex items-center gap-2 px-4 pt-2">
            {!bulkMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMode(true)}
                className="gap-2"
              >
                <CheckSquare className="h-4 w-4" />
                Selecionar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExitBulk}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar seleção
              </Button>
            )}
            {bulkMode && selectedLeadIds.size >= MAX_BULK_SELECTION && (
              <span className="text-xs text-amber-600">Máximo de {MAX_BULK_SELECTION} leads por operação</span>
            )}
          </div>

          <ScrollArea className="w-full flex-1">
            <div className="flex gap-4 p-4 min-h-full">
              {stages.map((stage, stageIndex) => (
                <LeadColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsByStage[stage.id] || []}
                  onLeadClick={onLeadClick}
                  onLeadDelete={onLeadDelete}
                  onOpenChat={onOpenChat}
                  onAddLead={onAddLead}
                  onEditStage={onEditStage}
                  onUpdateStage={onUpdateStage}
                  onDeleteStage={onDeleteStage}
                  canDelete={canDelete}
                  canDeleteStage={stages.length > 1}
                  teamMembers={teamMembers}
                  hasActiveAutomations={(automationCounts[stage.id] || 0) > 0}
                  tags={tags}
                  bulkMode={bulkMode}
                  selectedLeadIds={selectedLeadIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={handleToggleSelectAll}
                  canMoveLeft={stageIndex > 0}
                  canMoveRight={stageIndex < stages.length - 1}
                  onMoveLeft={onReorderStage ? () => onReorderStage(stage.id, 'left') : undefined}
                  onMoveRight={onReorderStage ? () => onReorderStage(stage.id, 'right') : undefined}
                />
              ))}

              {/* New Stage Column */}
              {onAddStage && currentFunnelId && !bulkMode && (
                <div className="flex flex-col min-w-[300px] max-w-[300px]">
                  {isAddingStage ? (
                    <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 space-y-3">
                      <Input
                        ref={newStageInputRef}
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value.slice(0, 30))}
                        onKeyDown={handleNewStageKeyDown}
                        placeholder="Nome da etapa"
                        maxLength={30}
                        className="font-semibold"
                      />
                      <div className="grid grid-cols-6 gap-2">
                        {STAGE_COLORS.map((c) => (
                          <button
                            key={c}
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                              newStageColor === c && "ring-2 ring-offset-2 ring-foreground/50"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => setNewStageColor(c)}
                          >
                            {newStageColor === c && <Check className="h-3.5 w-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleConfirmAddStage} disabled={!newStageName.trim()}>
                          Adicionar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelAddStage}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartAddStage}
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors min-h-[200px] text-muted-foreground"
                    >
                      <Plus className="h-6 w-6" />
                      <span className="text-sm font-medium">Nova Etapa</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Bulk action bar */}
          {bulkMode && selectedLeadIds.size > 0 && (
            <div className="sticky bottom-0 border-t bg-background p-3 flex items-center gap-3 shadow-lg z-10">
              <Badge variant="secondary" className="text-sm py-1 px-3">
                ✓ {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''} selecionado{selectedLeadIds.size > 1 ? 's' : ''}
              </Badge>

              <Select onValueChange={handleBulkMove}>
                <SelectTrigger className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    <SelectValue placeholder="Mover para etapa" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              )}

              <Button variant="ghost" size="sm" onClick={handleExitBulk} className="ml-auto gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Bulk delete confirmation */}
        <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Todos os leads selecionados serão permanentemente removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleBulkDeleteConfirm}
              >
                Excluir {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </DragDropContext>
  );
});
