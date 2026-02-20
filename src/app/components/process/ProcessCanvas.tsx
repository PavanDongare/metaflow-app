// ProcessCanvas - Main React Flow canvas for process visualization

'use client';

import { useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import StateNode from './StateNode';
import ActionNode from './ActionNode';
import ActionEdge from './ActionEdge';

interface ProcessCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  onConnect?: (connection: Connection) => void;
  onNodeClick?: (node: Node) => void;
  onEdgeClick?: (edge: Edge) => void;
  readOnly?: boolean;
}

export default function ProcessCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  readOnly = false,
}: ProcessCanvasProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  const shouldNotifyNodesRef = useRef(false);
  const shouldNotifyEdgesRef = useRef(false);

  // Register custom node types
  const nodeTypes = useMemo(
    () => ({
      stateNode: StateNode,
      actionNode: ActionNode,
    }),
    []
  );

  // Register custom edge types
  const edgeTypes = useMemo(
    () => ({
      actionEdge: ActionEdge,
    }),
    []
  );

  // Handle node changes
  const onNodesChangeHandler = useCallback(
    (changes: any) => {
      handleNodesChange(changes);
      shouldNotifyNodesRef.current = true;
    },
    [handleNodesChange]
  );

  // Handle edge changes
  const onEdgesChangeHandler = useCallback(
    (changes: any) => {
      handleEdgesChange(changes);
      shouldNotifyEdgesRef.current = true;
    },
    [handleEdgesChange]
  );

  // Notify parent of node changes
  useEffect(() => {
    if (shouldNotifyNodesRef.current && onNodesChange) {
      shouldNotifyNodesRef.current = false;
      onNodesChange(nodes);
    }
  }, [nodes, onNodesChange]);

  // Notify parent of edge changes
  useEffect(() => {
    if (shouldNotifyEdgesRef.current && onEdgesChange) {
      shouldNotifyEdgesRef.current = false;
      onEdgesChange(edges);
    }
  }, [edges, onEdgesChange]);

  // Sync external prop updates to internal state
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle connection
  const onConnectHandler = useCallback(
    (connection: Connection) => {
      if (onConnect) {
        onConnect(connection);
      }
    },
    [onConnect]
  );

  // Handle node click
  const onNodeClickHandler = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  // Handle edge click
  const onEdgeClickHandler = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge);
      }
    },
    [onEdgeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeHandler}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={onConnectHandler}
        onNodeClick={onNodeClickHandler}
        onEdgeClick={onEdgeClickHandler}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={!readOnly} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'stateNode') return 'hsl(var(--muted))';
            if (node.type === 'actionNode') {
              const data = node.data as any;
              return data?.isOrphaned ? '#fef3c7' : 'hsl(var(--muted))';
            }
            return 'hsl(var(--muted))';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
