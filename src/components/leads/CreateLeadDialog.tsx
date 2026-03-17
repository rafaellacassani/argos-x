import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCustomFields, type CustomFieldDefinition } from '@/hooks/useCustomFields';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    name: string;
    phone: string;
    email?: string;
    company?: string;
    value?: number;
    stage_id?: string;
  }) => Promise<unknown>;
  defaultStageId?: string;
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  onCreate,
  defaultStageId
}: CreateLeadDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    value: 0
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const { definitions, saveLeadCustomValues } = useCustomFields();

  // Reset custom values when dialog opens
  useEffect(() => {
    if (open) {
      setCustomValues({});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    setIsCreating(true);
    try {
      const result = await onCreate({
        ...formData,
        stage_id: defaultStageId
      }) as any;

      // Save custom field values if we got a lead ID back
      const leadId = result?.id || result?.data?.id;
      if (leadId && Object.keys(customValues).length > 0) {
        await saveLeadCustomValues(leadId, customValues);
      }

      setFormData({ name: '', phone: '', email: '', company: '', value: 0 });
      setCustomValues({});
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const renderCustomField = (def: CustomFieldDefinition) => {
    const value = customValues[def.id] || '';
    switch (def.field_type) {
      case 'boolean':
        return (
          <div key={def.id} className="flex items-center justify-between">
            <Label>{def.field_label}</Label>
            <Switch
              checked={value === 'true'}
              onCheckedChange={(checked) =>
                setCustomValues(prev => ({ ...prev, [def.id]: checked ? 'true' : 'false' }))
              }
            />
          </div>
        );
      case 'select':
        return (
          <div key={def.id} className="space-y-2">
            <Label>{def.field_label}</Label>
            <Select value={value} onValueChange={v => setCustomValues(prev => ({ ...prev, [def.id]: v }))}>
              <SelectTrigger><SelectValue placeholder={`Selecione ${def.field_label}`} /></SelectTrigger>
              <SelectContent>
                {def.options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'number':
        return (
          <div key={def.id} className="space-y-2">
            <Label>{def.field_label}</Label>
            <Input
              type="number"
              value={value}
              onChange={e => setCustomValues(prev => ({ ...prev, [def.id]: e.target.value }))}
              placeholder={def.field_label}
            />
          </div>
        );
      case 'date':
        return (
          <div key={def.id} className="space-y-2">
            <Label>{def.field_label}</Label>
            <Input
              type="date"
              value={value}
              onChange={e => setCustomValues(prev => ({ ...prev, [def.id]: e.target.value }))}
            />
          </div>
        );
      default:
        return (
          <div key={def.id} className="space-y-2">
            <Label>{def.field_label}</Label>
            <Input
              value={value}
              onChange={e => setCustomValues(prev => ({ ...prev, [def.id]: e.target.value }))}
              placeholder={def.field_label}
            />
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Novo Lead
          </DialogTitle>
          <DialogDescription>
            Adicione um novo lead ao funil de vendas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do lead"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="(11) 99999-9999"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor da Venda (R$)</Label>
            <Input
              id="value"
              type="number"
              min="0"
              step="0.01"
              value={formData.value}
              onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
              placeholder="0,00"
            />
          </div>

          {/* Custom fields */}
          {definitions.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campos Personalizados
              </p>
              {definitions.map(renderCustomField)}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isCreating || !formData.name || !formData.phone}
            >
              {isCreating ? 'Criando...' : 'Criar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
