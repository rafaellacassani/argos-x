import { BotNode } from '@/hooks/useSalesBots';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface WaitNodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
}

const DAYS = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

export function WaitNodeContent({ node, onUpdate }: WaitNodeContentProps) {
  const waitMode = (node.data.wait_mode as string) || 'timer';

  return (
    <div className="space-y-3">
      <select
        className="w-full p-2 text-sm bg-background border rounded"
        value={waitMode}
        onChange={(e) => onUpdate({ wait_mode: e.target.value })}
      >
        <option value="timer">⏱ Cronômetro</option>
        <option value="message">💬 Até mensagem recebida</option>
        <option value="business_hours">🏢 Fora do expediente</option>
      </select>

      {waitMode === 'timer' && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Tempo de espera</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Horas</label>
              <input
                type="number"
                min={0}
                max={23}
                className="w-full p-1.5 text-sm bg-background border rounded text-center"
                value={(node.data.hours as number) || 0}
                onChange={(e) => {
                  const h = parseInt(e.target.value) || 0;
                  const m = (node.data.minutes as number) || 0;
                  const s = (node.data.secs as number) || 0;
                  onUpdate({ hours: h, minutes: m, secs: s, seconds: h * 3600 + m * 60 + s });
                }}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Min</label>
              <input
                type="number"
                min={0}
                max={59}
                className="w-full p-1.5 text-sm bg-background border rounded text-center"
                value={(node.data.minutes as number) || 0}
                onChange={(e) => {
                  const h = (node.data.hours as number) || 0;
                  const m = parseInt(e.target.value) || 0;
                  const s = (node.data.secs as number) || 0;
                  onUpdate({ hours: h, minutes: m, secs: s, seconds: h * 3600 + m * 60 + s });
                }}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Seg</label>
              <input
                type="number"
                min={0}
                max={59}
                className="w-full p-1.5 text-sm bg-background border rounded text-center"
                value={(node.data.secs as number) || 0}
                onChange={(e) => {
                  const h = (node.data.hours as number) || 0;
                  const m = (node.data.minutes as number) || 0;
                  const s = parseInt(e.target.value) || 0;
                  onUpdate({ hours: h, minutes: m, secs: s, seconds: h * 3600 + m * 60 + s });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {waitMode === 'message' && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
          ⏸ O bot pausa e aguarda a próxima mensagem do lead antes de continuar o fluxo.
        </div>
      )}

      {waitMode === 'business_hours' && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Dias da semana</Label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map(({ key, label }) => {
                const days = (node.data.days as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri'];
                const checked = days.includes(key);
                return (
                  <label key={key} className="flex items-center gap-1 text-xs bg-muted/50 rounded px-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const newDays = c ? [...days, key] : days.filter(d => d !== key);
                        onUpdate({ days: newDays, wait_for: 'business_hours' });
                      }}
                      className="h-3 w-3"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Início</label>
              <input
                type="time"
                className="w-full p-1.5 text-sm bg-background border rounded"
                value={(node.data.start as string) || '09:00'}
                onChange={(e) => onUpdate({ start: e.target.value, wait_for: 'business_hours' })}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Fim</label>
              <input
                type="time"
                className="w-full p-1.5 text-sm bg-background border rounded"
                value={(node.data.end as string) || '18:00'}
                onChange={(e) => onUpdate({ end: e.target.value, wait_for: 'business_hours' })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
