import { memo, useCallback, useEffect, useState } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LeadColumn } from './LeadColumn';
import { useStageAutomations } from '@/hooks/useStageAutomations';
import type { Lead, FunnelStage, LeadTag } from '@/hooks/useLeads';

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
  canDelete = true,
  teamMembers = [],
  tags = [],
}: LeadKanbanProps) {
  const { fetchAutomationCounts } = useStageAutomations();
  const [automationCounts, setAutomationCounts] = useState<Record<string, number>>({});

  const loadCounts = useCallback(async () => {
    if (stages.length > 0) {
      const counts = await fetchAutomationCounts(stages.map(s => s.id));
      setAutomationCounts(counts);
    }
  }, [stages, fetchAutomationCounts]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  
  const handleDragEnd = useCallback((result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable
    if (!destination) return;

    // Dropped in the same place
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    // Calculate new position based on destination
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

  // Group leads by stage
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = leads
      .filter(lead => lead.stage_id === stage.id)
      .sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<string, Lead[]>);

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
                canDelete={canDelete}
                teamMembers={teamMembers}
                automationCount={automationCounts[stage.id] || 0}
                tags={tags}
                onAutomationCountChange={loadCounts}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </TooltipProvider>
    </DragDropContext>
  );
});
