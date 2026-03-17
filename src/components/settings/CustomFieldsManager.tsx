import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, GripVertical, Settings2 } from 'lucide-react';
import { useCustomFields, type CustomFieldDefinition } from '@/hooks/useCustomFields';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'boolean', label: 'Sim/Não' },
];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function CustomFieldsManager() {
  const {
    allDefinitions, loading,
    createDefinition, updateDefinition, deleteDefinition,
  } = useCustomFields();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Form state
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  const handleLabelChange = (val: string) => {
    setFieldLabel(val);
    if (!keyManuallyEdited) {
      setFieldKey(slugify(val));
    }
  };

  const resetForm = () => {
    setFieldLabel('');
    setFieldKey('');
    setFieldType('text');
    setFieldOptions('');
    setKeyManuallyEdited(false);
  };

  const handleCreate = async () => {
    if (!fieldLabel || !fieldKey) return;
    setCreating(true);
    const options = fieldType === 'select'
      ? fieldOptions.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    await createDefinition({ field_label: fieldLabel, field_key: fieldKey, field_type: fieldType, options });
    setCreating(false);
    setCreateOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteDefinition(deleteId);
    setDeleteId(null);
  };

  const handleToggle = (def: CustomFieldDefinition) => {
    updateDefinition(def.id, { is_active: !def.is_active });
  };

  const typeLabel = (t: string) => FIELD_TYPES.find(f => f.value === t)?.label || t;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Campos Personalizados
            </CardTitle>
            <CardDescription>
              Crie campos extras para capturar informações específicas dos leads
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo Campo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : allDefinitions.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Settings2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhum campo personalizado criado</p>
            <p className="text-xs text-muted-foreground">
              Campos personalizados aparecem nos formulários de lead e podem ser preenchidos via webhook
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Opções</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allDefinitions.map(def => (
                <TableRow key={def.id}>
                  <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="font-medium">{def.field_label}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{def.field_key}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{typeLabel(def.field_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    {def.field_type === 'select' && def.options.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {def.options.slice(0, 3).map((o, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{o}</Badge>
                        ))}
                        {def.options.length > 3 && (
                          <Badge variant="secondary" className="text-[10px]">+{def.options.length - 3}</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={def.is_active} onCheckedChange={() => handleToggle(def)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteId(def.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Campo Personalizado</DialogTitle>
            <DialogDescription>
              Defina um campo extra que será exibido nos leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do campo *</Label>
              <Input value={fieldLabel} onChange={e => handleLabelChange(e.target.value)}
                placeholder="Ex: CPF, Interesse, Origem da Campanha" />
            </div>
            <div className="space-y-2">
              <Label>Chave (slug) *</Label>
              <Input value={fieldKey}
                onChange={e => { setFieldKey(e.target.value); setKeyManuallyEdited(true); }}
                placeholder="ex: cpf, interesse" />
              <p className="text-xs text-muted-foreground">
                Usada no webhook e API para identificar o campo
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldType === 'select' && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input value={fieldOptions} onChange={e => setFieldOptions(e.target.value)}
                  placeholder="Opção A, Opção B, Opção C" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !fieldLabel || !fieldKey}>
              {creating ? 'Criando...' : 'Criar Campo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os valores preenchidos neste campo serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
