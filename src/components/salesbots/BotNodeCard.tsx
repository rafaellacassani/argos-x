import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  ThumbsUp,
  MessageCircle,
  List,
  GitBranch,
  Zap,
  Users,
  Clock,
  Tag,
  ArrowRight,
  GripVertical,
  Trash2,
  ShieldCheck,
  CornerDownRight,
  StopCircle,
  UserCheck,
  StickyNote,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotNode } from '@/hooks/useSalesBots';
import { ExecutionStatus, TestLead } from '@/hooks/useBotExecution';
import { Button } from '@/components/ui/button';
import { SendMessageNodeContent } from './SendMessageNodeContent';
import { WaitNodeContent } from './WaitNodeContent';
import { ConditionNodeContent } from './ConditionNodeContent';
import { NewNodeContents } from './NewNodeContents';

interface BotNodeCardProps {
  node: BotNode;
  isSelected: boolean;
  isConnecting: boolean;
  nodeIndex: number;
  onSelect: () => void;
  onUpdate: (data: Record<string, unknown>) => void;
  onMove: (position: { x: number; y: number }) => void;
  onStartConnect: (sourceHandle?: string) => void;
  onEndConnect: (targetId: string) => void;
  onDelete: () => void;
  executionStatus?: ExecutionStatus;
  onTestNode?: (nodeId: string, leadId: string, instanceName: string, forceWithoutConversation: boolean) => void;
  testLeads?: TestLead[];
  allNodes?: BotNode[];
}

const nodeConfig: Record<string, { icon: typeof MessageSquare; label: string; accent: string }> = {
  send_message: { icon: MessageSquare, label: 'Message', accent: 'bg-blue-500' },
  react: { icon: ThumbsUp, label: 'Reagir', accent: 'bg-yellow-500' },
  comment: { icon: MessageCircle, label: 'Comentário', accent: 'bg-gray-500' },
  whatsapp_list: { icon: List, label: 'Lista WhatsApp', accent: 'bg-green-500' },
  condition: { icon: GitBranch, label: 'Condição', accent: 'bg-purple-500' },
  action: { icon: Zap, label: 'Ação', accent: 'bg-orange-500' },
  round_robin: { icon: Users, label: 'Round Robin', accent: 'bg-pink-500' },
  wait: { icon: Clock, label: 'Aguardar', accent: 'bg-indigo-500' },
  tag: { icon: Tag, label: 'Aplicar Tag', accent: 'bg-teal-500' },
  move_stage: { icon: ArrowRight, label: 'Mover Etapa', accent: 'bg-cyan-500' },
  validate: { icon: ShieldCheck, label: 'Validação', accent: 'bg-emerald-500' },
  goto: { icon: CornerDownRight, label: 'Ir para etapa', accent: 'bg-slate-500' },
  stop: { icon: StopCircle, label: 'Parar bot', accent: 'bg-red-500' },
  change_responsible: { icon: UserCheck, label: 'Mudar Responsável', accent: 'bg-violet-500' },
  add_note: { icon: StickyNote, label: 'Adicionar Nota', accent: 'bg-amber-500' },
};

export function BotNodeCard({
  node,
  isSelected,
  isConnecting,
  nodeIndex,
  onSelect,
  onUpdate,
  onMove,
  onStartConnect,
  onEndConnect,
  onDelete,
  executionStatus,
  onTestNode,
  testLeads = [],
  allNodes = [],
}: BotNodeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const config = nodeConfig[node.type] || nodeConfig.send_message;
  const Icon = config.icon;

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({ x: e.clientX - node.position.x, y: e.clientY - node.position.y });
    onSelect();
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      onMove({ x: Math.max(0, e.clientX - dragOffset.x), y: Math.max(0, e.clientY - dragOffset.y) });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, dragOffset, onMove]);

  const hasDualOutputs = node.type === 'condition' || node.type === 'validate';

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute w-[340px] rounded-xl bg-card shadow-md cursor-move transition-all border border-border/60',
        isSelected && 'ring-2 ring-primary/50 shadow-lg',
        isDragging && 'shadow-xl z-50 scale-[1.02]'
      )}
      style={{ left: node.position.x, top: node.position.y }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted text-xs font-bold text-muted-foreground">
          {nodeIndex}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">{config.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 no-drag text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Content area */}
      <div className="p-3 no-drag">
        <NodeContent node={node} onUpdate={onUpdate} executionStatus={executionStatus} onTestNode={onTestNode} testLeads={testLeads} allNodes={allNodes} />
      </div>

      {/* Connection input (top) */}
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-card border-2 border-muted-foreground/30 cursor-pointer hover:border-primary hover:scale-125 transition-all no-drag z-10"
        onMouseUp={() => onEndConnect(node.id)}
      />

      {/* Connection output (bottom) */}
      {!hasDualOutputs && (
        <div
          className={cn(
            'absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center justify-center w-5 h-5 rounded-full bg-muted-foreground/20 border-2 border-muted-foreground/30 cursor-pointer hover:bg-primary hover:border-primary hover:scale-125 transition-all no-drag z-10',
            isConnecting && 'bg-primary border-primary animate-pulse'
          )}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartConnect(); }}
        >
          <Plus className="w-3 h-3 text-muted-foreground" />
        </div>
      )}

      {hasDualOutputs && (
        <>
          <div
            className={cn(
              'absolute -bottom-2.5 left-1/4 -translate-x-1/2 w-5 h-5 rounded-full bg-green-500 cursor-pointer hover:scale-125 transition-all no-drag text-[8px] font-bold text-white flex items-center justify-center z-10',
              isConnecting && 'animate-pulse'
            )}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartConnect('yes'); }}
          >
            S
          </div>
          <div
            className={cn(
              'absolute -bottom-2.5 left-3/4 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 cursor-pointer hover:scale-125 transition-all no-drag text-[8px] font-bold text-white flex items-center justify-center z-10',
              isConnecting && 'animate-pulse'
            )}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartConnect('no'); }}
          >
            N
          </div>
        </>
      )}
    </motion.div>
  );
}

