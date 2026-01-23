import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  Edit,
  MoreVertical,
  Zap,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { useSalesBots, SalesBot } from '@/hooks/useSalesBots';

const triggerLabels: Record<string, string> = {
  message_received: 'Mensagem recebida',
  keyword: 'Palavra-chave',
  new_lead: 'Novo lead',
  stage_change: 'Mudança de etapa',
  scheduled: 'Agendado',
  webhook: 'Webhook externo',
};

export default function SalesBots() {
  const navigate = useNavigate();
  const { loading, fetchBots, deleteBot, duplicateBot, toggleBotActive } = useSalesBots();
  const [bots, setBots] = useState<SalesBot[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    const data = await fetchBots();
    setBots(data);
  };

  const handleCreateBot = () => {
    navigate('/salesbots/builder');
  };

  const handleEditBot = (id: string) => {
    navigate(`/salesbots/builder/${id}`);
  };

  const handleDuplicateBot = async (id: string) => {
    const newBot = await duplicateBot(id);
    if (newBot) {
      setBots(prev => [newBot, ...prev]);
    }
  };

  const handleDeleteBot = async () => {
    if (!botToDelete) return;
    const success = await deleteBot(botToDelete);
    if (success) {
      setBots(prev => prev.filter(b => b.id !== botToDelete));
    }
    setBotToDelete(null);
    setDeleteDialogOpen(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const success = await toggleBotActive(id, isActive);
    if (success) {
      setBots(prev => prev.map(b => b.id === id ? { ...b, is_active: isActive } : b));
    }
  };

  const totalExecutions = bots.reduce((sum, b) => sum + b.executions_count, 0);
  const totalConversions = bots.reduce((sum, b) => sum + b.conversions_count, 0);
  const conversionRate = totalExecutions > 0 ? ((totalConversions / totalExecutions) * 100).toFixed(1) : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SalesBots</h1>
          <p className="text-muted-foreground">
            Automatize suas conversas e qualifique leads automaticamente
          </p>
        </div>
        <Button onClick={handleCreateBot} className="gap-2">
          <Plus className="w-4 h-4" />
          Criar novo bot
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bots.length}</p>
                  <p className="text-sm text-muted-foreground">Bots criados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Play className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {bots.filter(b => b.is_active).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Bots ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalExecutions}</p>
                  <p className="text-sm text-muted-foreground">Execuções</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bot List */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Bots</CardTitle>
          <CardDescription>
            Gerencie seus bots de vendas e automações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && bots.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Bot className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Nenhum bot criado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro bot para automatizar suas conversas
              </p>
              <Button onClick={handleCreateBot} className="gap-2">
                <Plus className="w-4 h-4" />
                Criar primeiro bot
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bots.map((bot, index) => (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${bot.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                      <Bot className={`w-5 h-5 ${bot.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{bot.name}</h4>
                        <Badge variant={bot.is_active ? 'default' : 'secondary'}>
                          {bot.is_active ? 'Ativo' : 'Pausado'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {triggerLabels[bot.trigger_type] || bot.trigger_type}
                        </span>
                        <span>•</span>
                        <span>{bot.executions_count} execuções</span>
                        <span>•</span>
                        <span>{bot.conversions_count} conversões</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={bot.is_active}
                      onCheckedChange={(checked) => handleToggleActive(bot.id, checked)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border shadow-lg">
                        <DropdownMenuItem onClick={() => handleEditBot(bot.id)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateBot(bot.id)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            setBotToDelete(bot.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir bot</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este bot? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBot}
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
