import { useState, useEffect, useCallback } from 'react';
import { X, Zap, Bot, Bell, User, Tag, CheckSquare, Trash2, Plus, Pencil, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStageAutomations, StageAutomation } from '@/hooks/useStageAutomations';
import type { FunnelStage, LeadTag } from '@/hooks/useLeads';

interface FunnelAutomationsPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FunnelStage[];
  tags: LeadTag[];
  teamMembers: Array<{ id: string; full_name: string }>;
  funnelName?: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  run_bot: <Bot className="h-4 w-4 text-primary" />,
  notify_responsible: <Bell className="h-4 w-4 text-amber-500" />,
  change_responsible: <User className="h-4 w-4 text-blue-500" />,
  add_tag: <Tag className="h-4 w-4 text-emerald-500" />,
  remove_tag: <Tag className="h-4 w-4 text-red-500" />,
  create_task: <CheckSquare className="h-4 w-4 text-violet-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  run_bot: 'Executar SalesBot',
  notify_responsible: 'Notificar responsável',
  change_responsible: 'Mudar responsável',
  add_tag: 'Aplicar tag',
  remove_tag: 'Remover tag',
  create_task: 'Criar tarefa',
};

const TRIGGER_LABELS: Record<string, string> = {
  on_enter: 'Ao entrar',
  on_exit: 'Ao sair',
  after_time: 'Após tempo',
};

type FormData = {
  trigger: 'on_enter' | 'on_exit' | 'after_time';
  trigger_delay_hours: number;
  action_type: string;
  action_config: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value: string }>;
};

const DEFAULT_FORM: FormData = {
  trigger: 'on_enter',
  trigger_delay_hours: 0,
  action_type: 'run_bot',
  action_config: {},
  conditions: [],
};

