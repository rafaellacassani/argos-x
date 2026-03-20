import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { X, Zap, Bot, Bell, User, Tag, CheckSquare, Trash2, Plus, Pencil, Clock, Play, Loader2, AlertTriangle, CheckCircle2, XCircle, SkipForward, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  trigger_delay_minutes: number;
  action_type: string;
  action_config: Record<string, any>;
  conditions: Array<{ field: string; operator: string; value: string }>;
};

const DEFAULT_FORM: FormData = {
  trigger: 'on_enter',
  trigger_delay_minutes: 0,
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
  const navigate = useNavigate();
  const {
    fetchAutomations, createAutomation, updateAutomation,
    deleteAutomation, toggleAutomation, executeStageAutomations,
  } = useStageAutomations();

  const { workspaceId } = useWorkspace();
  const [executingAll, setExecutingAll] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<{ current: number; total: number } | null>(null);
  const [executionResults, setExecutionResults] = useState<Array<{ name: string; status: 'success' | 'error' | 'skipped' | 'duplicate'; reason?: string }> | null>(null);

  const [allAutomations, setAllAutomations] = useState<Record<string, StageAutomation[]>>({});
  const [stageChangeBots, setStageChangeBots] = useState<Record<string, Array<{ id: string; name: string; is_active: boolean; delay_minutes: number }>>>({});
  const [loadingStages, setLoadingStages] = useState(false);
  const [bots, setBots] = useState<Array<{ id: string; name: string; is_active: boolean }>>([]);
  const [instances, setInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);
  const [cloudConnections, setCloudConnections] = useState<{ id: string; inbox_name: string; phone_number: string; phone_number_id: string }[]>([]);

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

    // Also fetch SalesBots with trigger_type = 'stage_change' for this funnel
    if (workspaceId) {
      const { data: scBots } = await supabase
        .from('salesbots')
        .select('id, name, is_active, trigger_config')
        .eq('workspace_id', workspaceId)
        .eq('trigger_type', 'stage_change');

      const botsByStage: Record<string, Array<{ id: string; name: string; is_active: boolean; delay_minutes: number }>> = {};
      if (scBots) {
        for (const bot of scBots) {
          const tc = (bot.trigger_config || {}) as Record<string, any>;
          const stageId = tc.stage_id as string;
          // Match bots to stages in this funnel
          if (stageId && stages.some(s => s.id === stageId)) {
            if (!botsByStage[stageId]) botsByStage[stageId] = [];
            botsByStage[stageId].push({
              id: bot.id,
              name: bot.name,
              is_active: bot.is_active ?? false,
              delay_minutes: (tc.delay_minutes as number) || 0,
            });
          } else if (!stageId) {
            // Bot targets any stage in any funnel — show on all stages
            for (const stage of stages) {
              if (!botsByStage[stage.id]) botsByStage[stage.id] = [];
              botsByStage[stage.id].push({
                id: bot.id,
                name: bot.name,
                is_active: bot.is_active ?? false,
                delay_minutes: (tc.delay_minutes as number) || 0,
              });
            }
          }
        }
      }
      setStageChangeBots(botsByStage);
    }

    setLoadingStages(false);
  }, [stages, fetchAutomations, workspaceId]);

  const fetchInstances = async () => {
    if (!workspaceId) return;
    const [evoRes, cloudRes] = await Promise.all([
      supabase.from('whatsapp_instances').select('instance_name, display_name').eq('workspace_id', workspaceId).neq('instance_type', 'alerts'),
      supabase.from('whatsapp_cloud_connections').select('id, inbox_name, phone_number, phone_number_id').eq('workspace_id', workspaceId).eq('is_active', true),
    ]);
    if (evoRes.data) setInstances(evoRes.data);
    if (cloudRes.data) setCloudConnections(cloudRes.data);
  };

  useEffect(() => {
    if (open) {
      loadAllAutomations();
      fetchBots();
      fetchInstances();
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
      trigger_delay_minutes: auto.trigger_delay_minutes,
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
      trigger_delay_minutes: form.trigger === 'after_time' ? form.trigger_delay_minutes : 0,
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
      const m = auto.trigger_delay_minutes;
      if (m >= 1440 && m % 1440 === 0) return `Após ${m / 1440}d`;
      if (m >= 60 && m % 60 === 0) return `Após ${m / 60}h`;
      return `Após ${m}min`;
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
                          className={`rounded-lg border p-3 space-y-2 transition-colors cursor-pointer ${
                            auto.is_active 
                              ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                              : 'bg-card hover:bg-muted/30 opacity-60'
                          }`}
                          onClick={() => handleEdit(stage.id, auto)}
                        >
                          <div className="flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">
                              {ACTION_ICONS[auto.action_type]}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {auto.trigger === 'on_enter' ? 'Quando movido para ou criado nesta etapa' :
                                 auto.trigger === 'on_exit' ? 'Quando sair desta etapa' :
                                 getTriggerBadge(auto)}
                              </p>
                              <p className="text-sm font-medium leading-tight truncate">
                                {getActionSummary(auto)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-0.5">
                              <Switch
                                checked={auto.is_active}
                                onCheckedChange={(v) => { handleToggle(stage.id, auto.id, v); }}
                                onClick={(e) => e.stopPropagation()}
                                className="scale-[0.65]"
                              />
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(stage.id, auto.id); }}
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

      {/* Dialog for add/edit */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              {editingId === 'new' ? 'Nova Automação' : 'Editar Automação'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* Conditions header - Kommo style */}
            <Collapsible open={conditionsOpen} onOpenChange={setConditionsOpen}>
              <CollapsibleTrigger asChild>
                <div className="rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <p className="text-sm font-medium text-foreground">Para todos os leads com:</p>
                  {form.conditions.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">{form.conditions.length} condição(ões) configurada(s)</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Adicionar uma condição</p>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2 pl-1">
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
                      <Input type="number" placeholder="R$ valor" className="flex-1" value={cond.value} onChange={e => updateCondition(idx, 'value', e.target.value)} />
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

            {/* Trigger - Kommo style */}
            <div className="space-y-2">
              <Select value={form.trigger} onValueChange={(v) => setForm(p => ({ ...p, trigger: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_enter">Executar: Quando movido para esta etapa</SelectItem>
                  <SelectItem value="on_exit">Executar: Quando sair desta etapa</SelectItem>
                  <SelectItem value="after_time">Executar: Após tempo na etapa</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.trigger === 'on_enter' 
                  ? 'A ação será executada quando um lead entrar ou for criado nesta etapa'
                  : form.trigger === 'on_exit'
                  ? 'A ação será executada quando um lead sair desta etapa'
                  : 'A ação será executada após o tempo configurado na etapa'}
              </p>
              {form.trigger === 'after_time' && (
                <DelayInput
                  minutes={form.trigger_delay_minutes}
                  onChange={(m) => setForm(p => ({ ...p, trigger_delay_minutes: m }))}
                />
              )}
            </div>

            {/* Status - Kommo style */}
            <Select value="always" onValueChange={() => {}}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Ativo: sempre</SelectItem>
              </SelectContent>
            </Select>

            {/* Action Type */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ação</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm(p => ({ ...p, action_type: v, action_config: {} }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="run_bot">🤖 Executar Robô de vendas</SelectItem>
                  <SelectItem value="notify_responsible">🔔 Notificar responsável</SelectItem>
                  <SelectItem value="change_responsible">👤 Alterar usuário de lead</SelectItem>
                  <SelectItem value="add_tag">🏷️ Aplicar tag</SelectItem>
                  <SelectItem value="remove_tag">🏷️ Remover tag</SelectItem>
                  <SelectItem value="create_task">✅ Criar tarefa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Config */}
            <div className="space-y-2">
              {form.action_type === 'run_bot' && <Label className="text-xs text-muted-foreground">Salesbot</Label>}
              <ActionConfigForm
                actionType={form.action_type}
                config={form.action_config}
                onChange={(cfg) => setForm(p => ({ ...p, action_config: cfg }))}
                bots={bots}
                tags={tags}
                teamMembers={teamMembers}
                instances={instances}
                cloudConnections={cloudConnections}
              />
            </div>

            {/* Execute for all in stage */}
            {editingId !== 'new' && editingStageId && form.action_type === 'run_bot' && (
              <div className="space-y-3 border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                  disabled={executingAll}
                  onClick={async () => {
                    if (!editingStageId || !workspaceId) return;
                    setExecutingAll(true);
                    setExecutionResults(null);
                    setExecutionProgress(null);
                    try {
                      // Fetch ALL leads in the stage with names
                      let allLeads: { id: string; name: string; phone: string; whatsapp_jid: string | null }[] = [];
                      let from = 0;
                      const pageSize = 1000;
                      while (true) {
                        const { data: batch } = await supabase
                          .from('leads')
                          .select('id, name, phone, whatsapp_jid')
                          .eq('stage_id', editingStageId)
                          .eq('workspace_id', workspaceId)
                          .range(from, from + pageSize - 1);
                        if (!batch || batch.length === 0) break;
                        allLeads = allLeads.concat(batch);
                        if (batch.length < pageSize) break;
                        from += pageSize;
                      }

                      if (allLeads.length === 0) {
                        const { toast } = await import('sonner');
                        toast.info('Nenhum lead nesta etapa.');
                        return;
                      }

                      setExecutionProgress({ current: 0, total: allLeads.length });
                      const delayMs = (form.action_config.batch_interval_seconds || 30) * 1000;
                      const results: Array<{ name: string; status: 'success' | 'error' | 'skipped' | 'duplicate'; reason?: string }> = [];

                      for (let i = 0; i < allLeads.length; i++) {
                        const lead = allLeads[i];
                        setExecutionProgress({ current: i + 1, total: allLeads.length });

                        // Pre-validate phone
                        const phone = lead.whatsapp_jid || lead.phone;
                        const digits = (phone || '').replace(/\D/g, '');
                        if (!phone || digits.length < 10) {
                          results.push({ name: lead.name, status: 'skipped', reason: `Telefone inválido: ${lead.phone || 'vazio'}` });
                          continue;
                        }

                        try {
                          const autoResult = await executeStageAutomations(editingStageId, lead.id, 'on_enter', { skipStageChangeBots: true, forceBulk: true });
                          if (autoResult.success && autoResult.actionsExecuted > 0) {
                            results.push({ name: lead.name, status: 'success' });
                          } else if (autoResult.actionsExecuted === 0) {
                            results.push({ name: lead.name, status: 'duplicate', reason: 'Já executado anteriormente' });
                          } else {
                            results.push({ name: lead.name, status: 'error', reason: autoResult.errors.join('; ') || 'Falha desconhecida' });
                          }
                        } catch (err) {
                          results.push({ name: lead.name, status: 'error', reason: err instanceof Error ? err.message : 'Erro inesperado' });
                        }
                        // Delay between leads
                        if (i < allLeads.length - 1 && delayMs > 0) {
                          await new Promise(r => setTimeout(r, delayMs));
                        }
                      }

                      setExecutionResults(results);
                      setExecutionProgress(null);

                      const successCount = results.filter(r => r.status === 'success').length;
                      const errorCount = results.filter(r => r.status === 'error').length;
                      const skippedCount = results.filter(r => r.status === 'skipped').length;
                      const dupCount = results.filter(r => r.status === 'duplicate').length;

                      const { toast } = await import('sonner');
                      const parts = [`✅ ${successCount} enviado(s)`];
                      if (errorCount > 0) parts.push(`❌ ${errorCount} erro(s)`);
                      if (skippedCount > 0) parts.push(`⚠️ ${skippedCount} inválido(s)`);
                      if (dupCount > 0) parts.push(`⏭️ ${dupCount} já executado(s)`);

                      const summaryMessage = `${parts.join(', ')} de ${allLeads.length} lead(s).`;
                      if (errorCount > 0) toast.error(summaryMessage);
                      else if (skippedCount > 0 || dupCount > 0) toast.warning(summaryMessage);
                      else toast.success(summaryMessage);
                    } catch (err) {
                      console.error('[BulkExec] Fatal error:', err);
                      const { toast } = await import('sonner');
                      toast.error('Erro ao executar em massa');
                    } finally {
                      setExecutingAll(false);
                    }
                  }}
                >
                  {executingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {executionProgress ? `${executionProgress.current}/${executionProgress.total}` : 'Executando...'}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Executar agora para todos na etapa
                    </>
                  )}
                </Button>

                {/* Execution results report */}
                {executionResults && executionResults.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 max-h-[200px] overflow-y-auto space-y-1">
                    <p className="text-xs font-semibold text-foreground mb-2">Relatório de execução:</p>
                    {executionResults.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {r.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        {r.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        {r.status === 'skipped' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                        {r.status === 'duplicate' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="truncate font-medium">{r.name}</span>
                        {r.reason && <span className="text-muted-foreground truncate ml-auto text-[10px]">{r.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={handleSave}>Salvar</Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Action config sub-component
function ActionConfigForm({
  actionType, config, onChange, bots, tags, teamMembers, instances = [], cloudConnections = [],
}: {
  actionType: string;
  config: Record<string, any>;
  onChange: (cfg: Record<string, any>) => void;
  bots: Array<{ id: string; name: string; is_active: boolean }>;
  tags: LeadTag[];
  teamMembers: Array<{ id: string; full_name: string }>;
  instances?: { instance_name: string; display_name: string | null }[];
  cloudConnections?: { id: string; inbox_name: string; phone_number: string; phone_number_id: string }[];
}) {
  const set = (key: string, value: any) => onChange({ ...config, [key]: value });

  const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  switch (actionType) {
    case 'run_bot':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={config.bot_id || ''} onValueChange={v => set('bot_id', v)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um bot" /></SelectTrigger>
              <SelectContent>
                {bots.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}{!b.is_active && ' (inativo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Crie um novo robô ou selecione um existente</p>

          {/* Interval between messages */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Intervalo entre mensagens (envio em massa)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                value={config.batch_interval_seconds || 30}
                onChange={e => set('batch_interval_seconds', parseInt(e.target.value) || 30)}
                className="w-20 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">segundos</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={config.skip_if_executed !== false} onCheckedChange={v => set('skip_if_executed', v)} />
            <span className="text-sm">Pular se já executou este bot para o lead</span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={config.mark_unanswered || false} onCheckedChange={v => set('mark_unanswered', v)} />
            <span className="text-sm">Deixar mensagem sem resposta</span>
          </div>
          <p className="text-xs text-muted-foreground">As mensagens às quais o Salesbot responde serão marcadas como não respondidas</p>
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

// Delay input with minutes/hours/days unit
type DelayUnit = 'minutes' | 'hours' | 'days';
function DelayInput({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const inferUnit = (): DelayUnit => {
    if (minutes >= 1440 && minutes % 1440 === 0) return 'days';
    if (minutes >= 60 && minutes % 60 === 0) return 'hours';
    return 'minutes';
  };
  const [unit, setUnit] = useState<DelayUnit>(inferUnit());
  
  const toDisplay = (m: number, u: DelayUnit) => {
    if (u === 'days') return Math.max(1, Math.floor(m / 1440));
    if (u === 'hours') return Math.max(1, Math.floor(m / 60));
    return m || 1;
  };
  const toMinutes = (val: number, u: DelayUnit) => {
    if (u === 'days') return val * 1440;
    if (u === 'hours') return val * 60;
    return val;
  };

  const displayValue = toDisplay(minutes, unit);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Após</span>
      <Input
        type="number" min={1} className="w-20"
        value={displayValue}
        onChange={e => onChange(toMinutes(parseInt(e.target.value) || 1, unit))}
      />
      <Select value={unit} onValueChange={(v: DelayUnit) => {
        setUnit(v);
        onChange(toMinutes(displayValue, v));
      }}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="minutes">minutos</SelectItem>
          <SelectItem value="hours">horas</SelectItem>
          <SelectItem value="days">dias</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
