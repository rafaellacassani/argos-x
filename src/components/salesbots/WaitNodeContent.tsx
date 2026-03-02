import { BotNode } from '@/hooks/useSalesBots';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface WaitCondition {
  id: string;
  type: 'message_received' | 'timer' | 'business_hours';
  label: string;
  config: Record<string, unknown>;
  order: number;
}

const CONDITION_TYPES = [
  { value: 'message_received', label: '💬 Se responder', icon: '💬' },
  { value: 'timer', label: '⏱ Cronômetro', icon: '⏱' },
  { value: 'business_hours', label: '🏢 Fora do expediente', icon: '🏢' },
] as const;

const DAYS = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

/**
 * Convert legacy wait_mode nodes to new conditions format
 */
export function migrateWaitConditions(data: Record<string, unknown>): WaitCondition[] {
  // Already migrated
  if (Array.isArray(data.conditions) && data.conditions.length > 0) {
    return data.conditions as WaitCondition[];
  }

  const waitMode = (data.wait_mode as string) || 'timer';

  if (waitMode === 'message' || data.wait_for === 'message' || data.wait_mode === 'wait_message') {
    return [{
      id: `cond_${Date.now()}_1`,
      type: 'message_received',
      label: 'Se responder',
      config: {},
      order: 0,
    }];
  }

  if (waitMode === 'business_hours' || data.wait_for === 'business_hours') {
    return [{
      id: `cond_${Date.now()}_1`,
      type: 'business_hours',
      label: 'Horário comercial',
      config: {
        days: (data.days as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri'],
        start: (data.start as string) || '09:00',
        end: (data.end as string) || '18:00',
      },
      order: 0,
    }];
  }

  // timer (default)
  const seconds = (data.seconds as number) || 0;
  const hours = (data.hours as number) || Math.floor(seconds / 3600);
  const minutes = (data.minutes as number) || Math.floor((seconds % 3600) / 60);
  const secs = (data.secs as number) || (seconds % 60);

  return [{
    id: `cond_${Date.now()}_1`,
    type: 'timer',
    label: 'Cronômetro',
    config: { hours, minutes, secs, seconds: hours * 3600 + minutes * 60 + secs },
    order: 0,
  }];
}

interface WaitNodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function WaitNodeContent({ node, onUpdate }: WaitNodeContentProps) {
  const conditions = migrateWaitConditions(node.data);

  const updateConditions = (newConditions: WaitCondition[]) => {
    onUpdate({ conditions: newConditions });
  };

  const addCondition = () => {
    const newCond: WaitCondition = {
      id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'timer',
      label: 'Cronômetro',
      config: { hours: 0, minutes: 30, secs: 0, seconds: 1800 },
      order: conditions.length,
    };
    updateConditions([...conditions, newCond]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length <= 1) return;
    updateConditions(conditions.filter(c => c.id !== id).map((c, i) => ({ ...c, order: i })));
  };

  const updateCondition = (id: string, updates: Partial<WaitCondition>) => {
    updateConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const updateConditionConfig = (id: string, configUpdates: Record<string, unknown>) => {
    updateConditions(conditions.map(c =>
      c.id === id ? { ...c, config: { ...c.config, ...configUpdates } } : c
    ));
  };

  return (
    <div className="space-y-2">
      {conditions.map((cond, idx) => (
        <div key={cond.id} className="border rounded-lg p-2.5 space-y-2 bg-muted/30">
          <div className="flex items-center gap-1.5">
            <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              {idx + 1}
            </span>
            <select
              className="flex-1 p-1 text-xs bg-background border rounded"
              value={cond.type}
              onChange={(e) => {
                const newType = e.target.value as WaitCondition['type'];
                const labelMap: Record<string, string> = {
                  message_received: 'Se responder',
                  timer: 'Cronômetro',
                  business_hours: 'Horário comercial',
                };
                const defaultConfig: Record<string, Record<string, unknown>> = {
                  message_received: {},
                  timer: { hours: 0, minutes: 30, secs: 0, seconds: 1800 },
                  business_hours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '09:00', end: '18:00' },
                };
                updateCondition(cond.id, {
                  type: newType,
                  label: labelMap[newType] || newType,
                  config: defaultConfig[newType] || {},
                });
              }}
            >
              {CONDITION_TYPES.map(ct => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
            {conditions.length > 1 && (
              <button
                className="p-0.5 text-destructive/60 hover:text-destructive transition-colors"
                onClick={() => removeCondition(cond.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Editable label */}
          <input
            type="text"
            className="w-full p-1 text-xs bg-background border rounded"
            placeholder="Label da saída..."
            value={cond.label}
            onChange={(e) => updateCondition(cond.id, { label: e.target.value })}
          />

          {/* Config by type */}
          {cond.type === 'message_received' && (
            <div className="text-[10px] text-muted-foreground p-1.5 bg-muted/50 rounded">
              ⏸ Aguarda a próxima mensagem do lead
            </div>
          )}

          {cond.type === 'timer' && (
            <TimerConfig
              config={cond.config}
              onChange={(cfg) => updateConditionConfig(cond.id, cfg)}
            />
          )}

          {cond.type === 'business_hours' && (
            <BusinessHoursConfig
              config={cond.config}
              onChange={(cfg) => updateConditionConfig(cond.id, cfg)}
            />
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs gap-1"
        onClick={addCondition}
      >
        <Plus className="w-3 h-3" />
        Adicionar condição
      </Button>
    </div>
  );
}

function TimerConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const h = (config.hours as number) || 0;
  const m = (config.minutes as number) || 0;
  const s = (config.secs as number) || 0;

  const update = (hours: number, minutes: number, secs: number) => {
    onChange({ hours, minutes, secs, seconds: hours * 3600 + minutes * 60 + secs });
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <div>
        <label className="text-[10px] text-muted-foreground">Horas</label>
        <input type="number" min={0} max={23} className="w-full p-1 text-xs bg-background border rounded text-center"
          value={h} onChange={(e) => update(parseInt(e.target.value) || 0, m, s)} />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Min</label>
        <input type="number" min={0} max={59} className="w-full p-1 text-xs bg-background border rounded text-center"
          value={m} onChange={(e) => update(h, parseInt(e.target.value) || 0, s)} />
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Seg</label>
        <input type="number" min={0} max={59} className="w-full p-1 text-xs bg-background border rounded text-center"
          value={s} onChange={(e) => update(h, m, parseInt(e.target.value) || 0)} />
      </div>
    </div>
  );
}

function BusinessHoursConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (cfg: Record<string, unknown>) => void }) {
  const days = (config.days as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri'];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {DAYS.map(({ key, label }) => {
          const checked = days.includes(key);
          return (
            <label key={key} className="flex items-center gap-0.5 text-[10px] bg-muted/50 rounded px-1.5 py-0.5 cursor-pointer">
              <Checkbox
                checked={checked}
                onCheckedChange={(c) => {
                  const newDays = c ? [...days, key] : days.filter(d => d !== key);
                  onChange({ days: newDays });
                }}
                className="h-2.5 w-2.5"
              />
              {label}
            </label>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground">Início</label>
          <input type="time" className="w-full p-1 text-xs bg-background border rounded"
            value={(config.start as string) || '09:00'}
            onChange={(e) => onChange({ start: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Fim</label>
          <input type="time" className="w-full p-1 text-xs bg-background border rounded"
            value={(config.end as string) || '18:00'}
            onChange={(e) => onChange({ end: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
