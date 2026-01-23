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
  Circle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotNode } from '@/hooks/useSalesBots';
import { Button } from '@/components/ui/button';

interface BotNodeCardProps {
  node: BotNode;
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: () => void;
  onUpdate: (data: Record<string, unknown>) => void;
  onMove: (position: { x: number; y: number }) => void;
  onStartConnect: () => void;
  onEndConnect: (targetId: string) => void;
  onDelete: () => void;
}

const nodeConfig: Record<string, { icon: typeof MessageSquare; label: string; color: string }> = {
  send_message: { icon: MessageSquare, label: 'Enviar Mensagem', color: 'border-blue-500 bg-blue-500/10' },
  react: { icon: ThumbsUp, label: 'Reagir', color: 'border-yellow-500 bg-yellow-500/10' },
  comment: { icon: MessageCircle, label: 'Comentário', color: 'border-gray-500 bg-gray-500/10' },
  whatsapp_list: { icon: List, label: 'Lista WhatsApp', color: 'border-green-500 bg-green-500/10' },
  condition: { icon: GitBranch, label: 'Condição', color: 'border-purple-500 bg-purple-500/10' },
  action: { icon: Zap, label: 'Ação', color: 'border-orange-500 bg-orange-500/10' },
  round_robin: { icon: Users, label: 'Round Robin', color: 'border-pink-500 bg-pink-500/10' },
  wait: { icon: Clock, label: 'Aguardar', color: 'border-indigo-500 bg-indigo-500/10' },
  tag: { icon: Tag, label: 'Aplicar Tag', color: 'border-teal-500 bg-teal-500/10' },
  move_stage: { icon: ArrowRight, label: 'Mover Etapa', color: 'border-cyan-500 bg-cyan-500/10' },
};

