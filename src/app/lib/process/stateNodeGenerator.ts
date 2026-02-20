// State Node Generator - Creates React Flow nodes from picklist values

import type { ObjectType } from '../types';
import type { Node } from 'reactflow';

export interface StateNodeData {
  objectTypeId: string;
  objectTypeName: string;
  stateProperty: string;
  stateValue: string;
  color?: string;
}

/**
 * Generates React Flow nodes for state values from tracked picklists
 */
export function generateStateNodes(
  objectTypes: ObjectType[],
  trackedPicklists: string[] = []
): Node<StateNodeData>[] {
  const nodes: Node<StateNodeData>[] = [];

  for (const objectType of objectTypes) {
    const stateProperties = findStateProperties(objectType, trackedPicklists);

    for (const prop of stateProperties) {
      const { name: propertyKey, picklistConfig } = prop;

      // Generate a node for each picklist option
      for (const option of picklistConfig.options || []) {
        const nodeId = `state::${objectType.displayName}::${option}`;

        nodes.push({
          id: nodeId,
          type: 'stateNode',
          position: { x: 0, y: 0 },
          data: {
            objectTypeId: objectType.id,
            objectTypeName: objectType.displayName,
            stateProperty: propertyKey,
            stateValue: option,
            color: undefined,
          },
        });
      }
    }
  }

  return nodes;
}

/**
 * Finds state properties in an object type, filtered by tracked keys
 */
function findStateProperties(objectType: ObjectType, trackedKeys: string[] = []) {
  const properties = objectType.config.properties || {};
  const stateProps: Array<{ name: string; picklistConfig: { options: string[] } }> = [];

  for (const [key, prop] of Object.entries(properties)) {
    if (prop.type === 'string' && prop.picklistConfig) {
      if (trackedKeys.includes(key)) {
        stateProps.push({
          name: key,
          picklistConfig: prop.picklistConfig,
        });
      }
    }
  }

  return stateProps;
}

/**
 * Parses a state node ID back into its components
 */
export function parseStateNodeId(nodeId: string): {
  objectTypeName: string;
  stateValue: string;
} | null {
  if (!nodeId.startsWith('state::')) return null;

  const parts = nodeId.slice(7).split('::');
  if (parts.length !== 2) return null;

  const [objectTypeName, stateValue] = parts;
  return { objectTypeName, stateValue };
}

/**
 * Checks if a node ID is a state node
 */
export function isStateNode(nodeId: string): boolean {
  return nodeId.startsWith('state::');
}

/**
 * Checks if a node ID is an action node
 */
export function isActionNode(nodeId: string): boolean {
  return nodeId.startsWith('action::');
}
