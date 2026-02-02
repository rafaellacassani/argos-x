import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Phone, MessageSquare, MoreVertical, DollarSign, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Lead } from '@/hooks/useLeads';

interface LeadCardProps {
  lead: Lead;
  index: number;
  onClick: (lead: Lead) => void;
  onDelete: (leadId: string) => void;
  onOpenChat?: (jid: string) => void;
}

export const LeadCard = memo(function LeadCard({ 
  lead, 
  index, 
  onClick, 
  onDelete,
  onOpenChat 
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
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-card rounded-lg border p-4 cursor-pointer shadow-sm",
            "hover:shadow-md hover:scale-[1.02] transition-all duration-200",
            snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
          )}
          onClick={() => onClick(lead)}
        >
          {/* Header: Avatar + Name + Menu */}
          <div className="flex items-start gap-3 mb-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={lead.avatar_url} alt={lead.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-foreground truncate">{lead.name}</h4>
              {lead.company && (
                <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
              )}
            </div>
            
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
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(lead.id);
                  }}
                  className="text-destructive"
                >
                  Excluir Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              <span className="truncate">{formatPhone(lead.phone)}</span>
            </div>
            {lead.responsible_user && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span className="truncate">{lead.responsible_user}</span>
              </div>
            )}
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
      )}
    </Draggable>
  );
});