export function BotNodeCard({
  node,
  isSelected,
  isConnecting,
  onSelect,
  onUpdate,
  onMove,
  onStartConnect,
  onEndConnect,
  onDelete,
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
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
    onSelect();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      onMove({
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, onMove]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'absolute w-[300px] rounded-lg border-2 bg-card shadow-lg cursor-move transition-shadow',
        config.color,
        isSelected && 'ring-2 ring-primary ring-offset-2',
        isDragging && 'shadow-xl z-50'
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/50">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <Icon className="w-4 h-4" />
        <span className="font-medium text-sm flex-1">{config.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 no-drag text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-3 no-drag">
        <NodeContent node={node} onUpdate={onUpdate} />
      </div>

      {/* Connection Points */}
      {/* Input (top) */}
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary cursor-pointer hover:scale-125 transition-transform no-drag"
        onMouseUp={() => onEndConnect(node.id)}
      />

      {/* Output (bottom) */}
      <div
        className={cn(
          'absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary cursor-pointer hover:scale-125 transition-transform no-drag',
          isConnecting && 'animate-pulse'
        )}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect();
        }}
      >
        <Circle className="w-full h-full text-primary-foreground" />
      </div>

      {/* Condition branches */}
      {node.type === 'condition' && (
        <>
          <div className="absolute -bottom-2 left-1/4 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500 cursor-pointer hover:scale-125 transition-transform no-drag text-[8px] font-bold text-white flex items-center justify-center">
            S
          </div>
          <div className="absolute -bottom-2 left-3/4 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 cursor-pointer hover:scale-125 transition-transform no-drag text-[8px] font-bold text-white flex items-center justify-center">
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
}

function NodeContent({ node, onUpdate }: NodeContentProps) {
  switch (node.type) {
    case 'send_message':
      return (
        <textarea
          className="w-full p-2 text-sm bg-background border rounded resize-none"
          placeholder="Digite a mensagem..."
          rows={3}
          value={(node.data.message as string) || ''}
          onChange={(e) => onUpdate({ message: e.target.value })}
        />
      );

    case 'react':
      return (
        <div className="flex gap-2 flex-wrap">
          {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'].map(emoji => (
            <button
              key={emoji}
              className={cn(
                'text-xl p-1 rounded hover:bg-accent',
                node.data.emoji === emoji && 'bg-accent ring-2 ring-primary'
              )}
              onClick={() => onUpdate({ emoji })}
            >
              {emoji}
            </button>
          ))}
        </div>
      );

    case 'comment':
      return (
        <textarea
          className="w-full p-2 text-sm bg-background border rounded resize-none"
          placeholder="Nota interna..."
          rows={2}
          value={(node.data.text as string) || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
      );

    case 'condition':
      return (
        <div className="space-y-2">
          <select
            className="w-full p-2 text-sm bg-background border rounded"
            value={(node.data.field as string) || 'message'}
            onChange={(e) => onUpdate({ field: e.target.value })}
          >
            <option value="message">Mensagem</option>
            <option value="tag">Tag</option>
            <option value="stage">Etapa do funil</option>
            <option value="value">Valor do lead</option>
          </select>
          <select
            className="w-full p-2 text-sm bg-background border rounded"
            value={(node.data.operator as string) || 'contains'}
            onChange={(e) => onUpdate({ operator: e.target.value })}
          >
            <option value="contains">Contém</option>
            <option value="equals">É igual a</option>
            <option value="starts_with">Começa com</option>
            <option value="ends_with">Termina com</option>
            <option value="not_contains">Não contém</option>
          </select>
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="Valor..."
            value={(node.data.value as string) || ''}
            onChange={(e) => onUpdate({ value: e.target.value })}
          />
        </div>
      );

    case 'action':
      return (
        <div className="space-y-2">
          <select
            className="w-full p-2 text-sm bg-background border rounded"
            value={(node.data.actionType as string) || 'webhook'}
            onChange={(e) => onUpdate({ actionType: e.target.value })}
          >
            <option value="webhook">Webhook n8n</option>
            <option value="api">API externa</option>
          </select>
          <input
            type="url"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="URL do webhook..."
            value={(node.data.webhookUrl as string) || ''}
            onChange={(e) => onUpdate({ webhookUrl: e.target.value })}
          />
          <textarea
            className="w-full p-2 text-sm bg-background border rounded resize-none font-mono text-xs"
            placeholder='{"lead": "{{lead}}"}'
            rows={2}
            value={typeof node.data.payload === 'object' ? JSON.stringify(node.data.payload, null, 2) : ''}
            onChange={(e) => {
              try {
                const payload = JSON.parse(e.target.value);
                onUpdate({ payload });
              } catch {
                // Invalid JSON, don't update
              }
            }}
          />
        </div>
      );

    case 'wait':
      return (
        <div className="flex gap-2">
          <input
            type="number"
            className="w-20 p-2 text-sm bg-background border rounded"
            min={1}
            value={(node.data.duration as number) || 1}
            onChange={(e) => onUpdate({ duration: parseInt(e.target.value) || 1 })}
          />
          <select
            className="flex-1 p-2 text-sm bg-background border rounded"
            value={(node.data.unit as string) || 'hours'}
            onChange={(e) => onUpdate({ unit: e.target.value })}
          >
            <option value="minutes">Minutos</option>
            <option value="hours">Horas</option>
            <option value="days">Dias</option>
          </select>
        </div>
      );

    case 'whatsapp_list':
      return (
        <div className="space-y-2">
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="Título da lista..."
            value={(node.data.title as string) || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
          />
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="Texto do botão..."
            value={(node.data.buttonText as string) || 'Ver opções'}
            onChange={(e) => onUpdate({ buttonText: e.target.value })}
          />
        </div>
      );

    case 'round_robin':
      return (
        <div className="text-sm text-muted-foreground">
          <p>Distribui leads entre os membros da equipe de forma rotativa.</p>
        </div>
      );

    case 'tag':
      return (
        <div className="space-y-2">
          <select
            className="w-full p-2 text-sm bg-background border rounded"
            value={(node.data.action as string) || 'add'}
            onChange={(e) => onUpdate({ action: e.target.value })}
          >
            <option value="add">Adicionar tag</option>
            <option value="remove">Remover tag</option>
          </select>
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="Nome da tag..."
            value={(node.data.tagName as string) || ''}
            onChange={(e) => onUpdate({ tagName: e.target.value })}
          />
        </div>
      );

    case 'move_stage':
      return (
        <input
          type="text"
          className="w-full p-2 text-sm bg-background border rounded"
          placeholder="Nome da etapa..."
          value={(node.data.stageName as string) || ''}
          onChange={(e) => onUpdate({ stageName: e.target.value })}
        />
      );

    default:
      return null;
  }
}
