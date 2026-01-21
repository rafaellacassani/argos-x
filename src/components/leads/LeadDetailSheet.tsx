import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  X, 
  Phone, 
  Mail, 
  Building2, 
  MessageSquare, 
  Calendar,
  DollarSign,
  User,
  Tag,
  History,
  ChevronRight,
  Trash2,
  ExternalLink
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Lead, FunnelStage, LeadTag, LeadHistory } from '@/hooks/useLeads';

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FunnelStage[];
  tags: LeadTag[];
  history: LeadHistory[];
  onUpdate: (leadId: string, updates: Partial<Lead>) => Promise<unknown>;
  onMove: (leadId: string, stageId: string) => void;
  onDelete: (leadId: string) => void;
  onAddTag: (leadId: string, tagId: string) => void;
  onRemoveTag: (leadId: string, tagId: string) => void;
  onOpenChat?: (jid: string) => void;
}

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  stages,
  tags,
  history,
  onUpdate,
  onMove,
  onDelete,
  onAddTag,
  onRemoveTag,
  onOpenChat
}: LeadDetailSheetProps) {
  const [editedLead, setEditedLead] = useState<Partial<Lead>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset edited state when lead changes
  useEffect(() => {
    if (lead) {
      setEditedLead({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        company: lead.company,
        value: lead.value,
        responsible_user: lead.responsible_user,
        notes: lead.notes
      });
    }
  }, [lead]);

  if (!lead) return null;

  const initials = lead.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const currentStage = stages.find(s => s.id === lead.stage_id);
  const availableTags = tags.filter(t => !lead.tags?.some(lt => lt.id === t.id));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(lead.id, editedLead);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Lead criado';
      case 'stage_changed': return 'Mudou de fase';
      case 'updated': return 'Atualizado';
      default: return action;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="space-y-4 pb-4 border-b">
          {/* Lead Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={lead.avatar_url} alt={lead.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate">{lead.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline"
                  style={{ 
                    borderColor: currentStage?.color,
                    color: currentStage?.color
                  }}
                >
                  {currentStage?.name || 'Sem fase'}
                </Badge>
                {lead.source === 'whatsapp' && (
                  <Badge variant="secondary" className="text-emerald-600 bg-emerald-50">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            {lead.whatsapp_jid && onOpenChat && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onOpenChat(lead.whatsapp_jid!)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir Chat
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${lead.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </a>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O lead será removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onDelete(lead.id);
                      onOpenChange(false);
                    }}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 m-0">
              {/* Move to Stage */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  Mover para Fase
                </Label>
                <Select
                  value={lead.stage_id}
                  onValueChange={(value) => onMove(lead.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome
                </Label>
                <Input
                  value={editedLead.name || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </Label>
                <Input
                  value={editedLead.phone || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  type="email"
                  value={editedLead.email || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </Label>
                <Input
                  value={editedLead.company || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, company: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor da Venda (R$)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedLead.value || 0}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Responsável
                </Label>
                <Input
                  value={editedLead.responsible_user || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, responsible_user: e.target.value }))}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={editedLead.notes || ''}
                  onChange={(e) => setEditedLead(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Adicione observações sobre este lead..."
                  rows={4}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>

              {/* Created date */}
              <div className="pt-4 border-t text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Criado em {formatDate(lead.created_at)}
              </div>
            </TabsContent>

            {/* Tags Tab */}
            <TabsContent value="tags" className="space-y-4 m-0">
              {/* Current Tags */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags Atuais
                </Label>
                <div className="flex flex-wrap gap-2">
                  {lead.tags && lead.tags.length > 0 ? (
                    lead.tags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="pr-1 flex items-center gap-1"
                        style={{ 
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: tag.color
                        }}
                      >
                        {tag.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 hover:bg-transparent"
                          onClick={() => onRemoveTag(lead.id, tag.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma tag adicionada</p>
                  )}
                </div>
              </div>

              {/* Add Tag */}
              {availableTags.length > 0 && (
                <div className="space-y-2">
                  <Label>Adicionar Tag</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:opacity-80"
                        style={{ 
                          borderColor: tag.color,
                          color: tag.color
                        }}
                        onClick={() => onAddTag(lead.id, tag.id)}
                      >
                        + {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4 m-0">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Atividades
                </Label>
                
                {history.length > 0 ? (
                  <div className="space-y-3">
                    {history.map(entry => (
                      <div 
                        key={entry.id}
                        className="border-l-2 border-muted pl-4 py-2"
                      >
                        <p className="font-medium text-sm">
                          {getActionLabel(entry.action)}
                        </p>
                        {entry.action === 'stage_changed' && entry.from_stage && entry.to_stage && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <span style={{ color: entry.from_stage.color }}>
                              {entry.from_stage.name}
                            </span>
                            <ChevronRight className="h-3 w-3" />
                            <span style={{ color: entry.to_stage.color }}>
                              {entry.to_stage.name}
                            </span>
                          </p>
                        )}
                        {entry.performed_by && (
                          <p className="text-xs text-muted-foreground">
                            Por: {entry.performed_by}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(entry.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum histórico disponível</p>
                )}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
