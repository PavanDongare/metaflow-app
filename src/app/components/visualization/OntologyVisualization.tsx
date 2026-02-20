'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeDragHandler,
  OnNodesChange,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import type { ObjectType, Relationship } from '../../lib/types/ontology';
import { ObjectTypeNode } from './ObjectTypeNode';
import { RelationshipEdge } from './RelationshipEdge';
import { useLayoutedElements, useLayoutPersistence } from '../../lib/hooks/use-layout';
import { Loader2 } from 'lucide-react';

interface Props {
  objectTypes: ObjectType[];
  relationships: Relationship[];
}

export function OntologyVisualization({ objectTypes, relationships }: Props) {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Get tenant ID from first object type
  const tenantId = objectTypes[0]?.tenantId || '';
  const { loadLayout, saveLayout } = useLayoutPersistence(tenantId);

  // Transform ObjectTypes to Nodes
  const baseNodes: Node[] = useMemo(() =>
    objectTypes.map(type => {
      // Count relationships for this type
      const relationshipCount = relationships.filter(
        r => r.sourceObjectTypeId === type.id || r.targetObjectTypeId === type.id
      ).length;

      return {
        id: type.id,
        type: 'objectType',
        position: { x: 0, y: 0 },  // Will be set by layout
        data: {
          label: type.displayName,
          propertyCount: Object.keys(type.config.properties || {}).length,
          relationshipCount,
          isJunction: type.config.isJunction || false,
          properties: type.config.properties || {},
        },
      };
    }),
    [objectTypes, relationships]
  );

  // Transform Relationships to Edges
  const baseEdges: Edge[] = useMemo(() =>
    relationships.map(rel => ({
      id: rel.id,
      source: rel.sourceObjectTypeId,
      target: rel.targetObjectTypeId,
      type: 'relationship',
      data: {
        label: rel.displayName,
        cardinality: rel.cardinality,
      },
    })),
    [relationships]
  );

  // Apply ELK.js layout
  const { nodes: layoutedNodes, edges: layoutedEdges, isLayouting } = useLayoutedElements(baseNodes, baseEdges);

  // Load saved layout and merge with ELK layout on mount
  useEffect(() => {
    if (!isLayouting && layoutedNodes.length > 0) {
      (async () => {
        const savedLayout = await loadLayout();

        if (savedLayout) {
          // Merge saved positions with layouted nodes
          const mergedNodes = layoutedNodes.map(node => {
            const savedPosition = savedLayout[node.id];
            return savedPosition
              ? { ...node, position: savedPosition }
              : node;
          });
          setNodes(mergedNodes);
        } else {
          // No saved layout, use ELK layout
          setNodes(layoutedNodes);
        }

        setEdges(layoutedEdges);
      })();
    }
  }, [layoutedNodes, layoutedEdges, isLayouting, loadLayout]);

  // Define custom node types
  const nodeTypes = useMemo(() => ({
    objectType: ObjectTypeNode,
  }), []);

  // Define custom edge types
  const edgeTypes = useMemo(() => ({
    relationship: RelationshipEdge,
  }), []);

  // Handle node changes (including drag)
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Handle node drag stop - save layout with debouncing
  const onNodeDragStop: NodeDragHandler = useCallback(() => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save after 1 second of no dragging
    saveTimeoutRef.current = setTimeout(() => {
      setNodes((currentNodes) => {
        saveLayout(currentNodes);
        return currentNodes;
      });
    }, 1000);
  }, [saveLayout]);

  // Handle node click (navigate to detail page)
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    router.push(`/ontology/${node.id}`);
  }, [router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Empty state
  if (objectTypes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium">No object types yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first object type to see the visualization
          </p>
        </div>
      </div>
    );
  }

  // Loading state for layout
  if (isLayouting) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Calculating layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        nodesDraggable={true}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
      >
        <Background color="#d1d5db" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.isJunction) return '#e9d5ff';
            return '#ffffff';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}
