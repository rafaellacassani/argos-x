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
  X,
  ShieldCheck,
  CornerDownRight,
  StopCircle,
  UserCheck,
  StickyNote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeTypeSelectorProps {
  position: { x: number; y: number };
  onSelect: (type: string) => void;
  onClose: () => void;
}

const nodeTypes = [
  {
    type: 'send_message',
    icon: MessageSquare,
    label: 'Enviar Mensagem',
    description: 'Envia uma mensagem de texto',
    color: 'bg-blue-500',
  },
  {
    type: 'react',
    icon: ThumbsUp,
    label: 'Reagir',
    description: 'Reage à mensagem com emoji',
    color: 'bg-yellow-500',
  },
  {
    type: 'comment',
    icon: MessageCircle,
    label: 'Comentário',
    description: 'Adiciona um comentário interno',
    color: 'bg-gray-500',
  },
  {
    type: 'whatsapp_list',
    icon: List,
    label: 'Lista WhatsApp',
    description: 'Envia lista interativa',
    color: 'bg-green-500',
  },
  {
    type: 'condition',
    icon: GitBranch,
    label: 'Condição',
    description: 'Bifurca o fluxo',
    color: 'bg-purple-500',
  },
  {
    type: 'action',
    icon: Zap,
    label: 'Ação',
    description: 'Executa webhook n8n',
    color: 'bg-orange-500',
  },
  {
    type: 'round_robin',
    icon: Users,
    label: 'Round Robin',
    description: 'Distribui entre usuários',
    color: 'bg-pink-500',
  },
  {
    type: 'wait',
    icon: Clock,
    label: 'Aguardar',
    description: 'Pausa antes de continuar',
    color: 'bg-indigo-500',
  },
  {
    type: 'tag',
    icon: Tag,
    label: 'Aplicar Tag',
    description: 'Adiciona/remove tag do lead',
    color: 'bg-teal-500',
  },
  {
    type: 'move_stage',
    icon: ArrowRight,
    label: 'Mover Etapa',
    description: 'Move lead no funil',
    color: 'bg-cyan-500',
  },
  {
    type: 'validate',
    icon: ShieldCheck,
    label: 'Validação',
    description: 'Verifica formato da resposta',
    color: 'bg-emerald-500',
  },
  {
    type: 'goto',
    icon: CornerDownRight,
    label: 'Ir para etapa',
    description: 'Salta para outro nó (loop)',
    color: 'bg-slate-500',
  },
  {
    type: 'stop',
    icon: StopCircle,
    label: 'Parar bot',
    description: 'Encerra a execução do fluxo',
    color: 'bg-red-500',
  },
  {
    type: 'change_responsible',
    icon: UserCheck,
    label: 'Mudar Responsável',
    description: 'Atribui lead a um vendedor',
    color: 'bg-violet-500',
  },
  {
    type: 'add_note',
    icon: StickyNote,
    label: 'Adicionar Nota',
    description: 'Registra nota interna no lead',
    color: 'bg-amber-500',
  },
];

export function NodeTypeSelector({ position, onSelect, onClose }: NodeTypeSelectorProps) {
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Selector */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute z-50 bg-popover border rounded-lg shadow-xl p-4 w-80"
        style={{ 
          left: Math.min(position.x, window.innerWidth - 350),
          top: Math.min(position.y, window.innerHeight - 500),
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Adicionar Bloco</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {nodeTypes.map(({ type, icon: Icon, label, description, color }) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="flex flex-col items-start p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
            >
              <div className={`p-1.5 rounded ${color} text-white mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="font-medium text-sm">{label}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">
                {description}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
