import { useState, useEffect } from 'react';
import { Zap, Bot, Bell, User, Tag, CheckSquare, Trash2, Plus, ChevronDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useStageAutomations, StageAutomation } from '@/hooks/useStageAutomations';
import type { FunnelStage, LeadTag } from '@/hooks/useLeads';

interface StageAutomationsDialogProps {
  stage: FunnelStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags?: LeadTag[];
  teamMembers?: Array<{ id: string; full_name: string }>;
  onCountChange?: () => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  run_bot: <Bot className="h-4 w-4" />,
  notify_responsible: <Bell className="h-4 w-4" />,
  change_responsible: <User className="h-4 w-4" />,
  add_tag: <Tag className="h-4 w-4" />,
  remove_tag: <Tag className="h-4 w-4" />,
  create_task: <CheckSquare className="h-4 w-4" />,
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
  on_enter: 'Ao entrar na etapa',
  on_exit: 'Ao sair da etapa',
  after_time: 'Após tempo na etapa',
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

export function StageAutomationsDialog({
  stage,
  open,
  onOpenChange,
  tags = [],
  teamMembers = [],
  onCountChange,
}: StageAutomationsDialogProps) {
  const {
    automations, loading, fetchAutomations,
    createAutomation, updateAutomation, deleteAutomation, toggleAutomation,
  } = useStageAutomations();

  const [editing, setEditing] = useState<string | null>(null); // automation id or 'new'
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [bots, setBots] = useState<Array<{ id: string; name: string; is_active: boolean }>>([]);
  const [conditionsOpen, setConditionsOpen] = useState(false);

  useEffect(() => {
    if (open && stage) {
      fetchAutomations(stage.id);
      fetchBots();
      setEditing(null);
    }
  }, [open, stage]);

  const fetchBots = async () => {
    const { data } = await supabase
      .from('salesbots')
      .select('id, name, is_active')
      .order('name');
    if (data) setBots(data);
  };

  const handleEdit = (auto: StageAutomation) => {
    setEditing(auto.id);
    setForm({
      trigger: auto.trigger,
      trigger_delay_hours: auto.trigger_delay_hours,
      action_type: auto.action_type,
      action_config: { ...auto.action_config },
      conditions: [...auto.conditions],
    });
    setConditionsOpen(auto.conditions.length > 0);
  };

  const handleNew = () => {
    setEditing('new');
    setForm({ ...DEFAULT_FORM });
    setConditionsOpen(false);
  };

  const handleSave = async () => {
    if (!stage) return;
    const payload = {
      stage_id: stage.id,
      trigger: form.trigger,
      trigger_delay_hours: form.trigger === 'after_time' ? form.trigger_delay_hours : 0,
      action_type: form.action_type as StageAutomation['action_type'],
      action_config: form.action_config,
      conditions: form.conditions,
      is_active: true,
      position: automations.length,
    };

    if (editing === 'new') {
      await createAutomation(payload);
    } else if (editing) {
      await updateAutomation(editing, payload);
    }
    setEditing(null);
    onCountChange?.();
  };

  const handleDelete = async (id: string) => {
    await deleteAutomation(id);
    if (editing === id) setEditing(null);
    onCountChange?.();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await toggleAutomation(id, active);
    onCountChange?.();
  };

  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: 'source', operator: 'equals', value: '' }],
    }));
  };

  const removeCondition = (idx: number) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== idx),
    }));
  };

  const updateCondition = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => i === idx ? { ...c, [field]: value } : c),
    }));
  };

  const getActionSummary = (auto: StageAutomation) => {
    const label = ACTION_LABELS[auto.action_type] || auto.action_type;
    const config = auto.action_config;
    if (auto.action_type === 'run_bot' && config.bot_id) {
      const bot = bots.find(b => b.id === config.bot_id);
      return `${label}: ${bot?.name || 'Bot'}`;
    }
    if ((auto.action_type === 'add_tag' || auto.action_type === 'remove_tag') && config.tag_id) {
      const tag = tags.find(t => t.id === config.tag_id);
      return `${label}: ${tag?.name || 'Tag'}`;
    }
    if (auto.action_type === 'create_task' && config.title) {
      return `${label}: ${config.title}`;
    }
    return label;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Automações — {stage?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: List */}
          <div className="w-1/2 flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {automations.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Nenhuma automação configurada
                  </p>
                )}
                {automations.map(auto => (
                  <div
                    key={auto.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      editing === auto.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleEdit(auto)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">
                          {ACTION_ICONS[auto.action_type]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {getActionSummary(auto)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {TRIGGER_LABELS[auto.trigger]}
                            {auto.trigger === 'after_time' && ` (${auto.trigger_delay_hours}h)`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={auto.is_active}
                          onCheckedChange={(v) => { handleToggle(auto.id, v); }}
                          onClick={(e) => e.stopPropagation()}
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(auto.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button variant="outline" className="mt-3 w-full gap-2" onClick={handleNew}>
              <Plus className="h-4 w-4" /> Adicionar automação
            </Button>
          </div>

          <Separator orientation="vertical" />

          {/* Right: Form */}
          <div className="w-1/2 min-h-0">
            {editing ? (
              <ScrollArea className="h-full">
                <div className="space-y-4 pr-2">
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
                          type="number"
                          min={1}
                          className="w-20"
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
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="source">Fonte</SelectItem>
                              <SelectItem value="value">Valor</SelectItem>
                              <SelectItem value="tag">Tag</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={cond.operator} onValueChange={v => updateCondition(idx, 'operator', v)}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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
                              type="number"
                              placeholder="R$ valor"
                              className="flex-1"
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
                    <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Selecione ou crie uma automação
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Sub-component for action-specific config
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
            <Checkbox
              checked={config.skip_if_executed || false}
              onCheckedChange={v => set('skip_if_executed', v)}
            />
            <span className="text-sm">Pular se já executou este bot para o lead</span>
          </div>
        </div>
      );

    case 'notify_responsible':
      return (
        <div className="space-y-3">
          <Textarea
            placeholder="Texto da notificação..."
            value={config.message || ''}
            onChange={e => set('message', e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-1">
            {['{{lead.name}}', '{{stage.name}}', '{{responsible.name}}'].map(v => (
              <Badge
                key={v}
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => set('message', (config.message || '') + ' ' + v)}
              >
                {v}
              </Badge>
            ))}
          </div>
          <Select value={config.recipient || 'responsible'} onValueChange={v => set('recipient', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="responsible">Responsável pelo lead</SelectItem>
              <SelectItem value="all">Todos os membros</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
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
        <Select
          value={config.round_robin ? 'round_robin' : (config.user_id || '')}
          onValueChange={v => {
            if (v === 'round_robin') onChange({ round_robin: true });
            else onChange({ user_id: v });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="round_robin">Round Robin entre vendedores</SelectItem>
            {teamMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
            ))}
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
          <Input
            placeholder="Título da tarefa"
            value={config.title || ''}
            onChange={e => set('title', e.target.value)}
          />
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
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return <p className="text-sm text-muted-foreground">Selecione uma ação</p>;
  }
}
