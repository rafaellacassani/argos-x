import { useState, useEffect, useCallback } from 'react';
import { Filter, X, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfQuarter, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { FunnelStage, LeadTag } from '@/hooks/useLeads';
import type { UserProfile } from '@/hooks/useTeam';

// ---- Types ----
export interface LeadFiltersData {
  responsibleUserIds: string[];
  tagIds: string[];
  valueMin: number | null;
  valueMax: number | null;
  product: string;
  dateType: 'created_at' | 'sale_date';
  datePreset: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  visibleStageIds: string[];
  sources: string[];
}

export const DEFAULT_FILTERS: LeadFiltersData = {
  responsibleUserIds: [],
  tagIds: [],
  valueMin: null,
  valueMax: null,
  product: '',
  dateType: 'created_at',
  datePreset: null,
  dateFrom: null,
  dateTo: null,
  visibleStageIds: [],
  sources: [],
};

const DATE_PRESETS = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last7', label: 'Últimos 7 dias' },
  { id: 'last30', label: 'Últimos 30 dias' },
  { id: 'this_week', label: 'Esta semana' },
  { id: 'last_week', label: 'Última semana' },
  { id: 'this_month', label: 'Este mês' },
  { id: 'last_month', label: 'Último mês' },
  { id: 'this_quarter', label: 'Este trimestre' },
  { id: 'this_year', label: 'Este ano' },
] as const;

const SOURCE_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'import', label: 'Importação' },
  { id: 'manual', label: 'Manual' },
];

export function getDateRange(preset: string): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'last7': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last30': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case 'last_week': {
      const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      return { from: lastWeekStart, to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }) };
    }
    case 'this_month': return { from: startOfMonth(now), to: endOfDay(now) };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case 'this_quarter': return { from: startOfQuarter(now), to: endOfDay(now) };
    case 'this_year': return { from: startOfYear(now), to: endOfDay(now) };
    default: return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export function countActiveFilters(filters: LeadFiltersData, allStageIds: string[]): number {
  let count = 0;
  if (filters.responsibleUserIds.length > 0) count++;
  if (filters.tagIds.length > 0) count++;
  if (filters.valueMin !== null || filters.valueMax !== null) count++;
  if (filters.product.trim()) count++;
  if (filters.datePreset || filters.dateFrom) count++;
  if (filters.sources.length > 0) count++;
  // Stage filter counts only if some stages are hidden
  if (filters.visibleStageIds.length > 0 && filters.visibleStageIds.length < allStageIds.length) count++;
  return count;
}

interface LeadFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: LeadFiltersData;
  onApply: (filters: LeadFiltersData) => void;
  stages: FunnelStage[];
  tags: LeadTag[];
  teamMembers: UserProfile[];
  products: string[];
}

