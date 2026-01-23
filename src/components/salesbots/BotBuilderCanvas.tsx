import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BotNode, BotEdge } from '@/hooks/useSalesBots';
import { useBotExecution, TestLead } from '@/hooks/useBotExecution';
import { BotNodeCard } from './BotNodeCard';
import { NodeTypeSelector } from './NodeTypeSelector';

interface BotBuilderCanvasProps {
  nodes: BotNode[];
  edges: BotEdge[];
  onNodesChange: (nodes: BotNode[]) => void;
  onEdgesChange: (edges: BotEdge[]) => void;
}

export function BotBuilderCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: BotBuilderCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeSelectorPosition, setNodeSelectorPosition] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [testLeads, setTestLeads] = useState<TestLead[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    executionStatuses,
    fetchTestLeads,
    testNodeExecution,
  } = useBotExecution();

  // Load test leads on mount
  useEffect(() => {
    const loadTestLeads = async () => {
      const leads = await fetchTestLeads();
      setTestLeads(leads);
    };
    loadTestLeads();
  }, [fetchTestLeads]);

  const handleTestNode = useCallback(async (
    nodeId: string,
    leadId: string,
    instanceName: string,
    forceWithoutConversation: boolean
  ) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    await testNodeExecution(node, leadId, instanceName, forceWithoutConversation);
  }, [nodes, testNodeExecution]);

  const handleAddNode = useCallback((type: string, position?: { x: number; y: number }) => {
    const newNode: BotNode = {
      id: `node_${Date.now()}`,
      type,
      position: position || { x: 100 + nodes.length * 50, y: 100 + nodes.length * 30 },
      data: getDefaultNodeData(type),
    };
    onNodesChange([...nodes, newNode]);
    setShowNodeSelector(false);
  }, [nodes, onNodesChange]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onEdgesChange(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [nodes, edges, onNodesChange, onEdgesChange]);

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, [nodes, onNodesChange]);

  const handleNodeMove = useCallback((nodeId: string, position: { x: number; y: number }) => {
    onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, position } : n));
  }, [nodes, onNodesChange]);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const existingEdge = edges.find(e => e.source === sourceId && e.target === targetId);
    if (existingEdge) return;

    const newEdge: BotEdge = {
      id: `edge_${Date.now()}`,
      source: sourceId,
      target: targetId,
    };
    onEdgesChange([...edges, newEdge]);
  }, [edges, onEdgesChange]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNode(null);
      setConnectingFrom(null);
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setNodeSelectorPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setShowNodeSelector(true);
  };

  return (
    <div className="relative h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNodeSelectorPosition({ x: 200, y: 200 });
            setShowNodeSelector(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar bloco
        </Button>
        {selectedNode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteNode(selectedNode)}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full bg-muted/30 overflow-auto relative"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '2000px', minHeight: '1500px' }}>
          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sourceX = sourceNode.position.x + 150;
            const sourceY = sourceNode.position.y + 60;
            const targetX = targetNode.position.x + 150;
            const targetY = targetNode.position.y;

            const midY = (sourceY + targetY) / 2;
            const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  className="animate-pulse"
                />
                <circle
                  cx={targetX}
                  cy={targetY}
                  r="4"
                  fill="hsl(var(--primary))"
                />
              </g>
            );
          })}
          
          {/* Connection preview line */}
          {connectingFrom && (
            <line
              x1={nodes.find(n => n.id === connectingFrom)?.position.x ?? 0 + 150}
              y1={nodes.find(n => n.id === connectingFrom)?.position.y ?? 0 + 60}
              x2={nodeSelectorPosition.x}
              y2={nodeSelectorPosition.y}
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.5"
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <BotNodeCard
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            isConnecting={connectingFrom === node.id}
            onSelect={() => setSelectedNode(node.id)}
            onUpdate={(data) => handleNodeUpdate(node.id, data)}
            onMove={(position) => handleNodeMove(node.id, position)}
            onStartConnect={() => setConnectingFrom(node.id)}
            onEndConnect={(targetId) => {
              if (connectingFrom && connectingFrom !== targetId) {
                handleConnect(connectingFrom, targetId);
              }
              setConnectingFrom(null);
            }}
            onDelete={() => handleDeleteNode(node.id)}
            executionStatus={executionStatuses[node.id]}
            onTestNode={handleTestNode}
            testLeads={testLeads}
          />
        ))}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <p className="text-muted-foreground mb-4">
                Clique duas vezes no canvas para adicionar um bloco
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setNodeSelectorPosition({ x: 300, y: 200 });
                  setShowNodeSelector(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar primeiro bloco
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Node Type Selector */}
      {showNodeSelector && (
        <NodeTypeSelector
          position={nodeSelectorPosition}
          onSelect={(type) => handleAddNode(type, nodeSelectorPosition)}
          onClose={() => setShowNodeSelector(false)}
        />
      )}
    </div>
  );
}

function getDefaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case 'send_message':
      return { message: '', delay: 0 };
    case 'react':
      return { emoji: '👍' };
    case 'comment':
      return { text: '' };
    case 'whatsapp_list':
      return { title: '', description: '', buttonText: 'Ver opções', sections: [] };
    case 'condition':
      return { field: 'message', operator: 'contains', value: '' };
    case 'action':
      return { actionType: 'webhook', webhookUrl: '', payload: {} };
    case 'round_robin':
      return { users: [], currentIndex: 0 };
    case 'wait':
      return { duration: 1, unit: 'hours' };
    case 'tag':
      return { tagId: '', action: 'add' };
    case 'move_stage':
      return { stageId: '' };
    default:
      return {};
  }
}
