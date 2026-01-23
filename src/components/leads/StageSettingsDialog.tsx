import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FunnelStage } from '@/hooks/useLeads';

interface SalesBot {
  id: string;
  name: string;
  is_active: boolean;
}

interface StageSettingsDialogProps {
  stage: FunnelStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (stageId: string, updates: Partial<FunnelStage>) => void;
}

export function StageSettingsDialog({
  stage,
  open,
  onOpenChange,
  onUpdate
}: StageSettingsDialogProps) {
  const [bots, setBots] = useState<SalesBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBots();
      setSelectedBotId(stage?.bot_id || 'none');
    }
  }, [open, stage]);

  const fetchBots = async () => {
    const { data, error } = await supabase
      .from('salesbots')
      .select('id, name, is_active')
      .order('name');

    if (!error && data) {
      setBots(data);
    }
  };

  const handleSave = async () => {
    if (!stage) return;

    setLoading(true);
    try {
      const botId = selectedBotId === 'none' ? null : selectedBotId;
      
      const { error } = await supabase
        .from('funnel_stages')
        .update({ bot_id: botId })
        .eq('id', stage.id);

      if (error) throw error;

      onUpdate(stage.id, { bot_id: botId });
      toast.success('Automação configurada!');
      onOpenChange(false);
    } catch (err) {
      console.error('Error updating stage:', err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configurar Automação - {stage?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>SalesBot vinculado</Label>
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um bot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (sem automação)</SelectItem>
                {bots.map(bot => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name} {!bot.is_active && '(inativo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O bot selecionado será executado automaticamente quando um lead entrar nesta etapa.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
