import { memo, useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LeadColumn } from './LeadColumn';
import { useStageAutomations } from '@/hooks/useStageAutomations';
import type { Lead, FunnelStage, LeadTag } from '@/hooks/useLeads';

const STAGE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b',
  '#84cc16', '#f43f5e',
];

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

  // Pick default color = first color not used by existing stages
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

  const handleDragEnd = useCallback((result: DropResult) => {
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
  }, [leads, onLeadMove]);

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
        <ScrollArea className="w-full h-full">
          <div className="flex gap-4 p-4 min-h-full">
            {stages.map(stage => (
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
              />
            ))}

            {/* New Stage Column */}
            {onAddStage && currentFunnelId && (
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
      </TooltipProvider>
    </DragDropContext>
  );
});
