'use client';

import { useEffect, useState, useCallback } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from 'reactflow';
import { getSupabase } from '@/lib/supabase';

const elk = new ELK();

// ELK layout options for hierarchical layout
const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '100',
  'elk.layered.spacing.nodeNodeBetweenLayers': '200',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
};

export function useLayoutedElements(nodes: Node[], edges: Edge[]) {
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);

  useEffect(() => {
    const layoutElements = async () => {
      if (nodes.length === 0) {
        setLayoutedNodes([]);
        setLayoutedEdges([]);
        return;
      }

      setIsLayouting(true);

      try {
        const graph = {
          id: 'root',
          layoutOptions: elkOptions,
          children: nodes.map(node => ({
            id: node.id,
            width: 180,
            height: 60,
          })),
          edges: edges.map(edge => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
          })),
        };

        const layouted = await elk.layout(graph);

        const layoutedNodesResult = nodes.map(node => {
          const layoutNode = layouted.children?.find(n => n.id === node.id);
          return {
            ...node,
            position: {
              x: layoutNode?.x ?? 0,
              y: layoutNode?.y ?? 0,
            },
          };
        });

        setLayoutedNodes(layoutedNodesResult);
        setLayoutedEdges(edges);
      } catch (error) {
        console.error('Error calculating layout:', error);
        // Fallback: use simple grid layout
        const gridLayout = nodes.map((node, index) => ({
          ...node,
          position: {
            x: (index % 3) * 280,
            y: Math.floor(index / 3) * 140,
          },
        }));
        setLayoutedNodes(gridLayout);
        setLayoutedEdges(edges);
      } finally {
        setIsLayouting(false);
      }
    };

    layoutElements();
  }, [nodes, edges]);

  return { nodes: layoutedNodes, edges: layoutedEdges, isLayouting };
}

interface NodePosition {
  x: number;
  y: number;
}

interface LayoutData {
  [nodeId: string]: NodePosition;
}

export function useLayoutPersistence(tenantId: string) {
  // Load layout from database
  const loadLayout = useCallback(async (): Promise<LayoutData | null> => {
    if (!tenantId) return null;

    try {
      const supabase = getSupabase('metaflow');
      const { data, error } = await supabase
        .from('ontology_layouts')
        .select('node_positions')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No layout found - this is fine for first time
          return null;
        }
        console.error('Error loading layout:', error);
        return null;
      }

      return data?.node_positions as LayoutData || null;
    } catch (err) {
      console.error('Error loading layout:', err);
      return null;
    }
  }, [tenantId]);

  // Save layout to database (debounced)
  const saveLayout = useCallback(async (nodes: Node[]) => {
    if (!tenantId) return;

    try {
      const supabase = getSupabase('metaflow');

      // Convert nodes to position map
      const nodePositions: LayoutData = {};
      nodes.forEach(node => {
        nodePositions[node.id] = {
          x: node.position.x,
          y: node.position.y,
        };
      });

      const { error } = await supabase
        .from('ontology_layouts')
        .upsert({
          tenant_id: tenantId,
          node_positions: nodePositions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id',
        });

      if (error) {
        console.error('Error saving layout:', error);
      }
    } catch (err) {
      console.error('Error saving layout:', err);
    }
  }, [tenantId]);

  return { loadLayout, saveLayout };
}
