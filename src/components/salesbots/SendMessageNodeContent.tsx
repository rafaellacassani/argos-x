import { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, CheckCircle, Loader2, Phone, Settings2, Link2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotNode } from '@/hooks/useSalesBots';
import { ExecutionStatus, TestLead } from '@/hooks/useBotExecution';
import { useEvolutionAPI, EvolutionInstance } from '@/hooks/useEvolutionAPI';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SendMessageNodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
  executionStatus?: ExecutionStatus;
  onTest?: (leadId: string, instanceName: string, forceWithoutConversation: boolean) => void;
  testLeads?: TestLead[];
  isTestingAvailable?: boolean;
}

export function SendMessageNodeContent({
  node,
  onUpdate,
  executionStatus,
  onTest,
  testLeads = [],
  isTestingAvailable = false,
}: SendMessageNodeContentProps) {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTestLead, setSelectedTestLead] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const { listInstances } = useEvolutionAPI();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const message = (node.data.message as string) || '';
  const instanceName = (node.data.instanceName as string) || '';
  const forceWithoutConversation = (node.data.forceWithoutConversation as boolean) || false;
  const urlButton = (node.data.url_button as { label: string; url: string } | null) || null;
  const [showUrlButton, setShowUrlButton] = useState(!!urlButton);

  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      try {
        const data = await listInstances();
        setInstances(data);
        
        // Auto-select if only one instance
        if (data.length === 1 && !instanceName) {
          onUpdate({ instanceName: data[0].instanceName });
        }
      } catch (error) {
        console.error('Error loading instances:', error);
      } finally {
        setLoadingInstances(false);
      }
    };

    loadInstances();
  }, []);

  // Update sending state based on execution status
  useEffect(() => {
    if (executionStatus?.status === 'running') {
      setIsSending(true);
    } else {
      setIsSending(false);
    }
  }, [executionStatus]);

  const handleTest = async () => {
    if (onTest && instanceName && selectedTestLead) {
      setIsSending(true);
      await onTest(selectedTestLead, instanceName, forceWithoutConversation);
    }
  };

  const getStatusIcon = () => {
    if (!executionStatus) return null;

    switch (executionStatus.status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (!executionStatus) return '';

    switch (executionStatus.status) {
      case 'running':
        return 'border-blue-500/50 bg-blue-500/5';
      case 'success':
        return 'border-green-500/50 bg-green-500/5';
      case 'error':
        return 'border-red-500/50 bg-red-500/5';
      default:
        return '';
    }
  };

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newMsg = message.slice(0, start) + variable + message.slice(end);
    onUpdate({ message: newMsg });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const variables = [
    { label: 'Nome', value: '{{lead.name}}' },
    { label: 'Telefone', value: '{{lead.phone}}' },
    { label: 'Empresa', value: '{{lead.company}}' },
  ];

  return (
    <div className="space-y-3">
      {/* Message Input */}
      <textarea
        ref={textareaRef}
        className="w-full p-2 text-sm bg-background border rounded resize-none focus:ring-2 focus:ring-primary/50"
        placeholder="Digite a mensagem..."
        rows={3}
        value={message}
        onChange={(e) => onUpdate({ message: e.target.value })}
      />

      {/* Variable Chips */}
      <div className="flex flex-wrap gap-1">
        {variables.map(v => (
          <button
            key={v.value}
            type="button"
            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            onClick={() => insertVariable(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* URL Button */}
      {!showUrlButton ? (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={() => setShowUrlButton(true)}
        >
          <Plus className="w-3 h-3" /> Botão de URL
        </button>
      ) : (
        <div className="space-y-1.5 p-2 bg-muted/50 rounded border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium flex items-center gap-1"><Link2 className="w-3 h-3" /> Botão de URL</span>
            <button type="button" className="text-[10px] text-destructive hover:underline" onClick={() => { setShowUrlButton(false); onUpdate({ url_button: null }); }}>Remover</button>
          </div>
          <input
            type="text"
            className="w-full p-1.5 text-xs bg-background border rounded"
            placeholder="Texto do botão..."
            value={urlButton?.label || ''}
            onChange={(e) => onUpdate({ url_button: { label: e.target.value, url: urlButton?.url || '' } })}
          />
          <input
            type="url"
            className="w-full p-1.5 text-xs bg-background border rounded"
            placeholder="https://..."
            value={urlButton?.url || ''}
            onChange={(e) => onUpdate({ url_button: { label: urlButton?.label || '', url: e.target.value } })}
          />
        </div>
      )}

      {/* Instance Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" />
          Instância WhatsApp
        </Label>
        <Select
          value={instanceName}
          onValueChange={(value) => onUpdate({ instanceName: value })}
          disabled={loadingInstances}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={loadingInstances ? "Carregando..." : "Selecione a instância"} />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.instanceName} value={instance.instanceName}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      instance.connectionStatus === 'open' ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                  {instance.instanceName}
                </div>
              </SelectItem>
            ))}
            {instances.length === 0 && !loadingInstances && (
              <SelectItem value="none" disabled>
                Nenhuma instância conectada
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Settings Collapsible */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs w-full justify-start">
            <Settings2 className="w-3 h-3 mr-1" />
            Configurações avançadas
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-3">
          {/* Force Send Checkbox */}
          <div className="flex items-start gap-2">
            <Checkbox
              id={`force-${node.id}`}
              checked={forceWithoutConversation}
              onCheckedChange={(checked) => onUpdate({ forceWithoutConversation: !!checked })}
            />
            <Label htmlFor={`force-${node.id}`} className="text-xs text-muted-foreground leading-tight">
              Tentar enviar mesmo se nunca conversou
            </Label>
          </div>

          {/* Test Section */}
          {isTestingAvailable && testLeads.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <Label className="text-xs font-medium">Testar envio</Label>
              <Select value={selectedTestLead} onValueChange={setSelectedTestLead}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione um lead de teste" />
                </SelectTrigger>
                <SelectContent>
                  {testLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <span>{lead.name}</span>
                        <span className="text-muted-foreground">({lead.phone})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                disabled={!instanceName || !selectedTestLead || !message.trim() || isSending}
                onClick={handleTest}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 mr-1" />
                    Enviar mensagem de teste
                  </>
                )}
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Execution Status */}
      {executionStatus && (
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded border text-xs',
            getStatusColor()
          )}
        >
          {getStatusIcon()}
          <span className="flex-1">{executionStatus.message}</span>
          {executionStatus.timestamp && (
            <span className="text-muted-foreground text-[10px]">
              {new Date(executionStatus.timestamp).toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