interface NodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
  executionStatus?: ExecutionStatus;
  onTestNode?: (nodeId: string, leadId: string, instanceName: string, forceWithoutConversation: boolean) => void;
  testLeads?: TestLead[];
  allNodes?: BotNode[];
}

function NodeContent({ node, onUpdate, executionStatus, onTestNode, testLeads = [], allNodes = [] }: NodeContentProps) {
  switch (node.type) {
    case 'send_message':
      return (
        <SendMessageNodeContent
          node={node}
          onUpdate={onUpdate}
          executionStatus={executionStatus}
          testLeads={testLeads}
          isTestingAvailable={!!onTestNode}
          onTest={(leadId, instanceName, forceWithoutConversation) => {
            if (onTestNode) onTestNode(node.id, leadId, instanceName, forceWithoutConversation);
          }}
        />
      );

    case 'react':
      return (
        <div className="flex gap-2 flex-wrap">
          {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'].map(emoji => (
            <button key={emoji} className={cn('text-xl p-1 rounded hover:bg-accent', node.data.emoji === emoji && 'bg-accent ring-2 ring-primary')} onClick={() => onUpdate({ emoji })}>
              {emoji}
            </button>
          ))}
        </div>
      );

    case 'comment':
      return <textarea className="w-full p-2 text-sm bg-background border rounded resize-none" placeholder="Nota interna..." rows={2} value={(node.data.text as string) || ''} onChange={(e) => onUpdate({ text: e.target.value })} />;

    case 'condition':
      return <ConditionNodeContent node={node} onUpdate={onUpdate} />;

    case 'action':
      return (
        <div className="space-y-2">
          <select className="w-full p-2 text-sm bg-background border rounded" value={(node.data.actionType as string) || 'webhook'} onChange={(e) => onUpdate({ actionType: e.target.value })}>
            <option value="webhook">Webhook n8n</option>
            <option value="api">API externa</option>
          </select>
          <input type="url" className="w-full p-2 text-sm bg-background border rounded" placeholder="URL do webhook..." value={(node.data.webhookUrl as string) || ''} onChange={(e) => onUpdate({ webhookUrl: e.target.value })} />
          <textarea className="w-full p-2 text-sm bg-background border rounded resize-none font-mono text-xs" placeholder='{"lead": "{{lead}}"}' rows={2} value={typeof node.data.payload === 'object' ? JSON.stringify(node.data.payload, null, 2) : ''} onChange={(e) => { try { onUpdate({ payload: JSON.parse(e.target.value) }); } catch { /* noop */ } }} />
        </div>
      );

    case 'wait':
      return <WaitNodeContent node={node} onUpdate={onUpdate} />;

    case 'whatsapp_list':
      return (
        <div className="space-y-2">
          <input type="text" className="w-full p-2 text-sm bg-background border rounded" placeholder="Título da lista..." value={(node.data.title as string) || ''} onChange={(e) => onUpdate({ title: e.target.value })} />
          <input type="text" className="w-full p-2 text-sm bg-background border rounded" placeholder="Texto do botão..." value={(node.data.buttonText as string) || 'Ver opções'} onChange={(e) => onUpdate({ buttonText: e.target.value })} />
        </div>
      );

    case 'round_robin':
      return <div className="text-sm text-muted-foreground"><p>Distribui leads entre os membros da equipe de forma rotativa.</p></div>;

    case 'tag':
      return (
        <div className="space-y-2">
          <select className="w-full p-2 text-sm bg-background border rounded" value={(node.data.action as string) || 'add'} onChange={(e) => onUpdate({ action: e.target.value })}>
            <option value="add">Adicionar tag</option>
            <option value="remove">Remover tag</option>
          </select>
          <input type="text" className="w-full p-2 text-sm bg-background border rounded" placeholder="Nome da tag..." value={(node.data.tagName as string) || ''} onChange={(e) => onUpdate({ tagName: e.target.value })} />
        </div>
      );

    case 'move_stage':
      return <input type="text" className="w-full p-2 text-sm bg-background border rounded" placeholder="Nome da etapa..." value={(node.data.stageName as string) || ''} onChange={(e) => onUpdate({ stageName: e.target.value })} />;

    case 'validate':
    case 'goto':
    case 'stop':
    case 'change_responsible':
    case 'add_note':
      return <NewNodeContents node={node} onUpdate={onUpdate} allNodes={allNodes} />;

    default:
      return null;
  }
}