export function FunnelAutomationsPage({
  open,
  onOpenChange,
  stages,
  tags,
  teamMembers,
  funnelName,
}: FunnelAutomationsPageProps) {
  const {
    fetchAutomations, createAutomation, updateAutomation,
    deleteAutomation, toggleAutomation,
  } = useStageAutomations();

  const [allAutomations, setAllAutomations] = useState<Record<string, StageAutomation[]>>({});
  const [loadingStages, setLoadingStages] = useState(false);
  const [bots, setBots] = useState<Array<{ id: string; name: string; is_active: boolean }>>([]);

  // Sheet form state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // automation id or 'new'
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [conditionsOpen, setConditionsOpen] = useState(false);

  const loadAllAutomations = useCallback(async () => {
    if (stages.length === 0) return;
    setLoadingStages(true);
    const result: Record<string, StageAutomation[]> = {};
    await Promise.all(
      stages.map(async (stage) => {
        const autos = await fetchAutomations(stage.id);
        result[stage.id] = autos || [];
      })
    );
    setAllAutomations(result);
    setLoadingStages(false);
  }, [stages, fetchAutomations]);

  useEffect(() => {
    if (open) {
      loadAllAutomations();
      fetchBots();
    }
  }, [open, loadAllAutomations]);

  const fetchBots = async () => {
    const { data } = await supabase
      .from('salesbots')
      .select('id, name, is_active')
      .order('name');
    if (data) setBots(data);
  };

  const handleAdd = (stageId: string) => {
    setEditingStageId(stageId);
    setEditingId('new');
    setForm({ ...DEFAULT_FORM });
    setConditionsOpen(false);
    setSheetOpen(true);
  };

  const handleEdit = (stageId: string, auto: StageAutomation) => {
    setEditingStageId(stageId);
    setEditingId(auto.id);
    setForm({
      trigger: auto.trigger,
      trigger_delay_hours: auto.trigger_delay_hours,
      action_type: auto.action_type,
      action_config: { ...auto.action_config },
      conditions: [...auto.conditions],
    });
    setConditionsOpen(auto.conditions.length > 0);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!editingStageId) return;
    const stageAutos = allAutomations[editingStageId] || [];
    const payload = {
      stage_id: editingStageId,
      trigger: form.trigger,
      trigger_delay_hours: form.trigger === 'after_time' ? form.trigger_delay_hours : 0,
      action_type: form.action_type as StageAutomation['action_type'],
      action_config: form.action_config,
      conditions: form.conditions,
      is_active: true,
      position: stageAutos.length,
    };

    if (editingId === 'new') {
      const created = await createAutomation(payload);
      if (created) {
        setAllAutomations(prev => ({
          ...prev,
          [editingStageId]: [...(prev[editingStageId] || []), created],
        }));
      }
    } else if (editingId) {
      const updated = await updateAutomation(editingId, payload);
      if (updated) {
        setAllAutomations(prev => ({
          ...prev,
          [editingStageId]: (prev[editingStageId] || []).map(a => a.id === editingId ? updated : a),
        }));
      }
    }
    setSheetOpen(false);
  };

  const handleDelete = async (stageId: string, id: string) => {
    await deleteAutomation(id);
    setAllAutomations(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || []).filter(a => a.id !== id),
    }));
  };

  const handleToggle = async (stageId: string, id: string, active: boolean) => {
    await toggleAutomation(id, active);
    setAllAutomations(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || []).map(a => a.id === id ? { ...a, is_active: active } : a),
    }));
  };

  const getActionSummary = (auto: StageAutomation) => {
    const label = ACTION_LABELS[auto.action_type] || auto.action_type;
    const config = auto.action_config;
    if (auto.action_type === 'run_bot' && config.bot_id) {
      const bot = bots.find(b => b.id === config.bot_id);
      return bot?.name ? `${label}: ${bot.name}` : label;
    }
    if ((auto.action_type === 'add_tag' || auto.action_type === 'remove_tag') && config.tag_id) {
      const tag = tags.find(t => t.id === config.tag_id);
      return tag?.name ? `${label}: ${tag.name}` : label;
    }
    if (auto.action_type === 'create_task' && config.title) {
      return `${label}: ${config.title}`;
    }
    return label;
  };

  const getTriggerBadge = (auto: StageAutomation) => {
    if (auto.trigger === 'after_time') {
      const h = auto.trigger_delay_hours;
      if (h >= 24 && h % 24 === 0) return `Após ${h / 24}d`;
      return `Após ${h}h`;
    }
    return TRIGGER_LABELS[auto.trigger];
  };

  // Condition helpers
  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'source', operator: 'equals', value: '' }],
    }));
  };
  const removeCondition = (idx: number) => {
    setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== idx) }));
  };
  const updateCondition = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-background shrink-0">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-foreground">
                Automações do Funil {funnelName ? `— ${funnelName}` : ''}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Body: horizontal scroll with stage columns */}
          <ScrollArea className="flex-1">
            <div className="flex gap-4 p-6 min-h-full">
              {stages.map(stage => {
                const autos = allAutomations[stage.id] || [];
                return (
                  <div key={stage.id} className="flex flex-col min-w-[280px] max-w-[300px] shrink-0">
                    {/* Stage header */}
                    <div
                      className="flex items-center gap-2 p-3 rounded-t-lg"
                      style={{ backgroundColor: `${stage.color}15` }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="font-semibold text-sm text-foreground truncate">{stage.name}</h3>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {autos.filter(a => a.is_active).length}
                      </Badge>
                    </div>

                    {/* Automations list */}
                    <div className="flex-1 border border-t-0 rounded-b-lg p-2 space-y-2 min-h-[200px]"
                      style={{ borderColor: `${stage.color}30` }}>
                      {autos.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          Nenhuma automação
                        </p>
                      )}
                      {autos.map(auto => (
                        <div
                          key={auto.id}
                          className="rounded-lg border bg-card p-3 space-y-2 transition-colors hover:bg-muted/30"
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">
                              {ACTION_ICONS[auto.action_type]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight truncate">
                                {getActionSummary(auto)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                              <Clock className="h-3 w-3" />
                              {getTriggerBadge(auto)}
                            </Badge>
                            <div className="flex items-center gap-0.5">
                              <Switch
                                checked={auto.is_active}
                                onCheckedChange={(v) => handleToggle(stage.id, auto.id, v)}
                                className="scale-[0.65]"
                              />
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => handleEdit(stage.id, auto)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={() => handleDelete(stage.id, auto.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => handleAdd(stage.id)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Sheet for add/edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {editingId === 'new' ? 'Nova Automação' : 'Editar Automação'}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            {/* Trigger */}
            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm(p => ({ ...p, trigger: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_enter">Ao entrar na etapa</SelectItem>
                  <SelectItem value="on_exit">Ao sair da etapa</SelectItem>
                  <SelectItem value="after_time">Após tempo na etapa</SelectItem>
                </SelectContent>
              </Select>
              {form.trigger === 'after_time' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Após</span>
                  <Input
                    type="number" min={1} className="w-20"
                    value={form.trigger_delay_hours}
                    onChange={e => setForm(p => ({ ...p, trigger_delay_hours: parseInt(e.target.value) || 1 }))}
                  />
                  <span className="text-sm text-muted-foreground">horas</span>
                </div>
              )}
            </div>

            {/* Action Type */}
            <div className="space-y-2">
              <Label>Ação</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm(p => ({ ...p, action_type: v, action_config: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="run_bot">🤖 Executar SalesBot</SelectItem>
                  <SelectItem value="notify_responsible">🔔 Notificar responsável</SelectItem>
                  <SelectItem value="change_responsible">👤 Mudar responsável</SelectItem>
                  <SelectItem value="add_tag">🏷️ Aplicar tag</SelectItem>
                  <SelectItem value="remove_tag">🏷️ Remover tag</SelectItem>
                  <SelectItem value="create_task">✅ Criar tarefa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Config */}
            <div className="space-y-2">
              <Label>Configuração</Label>
              <ActionConfigForm
                actionType={form.action_type}
                config={form.action_config}
                onChange={(cfg) => setForm(p => ({ ...p, action_config: cfg }))}
                bots={bots}
                tags={tags}
                teamMembers={teamMembers}
              />
            </div>

            {/* Conditions */}
            <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground">
                  <ChevronDown className={`h-4 w-4 transition-transform ${conditionsOpen ? 'rotate-180' : ''}`} />
                  Condições ({form.conditions.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {form.conditions.map((cond, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select value={cond.field} onValueChange={v => updateCondition(idx, 'field', v)}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="source">Fonte</SelectItem>
                        <SelectItem value="value">Valor</SelectItem>
                        <SelectItem value="tag">Tag</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={cond.operator} onValueChange={v => updateCondition(idx, 'operator', v)}>
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cond.field === 'value' ? (
                          <>
                            <SelectItem value="greater_than">Maior que</SelectItem>
                            <SelectItem value="less_than">Menor que</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="equals">É</SelectItem>
                            <SelectItem value="not_equals">Não é</SelectItem>
                            {cond.field === 'tag' && (
                              <>
                                <SelectItem value="contains">Contém</SelectItem>
                                <SelectItem value="not_contains">Não contém</SelectItem>
                              </>
                            )}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {cond.field === 'source' ? (
                      <Select value={cond.value} onValueChange={v => updateCondition(idx, 'value', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Valor" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : cond.field === 'tag' ? (
                      <Select value={cond.value} onValueChange={v => updateCondition(idx, 'value', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Tag" /></SelectTrigger>
                        <SelectContent>
                          {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="number" placeholder="R$ valor" className="flex-1"
                        value={cond.value}
                        onChange={e => updateCondition(idx, 'value', e.target.value)}
                      />
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCondition(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addCondition} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar condição
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave}>Salvar</Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// Action config sub-component
function ActionConfigForm({
  actionType, config, onChange, bots, tags, teamMembers,
}: {
  actionType: string;
  config: Record<string, any>;
  onChange: (cfg: Record<string, any>) => void;
  bots: Array<{ id: string; name: string; is_active: boolean }>;
  tags: LeadTag[];
  teamMembers: Array<{ id: string; full_name: string }>;
}) {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });

  switch (actionType) {
    case 'run_bot':
      return (
        <div className="space-y-3">
          <Select value={config.bot_id || ''} onValueChange={v => set('bot_id', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um bot" /></SelectTrigger>
            <SelectContent>
              {bots.filter(b => b.is_active).map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox checked={config.skip_if_executed || false} onCheckedChange={v => set('skip_if_executed', v)} />
            <span className="text-sm">Pular se já executou</span>
          </div>
        </div>
      );
    case 'notify_responsible':
      return (
        <div className="space-y-3">
          <Textarea placeholder="Texto da notificação..." value={config.message || ''} onChange={e => set('message', e.target.value)} rows={3} />
          <div className="flex flex-wrap gap-1">
            {['{{lead.name}}', '{{stage.name}}', '{{responsible.name}}'].map(v => (
              <Badge key={v} variant="secondary" className="cursor-pointer text-xs" onClick={() => set('message', (config.message || '') + ' ' + v)}>{v}</Badge>
            ))}
          </div>
          <Select value={config.recipient || 'responsible'} onValueChange={v => set('recipient', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="responsible">Responsável pelo lead</SelectItem>
              <SelectItem value="all">Todos os membros</SelectItem>
              {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={config.channel || 'app'} onValueChange={v => set('channel', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="app">Notificação no app</SelectItem>
              <SelectItem value="whatsapp">WhatsApp interno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case 'change_responsible':
      return (
        <Select value={config.round_robin ? 'round_robin' : (config.user_id || '')} onValueChange={v => {
          if (v === 'round_robin') onChange({ round_robin: true });
          else onChange({ user_id: v });
        }}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="round_robin">Round Robin entre vendedores</SelectItem>
            {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'add_tag':
    case 'remove_tag':
      return (
        <Select value={config.tag_id || ''} onValueChange={v => set('tag_id', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione uma tag" /></SelectTrigger>
          <SelectContent>
            {tags.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'create_task':
      return (
        <div className="space-y-3">
          <Input placeholder="Título da tarefa" value={config.title || ''} onChange={e => set('title', e.target.value)} />
          <Select value={String(config.due_days ?? '0')} onValueChange={v => set('due_days', parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Imediatamente</SelectItem>
              <SelectItem value="1">Em 1 dia</SelectItem>
              <SelectItem value="3">Em 3 dias</SelectItem>
              <SelectItem value="7">Em 7 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={config.assignee_id || 'responsible'} onValueChange={v => set('assignee_id', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="responsible">Responsável pelo lead</SelectItem>
              {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">Selecione uma ação</p>;
  }
}
