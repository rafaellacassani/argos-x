import { BotNode, BotEdge } from '@/hooks/useSalesBots';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface BotPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: BotNode[];
  edges: BotEdge[];
}

function findStartNode(nodes: BotNode[], edges: BotEdge[]): BotNode | null {
  const targetIds = new Set(edges.map(e => e.target));
  const start = nodes.find(n => !targetIds.has(n.id));
  return start || nodes[0] || null;
}

function getNextNodes(nodeId: string, edges: BotEdge[], nodes: BotNode[]): { node: BotNode; label?: string }[] {
  return edges
    .filter(e => e.source === nodeId)
    .map(e => {
      const node = nodes.find(n => n.id === e.target);
      return node ? { node, label: e.label } : null;
    })
    .filter(Boolean) as { node: BotNode; label?: string }[];
}

function walkFlow(startNode: BotNode, nodes: BotNode[], edges: BotEdge[], branch?: string): FlowStep[] {
  const steps: FlowStep[] = [];
  const visited = new Set<string>();
  let current: BotNode | null = startNode;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    steps.push(nodeToStep(current));

    if (current.type === 'condition' || current.type === 'validate') {
      const nexts = getNextNodes(current.id, edges, nodes);
      const trueNext = nexts.find(n => n.label === 'true') || nexts[0];
      const falseNext = nexts.find(n => n.label === 'false') || nexts[1];
      steps[steps.length - 1].branches = {
        trueBranch: trueNext ? walkFlow(trueNext.node, nodes, edges) : [],
        falseBranch: falseNext ? walkFlow(falseNext.node, nodes, edges) : [],
      };
      break;
    }

    if (current.type === 'stop') break;

    const nexts = getNextNodes(current.id, edges, nodes);
    current = nexts[0]?.node || null;
  }
  return steps;
}

interface FlowStep {
  type: string;
  content: string;
  isBotMessage: boolean;
  isAction: boolean;
  branches?: { trueBranch: FlowStep[]; falseBranch: FlowStep[] };
}

function nodeToStep(node: BotNode): FlowStep {
  switch (node.type) {
    case 'send_message':
      return { type: 'send_message', content: (node.data.message as string) || 'Mensagem vazia', isBotMessage: true, isAction: false };
    case 'wait': {
      const mode = (node.data.wait_mode as string) || 'timer';
      if (mode === 'message') return { type: 'wait', content: '⏸ Aguardando resposta do lead...', isBotMessage: false, isAction: true };
      if (mode === 'business_hours') return { type: 'wait', content: `🏢 Aguardando horário comercial (${node.data.start || '09:00'} — ${node.data.end || '18:00'})`, isBotMessage: false, isAction: true };
      const s = (node.data.seconds as number) || 0;
      return { type: 'wait', content: `⏱ Esperar ${s > 3600 ? Math.floor(s/3600)+'h ' : ''}${Math.floor((s%3600)/60)}min ${s%60}s`, isBotMessage: false, isAction: true };
    }
    case 'condition':
      return { type: 'condition', content: `Condição: ${node.data.field} ${node.data.operator} "${node.data.value}"`, isBotMessage: false, isAction: true };
    case 'validate':
      return { type: 'validate', content: `Validar: ${node.data.validation_type || 'any'}`, isBotMessage: false, isAction: true };
    case 'tag':
      return { type: 'tag', content: `⚡ ${node.data.action === 'remove' ? 'Remover' : 'Aplicar'} tag: ${node.data.tagName || ''}`, isBotMessage: false, isAction: true };
    case 'move_stage':
      return { type: 'move_stage', content: `⚡ Mover para etapa: ${node.data.stageName || ''}`, isBotMessage: false, isAction: true };
    case 'change_responsible':
      return { type: 'change_responsible', content: `⚡ Mudar responsável`, isBotMessage: false, isAction: true };
    case 'add_note':
      return { type: 'add_note', content: `📝 Nota: ${node.data.note || ''}`, isBotMessage: false, isAction: true };
    case 'stop':
      return { type: 'stop', content: '🛑 Fluxo encerrado', isBotMessage: false, isAction: true };
    case 'react':
      return { type: 'react', content: `Reagir: ${node.data.emoji || '👍'}`, isBotMessage: false, isAction: true };
    case 'whatsapp_list':
      return { type: 'whatsapp_list', content: `📋 Lista: ${node.data.title || 'Sem título'}`, isBotMessage: true, isAction: false };
    default:
      return { type: node.type, content: node.type, isBotMessage: false, isAction: true };
  }
}

function StepBubble({ step }: { step: FlowStep }) {
  if (step.branches) {
    return (
      <div className="space-y-2">
        <div className="flex justify-center">
          <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300">
            {step.content}
          </Badge>
        </div>
        <Tabs defaultValue="true" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-7">
            <TabsTrigger value="true" className="text-xs h-6">✅ Caminho Sim</TabsTrigger>
            <TabsTrigger value="false" className="text-xs h-6">❌ Caminho Não</TabsTrigger>
          </TabsList>
          <TabsContent value="true" className="space-y-2 mt-2">
            {step.branches.trueBranch.length > 0 ? step.branches.trueBranch.map((s, i) => <StepBubble key={i} step={s} />) : <p className="text-xs text-muted-foreground text-center">Nenhum nó conectado</p>}
          </TabsContent>
          <TabsContent value="false" className="space-y-2 mt-2">
            {step.branches.falseBranch.length > 0 ? step.branches.falseBranch.map((s, i) => <StepBubble key={i} step={s} />) : <p className="text-xs text-muted-foreground text-center">Nenhum nó conectado</p>}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (step.isAction) {
    return (
      <div className="flex justify-center">
        <Badge variant="secondary" className="text-xs font-normal">
          {step.content}
        </Badge>
      </div>
    );
  }

  return (
    <div className={cn('flex', step.isBotMessage ? 'justify-start' : 'justify-end')}>
      <div className={cn(
        'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
        step.isBotMessage
          ? 'bg-card border rounded-bl-none'
          : 'bg-primary text-primary-foreground rounded-br-none'
      )}>
        {step.content}
      </div>
    </div>
  );
}

export function BotPreviewDialog({ open, onOpenChange, nodes, edges }: BotPreviewDialogProps) {
  const startNode = findStartNode(nodes, edges);
  const steps = startNode ? walkFlow(startNode, nodes, edges) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Bot</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg min-h-[200px]">
          {steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Adicione nós ao fluxo para visualizar.</p>
          ) : (
            steps.map((step, i) => <StepBubble key={i} step={step} />)
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