export function LeadFilters({
  open, onOpenChange, filters, onApply, stages, tags, teamMembers, products
}: LeadFiltersProps) {
  const [draft, setDraft] = useState<LeadFiltersData>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const toggleArray = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleClear = () => {
    const cleared: LeadFiltersData = {
      ...DEFAULT_FILTERS,
      visibleStageIds: stages.map(s => s.id),
    };
    setDraft(cleared);
    onApply(cleared);
    onOpenChange(false);
  };

  // Sellers only
  const sellers = teamMembers.filter(m =>
    m.roles.includes('seller') || m.roles.includes('manager') || m.roles.includes('admin')
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {/* ===== LEAD PROPERTIES ===== */}
            <FilterSection title="PROPRIEDADES DO LEAD" defaultOpen>
              {/* Responsável */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sellers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                      <Checkbox
                        checked={draft.responsibleUserIds.includes(s.id)}
                        onCheckedChange={() =>
                          setDraft(d => ({ ...d, responsibleUserIds: toggleArray(d.responsibleUserIds, s.id) }))
                        }
                      />
                      {s.full_name}
                    </label>
                  ))}
                  {sellers.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum membro encontrado</p>
                  )}
                </div>
              </div>

              <Separator className="my-3" />

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Tags (qualquer uma)</Label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {tags.map(tag => {
                    const selected = draft.tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setDraft(d => ({ ...d, tagIds: toggleArray(d.tagIds, tag.id) }))}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-colors',
                          selected
                            ? 'ring-2 ring-offset-1 ring-primary'
                            : 'opacity-70 hover:opacity-100'
                        )}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          borderColor: `${tag.color}40`,
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                  {tags.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma tag criada</p>
                  )}
                </div>
              </div>

              <Separator className="my-3" />

              {/* Value Range */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Valor de venda</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="De R$"
                      value={draft.valueMin ?? ''}
                      onChange={e => setDraft(d => ({
                        ...d,
                        valueMin: e.target.value ? Number(e.target.value) : null,
                      }))}
                      className="h-9"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">até</span>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="Até R$"
                      value={draft.valueMax ?? ''}
                      onChange={e => setDraft(d => ({
                        ...d,
                        valueMax: e.target.value ? Number(e.target.value) : null,
                      }))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Products */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Produtos</Label>
                <Input
                  placeholder="Buscar produto..."
                  value={draft.product}
                  onChange={e => setDraft(d => ({ ...d, product: e.target.value }))}
                  className="h-9"
                  list="product-suggestions"
                />
                <datalist id="product-suggestions">
                  {products.map(p => <option key={p} value={p} />)}
                </datalist>
              </div>
            </FilterSection>

            {/* ===== DATES ===== */}
            <FilterSection title="DATAS">
              <div className="space-y-3">
                {/* Date type toggle */}
                <div className="flex gap-2">
                  {(['created_at', 'sale_date'] as const).map(dt => (
                    <Button
                      key={dt}
                      variant={draft.dateType === dt ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setDraft(d => ({ ...d, dateType: dt }))}
                    >
                      {dt === 'created_at' ? 'Data de criação' : 'Data de fechamento'}
                    </Button>
                  ))}
                </div>

                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {DATE_PRESETS.map(p => (
                    <Button
                      key={p.id}
                      variant={draft.datePreset === p.id ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDraft(d => ({
                        ...d,
                        datePreset: d.datePreset === p.id ? null : p.id,
                        dateFrom: null,
                        dateTo: null,
                      }))}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                {/* Custom date range */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Período personalizado</Label>
                  <div className="flex gap-2">
                    <DatePickerButton
                      date={draft.dateFrom}
                      onChange={d => setDraft(prev => ({ ...prev, dateFrom: d, datePreset: null }))}
                      placeholder="Início"
                    />
                    <DatePickerButton
                      date={draft.dateTo}
                      onChange={d => setDraft(prev => ({ ...prev, dateTo: d, datePreset: null }))}
                      placeholder="Fim"
                    />
                  </div>
                </div>
              </div>
            </FilterSection>

            {/* ===== STAGES ===== */}
            <FilterSection title="ETAPAS">
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm py-1 font-medium">
                  <Checkbox
                    checked={draft.visibleStageIds.length === stages.length}
                    onCheckedChange={(checked) =>
                      setDraft(d => ({
                        ...d,
                        visibleStageIds: checked ? stages.map(s => s.id) : [],
                      }))
                    }
                  />
                  Selecionar todas
                </label>
                <Separator className="my-1" />
                {stages.map(stage => (
                  <label key={stage.id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                    <Checkbox
                      checked={draft.visibleStageIds.includes(stage.id)}
                      onCheckedChange={() =>
                        setDraft(d => ({
                          ...d,
                          visibleStageIds: toggleArray(d.visibleStageIds, stage.id),
                        }))
                      }
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* ===== SOURCE ===== */}
            <FilterSection title="FONTE DO LEAD">
              <div className="space-y-1">
                {SOURCE_OPTIONS.map(src => (
                  <label key={src.id} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                    <Checkbox
                      checked={draft.sources.includes(src.id)}
                      onCheckedChange={() =>
                        setDraft(d => ({ ...d, sources: toggleArray(d.sources, src.id) }))
                      }
                    />
                    {src.label}
                  </label>
                ))}
              </div>
            </FilterSection>
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t flex gap-2">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            Limpar filtros
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---- Helper components ----

function FilterSection({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground transition-colors">
        {title}
        <span className="text-lg leading-none">{open ? '−' : '+'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DatePickerButton({ date, onChange, placeholder }: {
  date: Date | null; onChange: (d: Date | undefined) => void; placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(
          'h-9 flex-1 justify-start text-left text-xs font-normal',
          !date && 'text-muted-foreground'
        )}>
          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
          {date ? format(date, 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={onChange}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
