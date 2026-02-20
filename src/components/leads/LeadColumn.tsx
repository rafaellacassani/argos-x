import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Plus, Bot, Pencil, Palette, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import { StageSettingsDialog } from './StageSettingsDialog';
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

interface LeadColumnProps {
  stage: FunnelStage;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadDelete: (leadId: string) => void;
  onOpenChat?: (jid: string) => void;
  onAddLead?: (stageId: string) => void;
  onEditStage?: (stage: FunnelStage) => void;
  onUpdateStage?: (stageId: string, updates: Partial<FunnelStage>) => void;
  onDeleteStage?: (stageId: string) => Promise<{ success: boolean; error?: string; count?: number }>;
  canDelete?: boolean;
  canDeleteStage?: boolean;
  teamMembers?: TeamMember[];
  hasActiveAutomations?: boolean;
  tags?: LeadTag[];
  bulkMode?: boolean;
  selectedLeadIds?: Set<string>;
  onToggleSelect?: (leadId: string) => void;
  onToggleSelectAll?: (stageId: string, leadIds: string[]) => void;
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
  onDeleteStage,
  canDelete = true,
  canDeleteStage = true,
  teamMembers = [],
  hasActiveAutomations = false,
  tags = [],
  bulkMode = false,
  selectedLeadIds = new Set(),
  onToggleSelect,
  onToggleSelectAll,
}: LeadColumnProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<{ hasLeads: boolean; count: number }>({ hasLeads: false, count: 0 });
  const [colorOpen, setColorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalValue = leads.reduce((sum, lead) => sum + (lead.total_sales_value || lead.value || 0), 0);

  // Bulk selection state for this column
  const columnLeadIds = leads.map(l => l.id);
  const selectedInColumn = columnLeadIds.filter(id => selectedLeadIds.has(id));
  const allSelected = columnLeadIds.length > 0 && selectedInColumn.length === columnLeadIds.length;
  const someSelected = selectedInColumn.length > 0 && !allSelected;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleStartEdit = useCallback(() => {
    setEditName(stage.name);
    setIsEditing(true);
  }, [stage.name]);

  const handleSaveName = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== stage.name && onUpdateStage) {
      onUpdateStage(stage.id, { name: trimmed });
    }
    setIsEditing(false);
  }, [editName, stage.name, stage.id, onUpdateStage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveName();
    else if (e.key === 'Escape') { setIsEditing(false); setEditName(stage.name); }
  }, [handleSaveName, stage.name]);

  const handleColorChange = useCallback((color: string) => {
    if (onUpdateStage) onUpdateStage(stage.id, { color });
    setColorOpen(false);
  }, [stage.id, onUpdateStage]);

  const handleDeleteClick = useCallback(async () => {
    if (!onDeleteStage) return;
    const result = await onDeleteStage(stage.id);
    if (result.error === 'has_leads') {
      setDeleteInfo({ hasLeads: true, count: result.count || 0 });
      setDeleteDialogOpen(true);
    }
  }, [onDeleteStage, stage.id]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!onDeleteStage) return;
    await onDeleteStage(stage.id);
    setDeleteDialogOpen(false);
  }, [onDeleteStage, stage.id]);

  return (
    <div className="flex flex-col h-full min-w-[300px] max-w-[300px]">
      {/* Column Header */}
      <div
        className="group flex items-center justify-between p-3 rounded-t-lg"
        style={{ backgroundColor: `${stage.color}15` }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {bulkMode && columnLeadIds.length > 0 ? (
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={() => onToggleSelectAll?.(stage.id, columnLeadIds)}
              className="flex-shrink-0"
            />
          ) : (
            <Popover open={colorOpen} onOpenChange={setColorOpen}>
              <PopoverTrigger asChild>
                <button className="relative flex-shrink-0 cursor-pointer group/color" title="Mudar cor">
                  <div
                    className="w-3 h-3 rounded-full ring-2 ring-transparent group-hover/color:ring-foreground/20 transition-all"
                    style={{ backgroundColor: stage.color }}
                  />
                  {hasActiveAutomations && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 border border-background" />
                      </TooltipTrigger>
                      <TooltipContent>Automações ativas — clique em Automações para gerenciar</TooltipContent>
                    </Tooltip>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="grid grid-cols-6 gap-2">
                  {STAGE_COLORS.map((c) => (
                    <button
                      key={c}
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                        stage.color === c && "ring-2 ring-offset-2 ring-foreground/50"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => handleColorChange(c)}
                    >
                      {stage.color === c && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value.slice(0, 30))}
              onBlur={handleSaveName}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm font-semibold px-1.5 py-0"
              maxLength={30}
            />
          ) : (
            <h3 className="font-semibold text-foreground truncate">{stage.name}</h3>
          )}
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
            {leads.length}
          </span>

          {!isEditing && !bulkMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={handleStartEdit}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {!bulkMode && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {onAddLead && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddLead(stage.id)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 relative">
                  <MoreHorizontal className="h-4 w-4" />
                  {stage.bot_id && <Bot className="h-3 w-3 absolute -top-1 -right-1 text-primary" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleStartEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Renomear etapa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setColorOpen(true)}>
                  <Palette className="h-4 w-4 mr-2" />
                  Mudar cor
                </DropdownMenuItem>
                {onEditStage && (
                  <DropdownMenuItem onClick={() => onEditStage(stage)}>
                    Editar Fase
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Bot className="h-4 w-4 mr-2" />
                  Configurar Automação
                </DropdownMenuItem>
                {onDeleteStage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={!canDeleteStage}
                      onClick={handleDeleteClick}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir etapa
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div
        className="px-3 py-2 border-x text-sm flex items-center justify-between"
        style={{ borderColor: `${stage.color}30` }}
      >
        <span className="text-muted-foreground">Total:</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(totalValue)}</span>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.id} isDropDisabled={bulkMode}>
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
              backgroundColor: snapshot.isDraggingOver ? `${stage.color}08` : undefined,
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
                  teamMembers={teamMembers}
                  bulkMode={bulkMode}
                  isSelected={selectedLeadIds.has(lead.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </AnimatePresence>
            {provided.placeholder}

            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhum lead nesta fase</p>
                {onAddLead && !bulkMode && (
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => onAddLead(stage.id)}>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteInfo.hasLeads ? 'Etapa com leads' : `Excluir "${stage.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteInfo.hasLeads
                ? `Essa etapa tem ${deleteInfo.count} lead(s). Mova-os para outra etapa antes de excluir.`
                : 'Tem certeza que quer excluir esta etapa? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteInfo.hasLeads ? (
              <AlertDialogAction onClick={() => setDeleteDialogOpen(false)}>Entendido</AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteConfirm}
                >
                  Excluir
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
