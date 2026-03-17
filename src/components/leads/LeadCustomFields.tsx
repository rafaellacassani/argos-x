import { useState, useEffect } from 'react';
import { Settings2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCustomFields, type CustomFieldDefinition } from '@/hooks/useCustomFields';

interface LeadCustomFieldsProps {
  leadId: string;
  onSave?: (fieldDefId: string, value: string) => void;
}

function InlineCustomField({
  def,
  value,
  onSave,
}: {
  def: CustomFieldDefinition;
  value: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const save = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (def.field_type === 'boolean') {
    return (
      <div className="flex items-center justify-between py-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{def.field_label}</p>
        <Switch checked={value === 'true'} onCheckedChange={checked => onSave(checked ? 'true' : 'false')} />
      </div>
    );
  }

  if (def.field_type === 'select') {
    return (
      <div className="py-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{def.field_label}</p>
        <Select value={value || ''} onValueChange={v => onSave(v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={`Selecione`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">— Limpar —</SelectItem>
            {def.options.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group py-1">
      <Settings2 className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{def.field_label}</p>
        {editing ? (
          <Input
            type={def.field_type === 'number' ? 'number' : def.field_type === 'date' ? 'date' : 'text'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onBlur={save}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        ) : (
          <div
            className="text-sm cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-h-[20px]"
            onClick={() => setEditing(true)}
          >
            {value || <span className="text-muted-foreground italic text-xs">Clique para preencher</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadCustomFields({ leadId }: LeadCustomFieldsProps) {
  const { definitions, getLeadCustomValues, saveLeadCustomValue } = useCustomFields();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!leadId) return;
    getLeadCustomValues(leadId).then(setValues);
  }, [leadId, getLeadCustomValues]);

  if (definitions.length === 0) return null;

  const handleSave = async (fieldDefId: string, val: string) => {
    const cleanVal = val === '__clear__' ? '' : val;
    setValues(prev => ({ ...prev, [fieldDefId]: cleanVal }));
    await saveLeadCustomValue(leadId, fieldDefId, cleanVal);
  };

  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-foreground mb-2">Campos Personalizados</p>
      {definitions.map(def => (
        <InlineCustomField
          key={def.id}
          def={def}
          value={values[def.id] || ''}
          onSave={val => handleSave(def.id, val)}
        />
      ))}
    </div>
  );
}
