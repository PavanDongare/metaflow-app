// Layout Calculator - Auto-positions nodes for process canvas

import type { Node, Edge } from 'reactflow';

// Node size constants
const STATE_NODE_WIDTH = 140;
const STATE_NODE_HEIGHT = 60;
const ACTION_NODE_WIDTH = 200;
const ACTION_NODE_HEIGHT = 50;
const HORIZONTAL_SPACING = 200;
const VERTICAL_SPACING = 100;

/**
 * Calculates automatic layout for nodes using a simple layered approach
 * Groups nodes by connectivity and positions them left-to-right
 */
export async function calculateLayout(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  // Build adjacency map
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
  }

  // Find root nodes (no incoming edges)
  const rootNodes = nodes.filter((n) => !incoming.has(n.id) || incoming.get(n.id)!.length === 0);
  const orphanNodes = nodes.filter(
    (n) => !outgoing.has(n.id) && !incoming.has(n.id) && edges.length > 0
  );

  // If no clear roots, use first node
  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }

  // BFS to assign layers
  const layers = new Map<string, number>();
  const visited = new Set<string>();
  const queue: { nodeId: string; layer: number }[] = [];

  for (const root of rootNodes) {
    if (!visited.has(root.id)) {
      queue.push({ nodeId: root.id, layer: 0 });
      visited.add(root.id);
    }
  }

  while (queue.length > 0) {
    const { nodeId, layer } = queue.shift()!;
    const currentLayer = layers.get(nodeId);
    if (currentLayer === undefined || layer > currentLayer) {
      layers.set(nodeId, layer);
    }

    const targets = outgoing.get(nodeId) || [];
    for (const target of targets) {
      if (!visited.has(target)) {
        visited.add(target);
        queue.push({ nodeId: target, layer: layer + 1 });
      }
    }
  }

  // Handle unvisited nodes
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, Node[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(node);
  }

  // Position nodes
  const positionedNodes: Node[] = [];
  const sortedLayers = Array.from(layerGroups.keys()).sort((a, b) => a - b);

  for (const layer of sortedLayers) {
    const layerNodes = layerGroups.get(layer)!;
    const startY = -(layerNodes.length - 1) * VERTICAL_SPACING / 2;

    layerNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: {
          x: layer * HORIZONTAL_SPACING,
          y: startY + index * VERTICAL_SPACING,
        },
      });
    });
  }

  return { nodes: positionedNodes, edges };
}

/**
 * Applies saved layout positions to nodes
 * Falls back to auto-layout for nodes without saved positions
 */
export async function applyLayout(
  nodes: Node[],
  edges: Edge[],
  savedLayout: Record<string, { x: number; y: number }>
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const positionedNodes: Node[] = [];
  const unpositionedNodes: Node[] = [];

  for (const node of nodes) {
    const savedPosition = savedLayout[node.id];
    if (savedPosition) {
      positionedNodes.push({
        ...node,
        position: savedPosition,
      });
    } else {
      unpositionedNodes.push(node);
    }
  }

  if (unpositionedNodes.length > 0) {
    const unpositionedNodeIds = new Set(unpositionedNodes.map((n) => n.id));
    const filteredEdges = edges.filter(
      (edge) => unpositionedNodeIds.has(edge.source) && unpositionedNodeIds.has(edge.target)
    );

    const { nodes: layoutedNodes } = await calculateLayout(unpositionedNodes, filteredEdges);

    // Offset new nodes to avoid overlap with existing ones
    if (positionedNodes.length > 0) {
      const maxX = Math.max(...positionedNodes.map((n) => n.position.x));
      layoutedNodes.forEach((node) => {
        node.position.x += maxX + HORIZONTAL_SPACING;
      });
    }

    return {
      nodes: [...positionedNodes, ...layoutedNodes],
      edges,
    };
  }

  return { nodes: positionedNodes, edges };
}
