import { memo, useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import { StageSettingsDialog } from './StageSettingsDialog';
import type { Lead, FunnelStage } from '@/hooks/useLeads';

interface LeadColumnProps {
  stage: FunnelStage;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onOpenChat?: (jid: string) => void;
  onAddLead?: (stageId: string) => void;
  onEditStage?: (stage: FunnelStage) => void;
  onUpdateStage?: (stageId: string, updates: Partial<FunnelStage>) => void;
  canDelete?: boolean;
}

export const LeadColumn = memo(function LeadColumn({
  stage,
  leads,
  onLeadClick,
  onLeadDelete,
  onOpenChat,
  onAddLead,
  onEditStage,
  onUpdateStage,
  canDelete = true
}: LeadColumnProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const totalValue = leads.reduce((sum, lead) => sum + (lead.total_sales_value || lead.value || 0), 0);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="flex flex-col h-full min-w-[300px] max-w-[300px]">
      {/* Column Header */}
      <div 
        className="flex items-center justify-between p-3 rounded-t-lg"
        style={{ backgroundColor: `${stage.color}15` }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-semibold text-foreground">{stage.name}</h3>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {onAddLead && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddLead(stage.id)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                <MoreHorizontal className="h-4 w-4" />
                {stage.bot_id && (
                  <Bot className="h-3 w-3 absolute -top-1 -right-1 text-primary" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditStage && (
                <DropdownMenuItem onClick={() => onEditStage(stage)}>
                  Editar Fase
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Configurar Automação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Bar */}
      <div 
        className="px-3 py-2 border-x text-sm flex items-center justify-between"
        style={{ borderColor: `${stage.color}30` }}
      >
        <span className="text-muted-foreground">Total:</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">
          {formatCurrency(totalValue)}
        </span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2 space-y-2 overflow-y-auto rounded-b-lg border border-t-0",
              "min-h-[200px] transition-colors duration-200",
              snapshot.isDraggingOver && "bg-primary/5"
            )}
            style={{ 
              borderColor: `${stage.color}30`,
              backgroundColor: snapshot.isDraggingOver ? `${stage.color}08` : undefined
            }}
          >
            <AnimatePresence mode="popLayout">
              {leads.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  onClick={onLeadClick}
                  onDelete={onLeadDelete}
                  onOpenChat={onOpenChat}
                  canDelete={canDelete}
                />
              ))}
            </AnimatePresence>
            {provided.placeholder}
            
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum lead nesta fase</p>
                {onAddLead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => onAddLead(stage.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Droppable>

      <StageSettingsDialog
        stage={stage}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdate={onUpdateStage || (() => {})}
      />
    </div>
  );
});
