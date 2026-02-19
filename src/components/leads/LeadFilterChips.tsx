import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LeadFiltersData } from './LeadFilters';
import type { FunnelStage, LeadTag } from '@/hooks/useLeads';
import type { UserProfile } from '@/hooks/useTeam';

interface LeadFilterChipsProps {
  filters: LeadFiltersData;
  stages: FunnelStage[];
  tags: LeadTag[];
  teamMembers: UserProfile[];
  onRemove: (updatedFilters: LeadFiltersData) => void;
}

const DATE_PRESET_LABELS: Record<string, string> = {
  today: 'Hoje', yesterday: 'Ontem', last7: 'Últimos 7 dias', last30: 'Últimos 30 dias',
  this_week: 'Esta semana', last_week: 'Última semana', this_month: 'Este mês',
  last_month: 'Último mês', this_quarter: 'Este trimestre', this_year: 'Este ano',
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram',
  import: 'Importação', manual: 'Manual',
};

export function LeadFilterChips({ filters, stages, tags, teamMembers, onRemove }: LeadFilterChipsProps) {
  const chips: { label: string; onRemove: () => void }[] = [];

  // Responsible users
  filters.responsibleUserIds.forEach(id => {
    const member = teamMembers.find(m => m.id === id);
    if (member) {
      chips.push({
        label: `Responsável: ${member.full_name}`,
        onRemove: () => onRemove({
          ...filters,
          responsibleUserIds: filters.responsibleUserIds.filter(x => x !== id),
        }),
      });
    }
  });

  // Tags
  filters.tagIds.forEach(id => {
    const tag = tags.find(t => t.id === id);
    if (tag) {
      chips.push({
        label: `Tag: ${tag.name}`,
        onRemove: () => onRemove({
          ...filters,
          tagIds: filters.tagIds.filter(x => x !== id),
        }),
      });
    }
  });

  // Value range
  if (filters.valueMin !== null || filters.valueMax !== null) {
    const parts: string[] = [];
    if (filters.valueMin !== null) parts.push(`De R$${filters.valueMin}`);
    if (filters.valueMax !== null) parts.push(`Até R$${filters.valueMax}`);
    chips.push({
      label: `Valor: ${parts.join(' ')}`,
      onRemove: () => onRemove({ ...filters, valueMin: null, valueMax: null }),
    });
  }

  // Product
  if (filters.product.trim()) {
    chips.push({
      label: `Produto: ${filters.product}`,
      onRemove: () => onRemove({ ...filters, product: '' }),
    });
  }

  // Date
  if (filters.datePreset) {
    chips.push({
      label: `Período: ${DATE_PRESET_LABELS[filters.datePreset] || filters.datePreset}`,
      onRemove: () => onRemove({ ...filters, datePreset: null, dateFrom: null, dateTo: null }),
    });
  } else if (filters.dateFrom || filters.dateTo) {
    chips.push({
      label: 'Período personalizado',
      onRemove: () => onRemove({ ...filters, dateFrom: null, dateTo: null }),
    });
  }

  // Sources
  filters.sources.forEach(src => {
    chips.push({
      label: `Fonte: ${SOURCE_LABELS[src] || src}`,
      onRemove: () => onRemove({ ...filters, sources: filters.sources.filter(x => x !== src) }),
    });
  });

  // Hidden stages
  const hiddenStages = stages.filter(s => !filters.visibleStageIds.includes(s.id));
  if (hiddenStages.length > 0 && hiddenStages.length < stages.length) {
    chips.push({
      label: `${hiddenStages.length} etapa(s) oculta(s)`,
      onRemove: () => onRemove({ ...filters, visibleStageIds: stages.map(s => s.id) }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1">
          {chip.label}
          <button
            onClick={chip.onRemove}
            className="ml-0.5 rounded-full hover:bg-muted p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
