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
  Plus
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
import type { Lead, FunnelStage, LeadTag, LeadHistory, LeadSale } from '@/hooks/useLeads';

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
  onSaveSales?: (
    leadId: string, 
    sales: Array<{ id?: string; product_name: string; value: number }>,
    originalSales: LeadSale[]
  ) => Promise<boolean>;
  canDelete?: boolean;
}

interface EditableSale {
  id?: string;
  product_name: string;
  value: number;
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
  onOpenChat,
  onSaveSales,
  canDelete = true
}: LeadDetailSheetProps) {
  const [editedLead, setEditedLead] = useState<Partial<Lead>>({});
  const [editedSales, setEditedSales] = useState<EditableSale[]>([]);
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
      setEditedSales(
        (lead.sales || []).map(s => ({
          id: s.id,
          product_name: s.product_name,
          value: Number(s.value)
        }))
      );
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
      // Save sales if handler provided
      if (onSaveSales) {
        await onSaveSales(lead.id, editedSales, lead.sales || []);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSale = () => {
    setEditedSales(prev => [...prev, { product_name: '', value: 0 }]);
  };

  const handleRemoveSale = (index: number) => {
    setEditedSales(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaleChange = (index: number, field: 'product_name' | 'value', value: string | number) => {
    setEditedSales(prev => prev.map((sale, i) => 
      i === index ? { ...sale, [field]: value } : sale
    ));
  };

  const totalSalesValue = editedSales.reduce((sum, s) => sum + Number(s.value || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col p-0">
        {/* Dark Header with Stage Selector */}
        <div className="bg-[#060369] text-white p-6 space-y-4">
          {/* Lead Info Row */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-white/20">
              <AvatarImage src={lead.avatar_url} alt={lead.name} />
              <AvatarFallback className="bg-white/10 text-white text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <SheetHeader className="p-0 space-y-0">
                <SheetTitle className="text-xl font-bold truncate text-white">{lead.name}</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-2 mt-1">
                {lead.source === 'whatsapp' && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Stage & Tags Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Stage Selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80 text-sm">
                <ChevronRight className="h-4 w-4" />
                Fase do Lead
              </Label>
              <Select
                value={lead.stage_id || ""}
                onValueChange={(value) => { if (value) onMove(lead.id, value); }}
              >
                <SelectTrigger className="bg-white/10 border-white/20 text-white hover:bg-white/20 focus:ring-white/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!lead.stage_id && (
                    <SelectItem value="" disabled>Sem etapa definida</SelectItem>
                  )}
                  {stages.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-white/80 text-sm">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[40px] p-2 bg-white/10 border border-white/20 rounded-md">
                {lead.tags && lead.tags.length > 0 ? (
                  lead.tags.map(tag => (
                    <Badge
                      key={tag.id}
                      className="text-xs px-2 py-0.5 pr-1 flex items-center gap-1"
                      style={{ 
                        backgroundColor: `${tag.color}40`,
                        color: 'white',
                        borderColor: tag.color
                      }}
                    >
                      {tag.name}
                      <button
                        className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                        onClick={() => onRemoveTag(lead.id, tag.id)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-white/50 text-sm">Sem tags</span>
                )}
                {availableTags.length > 0 && (
                  <Select onValueChange={(tagId) => onAddTag(lead.id, tagId)}>
                    <SelectTrigger className="h-6 w-6 p-0 bg-white/20 border-0 hover:bg-white/30 [&>svg]:hidden">
                      <span className="text-white text-lg leading-none">+</span>
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            {lead.whatsapp_jid && onOpenChat && (
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={() => onOpenChat(lead.whatsapp_jid!)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir Chat
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              asChild
            >
              <a href={`tel:${lead.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                Ligar
              </a>
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200"
                  >
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
            )}
          </div>
        </div>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col p-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Info Tab */}
            <TabsContent value="info" className="space-y-4 m-0">
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

              {/* Sales Section */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <DollarSign className="h-4 w-4" />
                    Vendas
                  </Label>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Total: {formatCurrency(totalSalesValue)}
                  </span>
                </div>
                
                {editedSales.length > 0 ? (
                  <div className="space-y-2">
                    {editedSales.map((sale, index) => (
                      <div key={sale.id || `new-${index}`} className="flex items-center gap-2">
                        <Input
                          placeholder="Produto/Serviço"
                          value={sale.product_name}
                          onChange={(e) => handleSaleChange(index, 'product_name', e.target.value)}
                          className="flex-1"
                        />
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={sale.value || ''}
                            onChange={(e) => handleSaleChange(index, 'value', parseFloat(e.target.value) || 0)}
                            className="pl-8"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveSale(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAddSale}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar nova venda
                </Button>
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
