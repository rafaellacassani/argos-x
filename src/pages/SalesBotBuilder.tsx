import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  Copy,
  Trash2,
  Play,
  Pause,
  Settings,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSalesBots, BotNode, BotEdge, SalesBot } from '@/hooks/useSalesBots';
import { BotBuilderCanvas } from '@/components/salesbots/BotBuilderCanvas';
import { BotPreviewDialog } from '@/components/salesbots/BotPreviewDialog';

const triggerTypes = [
  { value: 'message_received', label: 'Mensagem recebida' },
  { value: 'keyword', label: 'Palavra-chave específica' },
  { value: 'new_lead', label: 'Novo lead criado' },
  { value: 'stage_change', label: 'Mudança de etapa no funil' },
  { value: 'scheduled', label: 'Agendamento (cron)' },
  { value: 'webhook', label: 'Webhook externo' },
];

interface TemplateState {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  flow_data: { nodes: BotNode[]; edges: BotEdge[] };
  template_name: string;
}

export default function SalesBotBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { loading, fetchBot, createBot, updateBot, deleteBot, duplicateBot } = useSalesBots();
  const { workspaceId } = useWorkspace();

  const [botName, setBotName] = useState('Novo Bot');
  const [triggerType, setTriggerType] = useState('message_received');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [isActive, setIsActive] = useState(false);
  const [nodes, setNodes] = useState<BotNode[]>([]);
  const [edges, setEdges] = useState<BotEdge[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [whatsappInstances, setWhatsappInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);
  const [funnels, setFunnels] = useState<Array<{ id: string; name: string }>>([]);
  const [funnelStages, setFunnelStages] = useState<Array<{ id: string; name: string; funnel_id: string }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Draft state for settings dialog
  const [draftTriggerType, setDraftTriggerType] = useState('message_received');
  const [draftTriggerConfig, setDraftTriggerConfig] = useState<Record<string, unknown>>({});
  const [delayMode, setDelayMode] = useState<'immediate' | 'delayed'>('immediate');
  const [delayValue, setDelayValue] = useState(1);
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');

  const isEditing = !!id;

  const openSettings = () => {
    setDraftTriggerType(triggerType);
    setDraftTriggerConfig({ ...triggerConfig });
    const dm = (triggerConfig.delay_minutes as number) || 0;
    if (dm > 0) {
      setDelayMode('delayed');
      if (dm % 1440 === 0) { setDelayUnit('days'); setDelayValue(dm / 1440); }
      else if (dm % 60 === 0) { setDelayUnit('hours'); setDelayValue(dm / 60); }
      else { setDelayUnit('minutes'); setDelayValue(dm); }
    } else {
      setDelayMode('immediate');
      setDelayValue(1);
      setDelayUnit('minutes');
    }
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    const finalConfig = { ...draftTriggerConfig };
    if (draftTriggerType === 'stage_change') {
      if (delayMode === 'immediate') {
        finalConfig.delay_minutes = 0;
      } else {
        const multiplier = delayUnit === 'days' ? 1440 : delayUnit === 'hours' ? 60 : 1;
        finalConfig.delay_minutes = delayValue * multiplier;
      }
    }
    setTriggerType(draftTriggerType);
    setTriggerConfig(finalConfig);
    setHasChanges(true);
    setSettingsOpen(false);
    toast({ title: 'Configurações atualizadas', description: 'Lembre-se de salvar o bot.' });
  };

  useEffect(() => {
    const state = location.state as { template?: TemplateState } | null;
    if (state?.template && !id) {
      const t = state.template;
      setBotName(t.name);
      setTriggerType(t.trigger_type);
      setTriggerConfig(t.trigger_config);
      setNodes(t.flow_data.nodes);
      setEdges(t.flow_data.edges);
      setTemplateName(t.template_name);
      setHasChanges(true);
      toast({ title: 'Template carregado!', description: 'Personalize os textos e ative o bot.' });
      window.history.replaceState({}, document.title);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    supabase.from('whatsapp_instances').select('instance_name, display_name').eq('workspace_id', workspaceId).eq('instance_type', 'commercial').then(({ data }) => setWhatsappInstances(data || []));
    supabase.from('funnels').select('id, name').eq('workspace_id', workspaceId).order('name').then(({ data }) => setFunnels(data || []));
    supabase.from('funnel_stages').select('id, name, funnel_id').eq('workspace_id', workspaceId).order('position').then(({ data }) => setFunnelStages(data || []));
  }, [workspaceId]);

  useEffect(() => { if (id) loadBot(id); }, [id]);

  const loadBot = async (botId: string) => {
    const bot = await fetchBot(botId);
    if (bot) {
      setBotName(bot.name);
      setTriggerType(bot.trigger_type);
      setTriggerConfig(bot.trigger_config);
      setIsActive(bot.is_active);
      setNodes(bot.flow_data.nodes);
      setEdges(bot.flow_data.edges);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const botData: Partial<SalesBot> & { template_name?: string } = {
        name: botName, trigger_type: triggerType, trigger_config: triggerConfig,
        is_active: isActive, flow_data: { nodes, edges },
      };
      if (isEditing) {
        await updateBot(id!, botData);
      } else {
        if (templateName) botData.template_name = templateName;
        const newBot = await createBot(botData);
        if (newBot) navigate(`/salesbots/builder/${newBot.id}`, { replace: true });
      }
      setHasChanges(false);
    } finally { setIsSaving(false); }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    const newBot = await duplicateBot(id);
    if (newBot) navigate(`/salesbots/builder/${newBot.id}`);
  };

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteBot(id);
    if (success) navigate('/salesbots');
    setDeleteDialogOpen(false);
  };

  const handleNodesChange = (newNodes: BotNode[]) => { setNodes(newNodes); setHasChanges(true); };
  const handleEdgesChange = (newEdges: BotEdge[]) => { setEdges(newEdges); setHasChanges(true); };

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 h-14 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/salesbots')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Input
            value={botName}
            onChange={(e) => { setBotName(e.target.value); setHasChanges(true); }}
            className="w-64 font-semibold"
            placeholder="Nome do bot..."
          />
          {hasChanges && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground">
              Alterações não salvas
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Switch id="bot-active" checked={isActive} onCheckedChange={(checked) => { setIsActive(checked); setHasChanges(true); }} />
            <Label htmlFor="bot-active" className="text-sm flex items-center gap-1">
              {isActive ? (<><Play className="w-3 h-3 text-green-500" /> Ativo</>) : (<><Pause className="w-3 h-3" /> Pausado</>)}
            </Label>
          </div>

          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="w-4 h-4 mr-1" /> Duplicar</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="w-4 h-4 mr-1" /> Excluir</Button>
            </>
          )}

          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
          </Button>

          <Button variant="outline" size="sm" onClick={openSettings}>
            <Settings className="w-4 h-4 mr-1" /> Configurar
          </Button>

          <Button onClick={handleSave} disabled={isSaving || loading}>
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <BotBuilderCanvas nodes={nodes} edges={edges} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} />
      </div>

      {/* Settings Dialog (centered popup) */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações do Bot</DialogTitle>
            <DialogDescription>Configure o gatilho e comportamento do bot</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label>Gatilho de ativação</Label>
              <Select value={draftTriggerType} onValueChange={(value) => { setDraftTriggerType(value); setDraftTriggerConfig({}); setDelayMode('immediate'); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o gatilho" /></SelectTrigger>
                <SelectContent>
                  {triggerTypes.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {['message_received', 'keyword', 'new_lead'].includes(draftTriggerType) && (
              <div className="space-y-2">
                <Label>Instância WhatsApp</Label>
                <Select
                  value={(draftTriggerConfig.instance_name as string) || '__all__'}
                  onValueChange={(value) => setDraftTriggerConfig({ ...draftTriggerConfig, instance_name: value === '__all__' ? '' : value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as instâncias</SelectItem>
                    {whatsappInstances.map((inst) => (<SelectItem key={inst.instance_name} value={inst.instance_name}>{inst.display_name || inst.instance_name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Deixe "Todas" para o bot escutar qualquer instância</p>
              </div>
            )}

            {draftTriggerType === 'keyword' && (
              <div className="space-y-2">
                <Label>Palavra-chave</Label>
                <Input placeholder="Ex: orçamento, preço, comprar..." value={(draftTriggerConfig.keyword as string) || ''} onChange={(e) => setDraftTriggerConfig({ ...draftTriggerConfig, keyword: e.target.value })} />
              </div>
            )}

            {draftTriggerType === 'webhook' && (
              <div className="space-y-2">
                <Label>URL do Webhook (gerada automaticamente)</Label>
                <Input readOnly value={id ? `${window.location.origin}/api/webhook/bot/${id}` : 'Salve o bot para gerar a URL'} className="font-mono text-xs" />
              </div>
            )}

            {draftTriggerType === 'scheduled' && (
              <div className="space-y-2">
                <Label>Expressão Cron</Label>
                <Input placeholder="0 9 * * *" value={(draftTriggerConfig.cron as string) || ''} onChange={(e) => setDraftTriggerConfig({ ...draftTriggerConfig, cron: e.target.value })} />
                <p className="text-xs text-muted-foreground">Ex: "0 9 * * *" = todo dia às 9h</p>
              </div>
            )}

            {draftTriggerType === 'stage_change' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Funil</Label>
                  <Select
                    value={(draftTriggerConfig.funnel_id as string) || ''}
                    onValueChange={(value) => setDraftTriggerConfig({ ...draftTriggerConfig, funnel_id: value, stage_id: '' })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                    <SelectContent>
                      {funnels.map(f => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {draftTriggerConfig.funnel_id && (
                  <div className="space-y-2">
                    <Label>Etapa de destino</Label>
                    <Select
                      value={(draftTriggerConfig.stage_id as string) || '__any__'}
                      onValueChange={(value) => setDraftTriggerConfig({ ...draftTriggerConfig, stage_id: value === '__any__' ? '' : value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Qualquer etapa</SelectItem>
                        {funnelStages.filter(s => s.funnel_id === draftTriggerConfig.funnel_id).map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Delay option */}
                <div className="space-y-3 rounded-lg border p-4">
                  <Label className="text-sm font-medium">Quando executar?</Label>
                  <RadioGroup value={delayMode} onValueChange={(v) => setDelayMode(v as 'immediate' | 'delayed')}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="immediate" id="delay-immediate" />
                      <Label htmlFor="delay-immediate" className="font-normal cursor-pointer">Imediatamente ao entrar na etapa</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delayed" id="delay-delayed" />
                      <Label htmlFor="delay-delayed" className="font-normal cursor-pointer">Após um tempo</Label>
                    </div>
                  </RadioGroup>

                  {delayMode === 'delayed' && (
                    <div className="flex items-center gap-2 mt-2 pl-6">
                      <span className="text-sm text-muted-foreground">Aguardar</span>
                      <Input
                        type="number"
                        min={1}
                        value={delayValue}
                        onChange={(e) => setDelayValue(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20"
                      />
                      <Select value={delayUnit} onValueChange={(v) => setDelayUnit(v as 'minutes' | 'hours' | 'days')}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">minutos</SelectItem>
                          <SelectItem value="hours">horas</SelectItem>
                          <SelectItem value="days">dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancelar</Button>
            <Button onClick={saveSettings}>Salvar configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bot</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir "{botName}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BotPreviewDialog open={showPreview} onOpenChange={setShowPreview} nodes={nodes} edges={edges} />
    </div>
  );
}
