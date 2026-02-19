import { useState, useEffect } from 'react';
import { BotNode } from '@/hooks/useSalesBots';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';

interface NewNodeContentsProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
  allNodes?: BotNode[];
}

const nodeConfig: Record<string, string> = {
  send_message: 'Enviar Mensagem',
  react: 'Reagir',
  comment: 'Comentário',
  whatsapp_list: 'Lista WhatsApp',
  condition: 'Condição',
  action: 'Ação',
  round_robin: 'Round Robin',
  wait: 'Aguardar',
  tag: 'Aplicar Tag',
  move_stage: 'Mover Etapa',
  validate: 'Validação',
  goto: 'Ir para etapa',
  stop: 'Parar bot',
  change_responsible: 'Mudar Responsável',
  add_note: 'Adicionar Nota',
};

export function NewNodeContents({ node, onUpdate, allNodes = [] }: NewNodeContentsProps) {
  switch (node.type) {
    case 'validate':
      return <ValidateContent node={node} onUpdate={onUpdate} />;
    case 'goto':
      return <GotoContent node={node} onUpdate={onUpdate} allNodes={allNodes} />;
    case 'stop':
      return <StopContent />;
    case 'change_responsible':
      return <ChangeResponsibleContent node={node} onUpdate={onUpdate} />;
    case 'add_note':
      return <AddNoteContent node={node} onUpdate={onUpdate} />;
    default:
      return null;
  }
}

function ValidateContent({ node, onUpdate }: { node: BotNode; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2">
      <select
        className="w-full p-2 text-sm bg-background border rounded"
        value={(node.data.validation_type as string) || 'any'}
        onChange={(e) => onUpdate({ validation_type: e.target.value })}
      >
        <option value="any">Qualquer resposta</option>
        <option value="number">Contém números</option>
        <option value="email">Contém email válido</option>
        <option value="text">Contém texto</option>
        <option value="cpf">Contém CPF</option>
      </select>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Válido ✓</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Inválido ✗</span>
      </div>
    </div>
  );
}

function GotoContent({ node, onUpdate, allNodes }: { node: BotNode; onUpdate: (d: Record<string, unknown>) => void; allNodes: BotNode[] }) {
  const otherNodes = allNodes.filter(n => n.id !== node.id);

  return (
    <div className="space-y-2">
      <select
        className="w-full p-2 text-sm bg-background border rounded"
        value={(node.data.target_node_id as string) || ''}
        onChange={(e) => onUpdate({ target_node_id: e.target.value })}
      >
        <option value="">Selecione o nó destino...</option>
        {otherNodes.map((n, i) => (
          <option key={n.id} value={n.id}>
            Nó {i + 1} — {nodeConfig[n.type] || n.type}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-muted-foreground">O fluxo volta para o nó selecionado (loop).</p>
    </div>
  );
}

function StopContent() {
  return (
    <div className="text-sm text-muted-foreground p-2 bg-red-500/5 border border-red-500/20 rounded text-center">
      🛑 Fluxo encerrado aqui
    </div>
  );
}

function ChangeResponsibleContent({ node, onUpdate }: { node: BotNode; onUpdate: (d: Record<string, unknown>) => void }) {
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const { workspaceId } = useWorkspace();
  const mode = (node.data.mode as string) || 'specific';

  useEffect(() => {
    if (!workspaceId) return;
    supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('role', ['seller', 'manager'])
      .then(async ({ data }) => {
        if (!data) return;
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('user_id', userIds);
        setMembers(profiles || []);
      });
  }, [workspaceId]);

  return (
    <div className="space-y-2">
      <select
        className="w-full p-2 text-sm bg-background border rounded"
        value={mode}
        onChange={(e) => onUpdate({ mode: e.target.value })}
      >
        <option value="specific">Vendedor específico</option>
        <option value="round_robin">Round Robin automático</option>
      </select>
      {mode === 'specific' && (
        <select
          className="w-full p-2 text-sm bg-background border rounded"
          value={(node.data.user_id as string) || ''}
          onChange={(e) => onUpdate({ user_id: e.target.value })}
        >
          <option value="">Selecione...</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      )}
      {mode === 'round_robin' && (
        <p className="text-[10px] text-muted-foreground">Distribui automaticamente entre os membros da equipe.</p>
      )}
    </div>
  );
}

function AddNoteContent({ node, onUpdate }: { node: BotNode; onUpdate: (d: Record<string, unknown>) => void }) {
  return (
    <textarea
      className="w-full p-2 text-sm bg-background border rounded resize-none"
      placeholder="Digite a nota interna..."
      rows={3}
      value={(node.data.note as string) || ''}
      onChange={(e) => onUpdate({ note: e.target.value })}
    />
  );
}
