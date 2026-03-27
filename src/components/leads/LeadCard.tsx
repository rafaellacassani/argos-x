import { memo, useMemo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Phone, MessageSquare, MoreVertical, DollarSign, Clock, Zap, ArrowRight, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';

interface TeamMember {
  id: string;
  full_name: string;
}

interface LeadCardProps {
  lead: Lead;
  index: number;
  onClick: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onOpenChat?: (jid: string) => void;
  canDelete?: boolean;
  teamMembers?: TeamMember[];
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (leadId: string) => void;
}

export const LeadCard = memo(function LeadCard({ 
  lead, 
  index, 
  onClick, 
  onDelete,
  onOpenChat,
  canDelete = true,
  teamMembers = [],
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
}: LeadCardProps) {
  const initials = lead.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPhone = (phone: string) => {
    const digits = phone
      .replace(/@s\.whatsapp\.net$/i, "")
      .replace(/@g\.us$/i, "")
      .replace(/@lid$/i, "")
      .replace(/@c\.us$/i, "")
      .replace(/[^0-9]/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
      if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
    if (digits.length >= 10) return `+${digits}`;
    return phone;
  };

  const urgency = useMemo(() => {
    const now = Date.now();
    const updated = new Date(lead.updated_at).getTime();
    const diffMs = now - updated;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    let label: string;
    let color: string; // tailwind classes
    if (diffHours < 1) {
      label = `${Math.max(1, Math.floor(diffMs / 60000))}m`;
      color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    } else if (diffHours < 24) {
      label = `${Math.floor(diffHours)}h`;
      color = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    } else if (diffDays < 2) {
      label = '1d';
      color = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
    } else if (diffDays < 7) {
      label = `${Math.floor(diffDays)}d`;
      color = 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
    } else {
      label = `${Math.floor(diffDays)}d`;
      color = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    }
    return { label, color, diffHours };
  }, [lead.updated_at]);

  const handleClick = () => {
    if (bulkMode && onToggleSelect) {
      onToggleSelect(lead.id);
    } else {
      onClick(lead);
    }
  };

  const cardContent = (
    <div
      className={cn(
        "bg-card rounded-lg border p-4 cursor-pointer shadow-sm",
        "hover:shadow-md hover:scale-[1.02] transition-all duration-200",
        bulkMode && isSelected && "ring-2 ring-primary border-primary"
      )}
      onClick={handleClick}
    >
      {/* Header: Checkbox/Avatar + Name + Menu */}
      <div className="flex items-start gap-3 mb-3">
        {bulkMode ? (
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect?.(lead.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={lead.avatar_url} alt={lead.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground truncate">{lead.name}</h4>
            <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", urgency.color)}>
              <Clock className="h-2.5 w-2.5" />
              {urgency.label}
            </span>
          </div>
          {lead.company && (
            <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
          )}
        </div>
        
        {!bulkMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {lead.whatsapp_jid && onOpenChat && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onOpenChat(lead.whatsapp_jid!);
                }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Abrir Chat
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(lead.id);
                  }}
                  className="text-destructive"
                >
                  Excluir Lead
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span className="truncate">{formatPhone(lead.phone)}</span>
        </div>
        {lead.responsible_user && (() => {
          const member = teamMembers.find(m => m.id === lead.responsible_user);
          const responsibleName = member?.full_name || 'Atribuído';
          const responsibleInitials = responsibleName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-medium shrink-0">
                {responsibleInitials}
              </div>
              <span className="truncate">{responsibleName}</span>
            </div>
          );
        })()}
      </div>

      {/* Value */}
      {((lead.total_sales_value || 0) > 0 || lead.value > 0) && (
        <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <DollarSign className="h-4 w-4" />
          {formatCurrency(lead.total_sales_value || lead.value)}
          {(lead.sales_count || 0) > 0 && (
            <span className="text-muted-foreground font-normal ml-1">
              ({lead.sales_count} {lead.sales_count === 1 ? 'venda' : 'vendas'})
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {lead.tags.slice(0, 3).map(tag => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs px-2 py-0.5"
              style={{ 
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                borderColor: tag.color
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {lead.tags.length > 3 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              +{lead.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Source indicator */}
      {lead.source === 'whatsapp' && (
        <div className="mt-3 pt-3 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 text-emerald-500" />
          Via WhatsApp
        </div>
      )}
    </div>
  );

  if (bulkMode) {
    // In bulk mode, disable drag and drop
    return cardContent;
  }

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
          )}
        >
          {cardContent}
        </div>
      )}
    </Draggable>
  );
});
