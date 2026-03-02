import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BotNode, BotEdge } from '@/hooks/useSalesBots';
import { useBotExecution, TestLead } from '@/hooks/useBotExecution';
import { BotNodeCard } from './BotNodeCard';
import { NodeTypeSelector } from './NodeTypeSelector';
import { migrateWaitConditions } from './WaitNodeContent';

interface BotBuilderCanvasProps {
  nodes: BotNode[];
  edges: BotEdge[];
  onNodesChange: (nodes: BotNode[]) => void;
  onEdgesChange: (edges: BotEdge[]) => void;
}

const NODE_WIDTH = 340;
const NODE_ESTIMATED_HEIGHT = 120;

const HANDLE_COLORS_HEX = [
  '#22c55e', '#3b82f6', '#f97316', '#a855f7',
  '#ec4899', '#06b6d4', '#eab308', '#ef4444',
];

export function BotBuilderCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
}: BotBuilderCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeSelectorPosition, setNodeSelectorPosition] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; handle?: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [testLeads, setTestLeads] = useState<TestLead[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    executionStatuses,
    fetchTestLeads,
    testNodeExecution,
  } = useBotExecution();

  useEffect(() => {
    const loadTestLeads = async () => {
      const leads = await fetchTestLeads();
      setTestLeads(leads);
    };
    loadTestLeads();
  }, [fetchTestLeads]);

  // Build node index map for numbering
  const nodeIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    nodes.forEach((n, i) => { map[n.id] = i + 1; });
    return map;
  }, [nodes]);

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

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newNode: BotNode = {
      id: `node_${Date.now()}`,
      type: node.type,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data },
    };
    onNodesChange([...nodes, newNode]);
  }, [nodes, onNodesChange]);

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
  }, [nodes, onNodesChange]);

  const handleNodeMove = useCallback((nodeId: string, position: { x: number; y: number }) => {
    onNodesChange(nodes.map(n => n.id === nodeId ? { ...n, position } : n));
  }, [nodes, onNodesChange]);

  const handleConnect = useCallback((sourceId: string, targetId: string, sourceHandle?: string) => {
    if (sourceId === targetId) return;
    const existingEdge = edges.find(e => e.source === sourceId && e.target === targetId && e.sourceHandle === sourceHandle);
    if (existingEdge) return;

    // Determine label for the edge
    let label: string | undefined;
    if (sourceHandle === 'yes') {
      label = 'Sim';
    } else if (sourceHandle === 'no') {
      label = 'Não';
    } else if (sourceHandle) {
      // Dynamic wait condition handle — find the condition label
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (sourceNode?.type === 'wait') {
        const conditions = migrateWaitConditions(sourceNode.data);
        const cond = conditions.find(c => c.id === sourceHandle);
        if (cond) label = cond.label;
      }
    }

    const newEdge: BotEdge = {
      id: `edge_${Date.now()}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      label,
    };
    onEdgesChange([...edges, newEdge]);
  }, [edges, nodes, onEdgesChange]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNode(null);
      setConnectingFrom(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!connectingFrom) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left + canvasRef.current!.scrollLeft, y: e.clientY - rect.top + canvasRef.current!.scrollTop });
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

  /**
   * Compute the source X position for an edge based on its sourceHandle
   */
  const getSourceX = (sourceNode: BotNode, edge: BotEdge): number => {
    const halfW = NODE_WIDTH / 2;

    // Standard yes/no handles
    if (edge.sourceHandle === 'yes') return sourceNode.position.x + halfW * 0.5;
    if (edge.sourceHandle === 'no') return sourceNode.position.x + halfW * 1.5;

    // Dynamic wait condition handles
    if (edge.sourceHandle && sourceNode.type === 'wait') {
      const conditions = migrateWaitConditions(sourceNode.data);
      const condIndex = conditions.findIndex(c => c.id === edge.sourceHandle);
      if (condIndex >= 0 && conditions.length > 0) {
        const totalWidth = conditions.length * 28; // gap between handles
        const startX = sourceNode.position.x + halfW - totalWidth / 2 + 14;
        return startX + condIndex * 28;
      }
    }

    // Default: center
    return sourceNode.position.x + halfW;
  };

  /**
   * Get edge color based on sourceHandle
   */
  const getEdgeStyle = (edge: BotEdge, sourceNode: BotNode): { color: string; markerId: string } => {
    if (edge.sourceHandle === 'yes') return { color: '#22c55e', markerId: 'arrowhead-green' };
    if (edge.sourceHandle === 'no') return { color: '#ef4444', markerId: 'arrowhead-red' };

    if (edge.sourceHandle && sourceNode.type === 'wait') {
      const conditions = migrateWaitConditions(sourceNode.data);
      const condIndex = conditions.findIndex(c => c.id === edge.sourceHandle);
      if (condIndex >= 0) {
        const color = HANDLE_COLORS_HEX[condIndex % HANDLE_COLORS_HEX.length];
        return { color, markerId: `arrowhead-cond-${condIndex}` };
      }
    }

    return { color: 'hsl(var(--muted-foreground) / 0.4)', markerId: 'arrowhead' };
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
          className="gap-2 bg-card shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Adicionar bloco
        </Button>
        {selectedNode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteNode(selectedNode)}
            className="gap-2 text-destructive hover:text-destructive bg-card shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full overflow-auto relative"
        style={{
          backgroundColor: 'hsl(var(--muted) / 0.3)',
          backgroundImage: `
            linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={() => setConnectingFrom(null)}
      >
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: '3000px', minHeight: '2000px' }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="hsl(var(--muted-foreground) / 0.4)" />
            </marker>
            <marker id="arrowhead-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="#22c55e" />
            </marker>
            <marker id="arrowhead-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M 0 0 L 8 3 L 0 6 Z" fill="#ef4444" />
            </marker>
            {/* Dynamic condition arrowheads */}
            {HANDLE_COLORS_HEX.map((color, i) => (
              <marker key={i} id={`arrowhead-cond-${i}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <path d="M 0 0 L 8 3 L 0 6 Z" fill={color} />
              </marker>
            ))}
          </defs>
          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sourceX = getSourceX(sourceNode, edge);
            const sourceY = sourceNode.position.y + NODE_ESTIMATED_HEIGHT;
            const halfW = NODE_WIDTH / 2;
            const targetX = targetNode.position.x + halfW;
            const targetY = targetNode.position.y;

            const midY = (sourceY + targetY) / 2;
            const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

            const { color: edgeColor, markerId } = getEdgeStyle(edge, sourceNode);

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth="1.5"
                  markerEnd={`url(#${markerId})`}
                />
                {edge.label && (
                  <text
                    x={(sourceX + targetX) / 2}
                    y={midY - 8}
                    fill={edgeColor}
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Connection preview line */}
          {connectingFrom && (
            <line
              x1={(nodes.find(n => n.id === connectingFrom.nodeId)?.position.x ?? 0) + NODE_WIDTH / 2}
              y1={(nodes.find(n => n.id === connectingFrom.nodeId)?.position.y ?? 0) + NODE_ESTIMATED_HEIGHT}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeDasharray="6,4"
              opacity="0.6"
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <BotNodeCard
            key={node.id}
            node={node}
            nodeIndex={nodeIndexMap[node.id] || 0}
            isSelected={selectedNode === node.id}
            isConnecting={connectingFrom?.nodeId === node.id}
            onSelect={() => setSelectedNode(node.id)}
            onUpdate={(data) => handleNodeUpdate(node.id, data)}
            onMove={(position) => handleNodeMove(node.id, position)}
            onStartConnect={(handle) => setConnectingFrom({ nodeId: node.id, handle })}
            onEndConnect={(targetId) => {
              if (connectingFrom && connectingFrom.nodeId !== targetId) {
                handleConnect(connectingFrom.nodeId, targetId, connectingFrom.handle);
              }
              setConnectingFrom(null);
            }}
            onDelete={() => handleDeleteNode(node.id)}
            onDuplicate={() => handleDuplicateNode(node.id)}
            executionStatus={executionStatuses[node.id]}
            onTestNode={handleTestNode}
            testLeads={testLeads}
            allNodes={nodes}
          />
        ))}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8 bg-card/80 rounded-xl border border-border/50 shadow-sm">
              <p className="text-muted-foreground mb-4 text-sm">
                Clique duas vezes no canvas para adicionar um bloco
              </p>
              <Button
                variant="outline"
                size="sm"
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
      return {
        conditions: [{
          id: `cond_${Date.now()}_1`,
          type: 'message_received',
          label: 'Se responder',
          config: {},
          order: 0,
        }],
      };
    case 'tag':
      return { tagId: '', action: 'add' };
    case 'move_stage':
      return { stageId: '' };
    case 'validate':
      return { validation_type: 'any', };
    case 'goto':
      return { target_node_id: '' };
    case 'stop':
      return {};
    case 'change_responsible':
      return { user_id: '', mode: 'specific' };
    case 'add_note':
      return { note: '' };
    default:
      return {};
  }
}
