import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  ArrowLeft,
  Save,
  Copy,
  Trash2,
  Play,
  Pause,
  Settings,
  ChevronDown,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { useSalesBots, BotNode, BotEdge, SalesBot } from '@/hooks/useSalesBots';
import { BotBuilderCanvas } from '@/components/salesbots/BotBuilderCanvas';

const triggerTypes = [
  { value: 'message_received', label: 'Mensagem recebida' },
  { value: 'keyword', label: 'Palavra-chave específica' },
  { value: 'new_lead', label: 'Novo lead criado' },
  { value: 'stage_change', label: 'Mudança de etapa no funil' },
  { value: 'scheduled', label: 'Agendamento (cron)' },
  { value: 'webhook', label: 'Webhook externo' },
];

export default function SalesBotBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [whatsappInstances, setWhatsappInstances] = useState<{ instance_name: string; display_name: string | null }[]>([]);

  const isEditing = !!id;

  // Fetch WhatsApp instances for the trigger config
  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from('whatsapp_instances')
      .select('instance_name, display_name')
      .eq('workspace_id', workspaceId)
      .eq('instance_type', 'commercial')
      .then(({ data }) => {
        setWhatsappInstances(data || []);
      });
  }, [workspaceId]);

  useEffect(() => {
    if (id) {
      loadBot(id);
    }
  }, [id]);

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
      const botData: Partial<SalesBot> = {
        name: botName,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        is_active: isActive,
        flow_data: { nodes, edges },
      };

      if (isEditing) {
        await updateBot(id!, botData);
      } else {
        const newBot = await createBot(botData);
        if (newBot) {
          navigate(`/salesbots/builder/${newBot.id}`, { replace: true });
        }
      }
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!id) return;
    const newBot = await duplicateBot(id);
    if (newBot) {
      navigate(`/salesbots/builder/${newBot.id}`);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteBot(id);
    if (success) {
      navigate('/salesbots');
    }
    setDeleteDialogOpen(false);
  };

  const handleNodesChange = (newNodes: BotNode[]) => {
    setNodes(newNodes);
    setHasChanges(true);
  };

  const handleEdgesChange = (newEdges: BotEdge[]) => {
    setEdges(newEdges);
    setHasChanges(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/salesbots')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <Input
            value={botName}
            onChange={(e) => {
              setBotName(e.target.value);
              setHasChanges(true);
            }}
            className="w-64 font-semibold"
            placeholder="Nome do bot..."
          />

          {hasChanges && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground"
            >
              Alterações não salvas
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Switch
              id="bot-active"
              checked={isActive}
              onCheckedChange={(checked) => {
                setIsActive(checked);
                setHasChanges(true);
              }}
            />
            <Label htmlFor="bot-active" className="text-sm flex items-center gap-1">
              {isActive ? (
                <>
                  <Play className="w-3 h-3 text-green-500" /> Ativo
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" /> Pausado
                </>
              )}
            </Label>
          </div>

          {isEditing && (
            <>
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-1" />
                Duplicar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Excluir
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-1" />
                Configurar
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Configurações do Bot</SheetTitle>
                <SheetDescription>
                  Configure o gatilho e comportamento do bot
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label>Gatilho de ativação</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(value) => {
                      setTriggerType(value);
                      setTriggerConfig({});
                      setHasChanges(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Instance selector — shown for message_received, keyword, new_lead */}
                {['message_received', 'keyword', 'new_lead'].includes(triggerType) && (
                  <div className="space-y-2">
                    <Label>Instância WhatsApp</Label>
                    <Select
                      value={(triggerConfig.instance_name as string) || '__all__'}
                      onValueChange={(value) => {
                        setTriggerConfig({
                          ...triggerConfig,
                          instance_name: value === '__all__' ? '' : value,
                        });
                        setHasChanges(true);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a instância" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas as instâncias</SelectItem>
                        {whatsappInstances.map((inst) => (
                          <SelectItem key={inst.instance_name} value={inst.instance_name}>
                            {inst.display_name || inst.instance_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Deixe "Todas" para o bot escutar qualquer instância
                    </p>
                  </div>
                )}

                {triggerType === 'keyword' && (
                  <div className="space-y-2">
                    <Label>Palavra-chave</Label>
                    <Input
                      placeholder="Ex: orçamento, preço, comprar..."
                      value={(triggerConfig.keyword as string) || ''}
                      onChange={(e) => {
                        setTriggerConfig({ ...triggerConfig, keyword: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                  </div>
                )}

                {triggerType === 'webhook' && (
                  <div className="space-y-2">
                    <Label>URL do Webhook (gerada automaticamente)</Label>
                    <Input
                      readOnly
                      value={id ? `${window.location.origin}/api/webhook/bot/${id}` : 'Salve o bot para gerar a URL'}
                      className="font-mono text-xs"
                    />
                  </div>
                )}

                {triggerType === 'scheduled' && (
                  <div className="space-y-2">
                    <Label>Expressão Cron</Label>
                    <Input
                      placeholder="0 9 * * *"
                      value={(triggerConfig.cron as string) || ''}
                      onChange={(e) => {
                        setTriggerConfig({ ...triggerConfig, cron: e.target.value });
                        setHasChanges(true);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: "0 9 * * *" = todo dia às 9h
                    </p>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Button onClick={handleSave} disabled={isSaving || loading}>
            <Save className="w-4 h-4 mr-1" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <BotBuilderCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
        />
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bot</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{botName}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
