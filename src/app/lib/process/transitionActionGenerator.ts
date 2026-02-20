// Transition Action Generator
// Auto-generates action config when user connects two state nodes

import type { ActionTypeConfig, ActionParameter, ActionRule } from '../types';
import type { StateNodeData } from './stateNodeGenerator';

export interface TransitionActionInput {
  sourceObjectTypeId: string;
  sourceObjectTypeName: string;
  sourceStateProperty: string;
  sourceStateValue: string;
  targetObjectTypeId: string;
  targetObjectTypeName: string;
  targetStateProperty: string;
  targetStateValue: string;
}

export interface GeneratedTransitionAction {
  displayName: string;
  config: ActionTypeConfig;
}

/**
 * Generates an action config for transitioning between two states
 * Called when user draws an edge from StateA to StateB on the process canvas
 */
export function generateTransitionAction(
  input: TransitionActionInput
): GeneratedTransitionAction {
  const {
    sourceObjectTypeId,
    sourceObjectTypeName,
    sourceStateProperty,
    sourceStateValue,
    targetStateProperty,
    targetStateValue,
  } = input;

  // Generate parameter name from object type (lowercase, camelCase)
  const paramName = toCamelCase(sourceObjectTypeName);

  // Generate display name: "Pending → Approved" or "Move to Approved"
  const displayName = `${sourceStateValue} → ${targetStateValue}`;

  // Build the parameter definition
  const parameters: ActionParameter[] = [
    {
      name: paramName,
      type: 'object-reference',
      displayName: sourceObjectTypeName,
      required: true,
      objectTypeId: sourceObjectTypeId,
    },
  ];

  // Build submission criteria: check current state equals source state
  // Uses the legacy format that actionClassifier.ts expects
  const submissionCriteria = [
    {
      type: 'comparison',
      left: {
        type: 'property',
        path: {
          baseParameterName: paramName,
          segments: [],
          terminalPropertyKey: sourceStateProperty,
        },
      },
      operator: '=',
      right: {
        type: 'static',
        value: sourceStateValue,
      },
    },
  ];

  // Build rule: modify object to set target state
  const rules: ActionRule[] = [
    {
      type: 'modify_object',
      objectParameter: paramName,
      properties: {
        [targetStateProperty]: {
          source: 'static',
          value: targetStateValue,
        },
      },
    },
  ];

  return {
    displayName,
    config: {
      executionType: 'declarative',
      parameters,
      submissionCriteria: submissionCriteria as unknown as ActionTypeConfig['submissionCriteria'],
      rules,
      description: `Transitions ${sourceObjectTypeName} from "${sourceStateValue}" to "${targetStateValue}"`,
    },
  };
}

/**
 * Builds transition input from two state node data objects
 */
export function buildTransitionInput(
  sourceData: StateNodeData,
  targetData: StateNodeData
): TransitionActionInput {
  return {
    sourceObjectTypeId: sourceData.objectTypeId,
    sourceObjectTypeName: sourceData.objectTypeName,
    sourceStateProperty: sourceData.stateProperty,
    sourceStateValue: sourceData.stateValue,
    targetObjectTypeId: targetData.objectTypeId,
    targetObjectTypeName: targetData.objectTypeName,
    targetStateProperty: targetData.stateProperty,
    targetStateValue: targetData.stateValue,
  };
}

/**
 * Validates that a transition between two states is valid
 */
export function validateTransition(
  sourceData: StateNodeData,
  targetData: StateNodeData
): { valid: boolean; error?: string } {
  // Check same object type
  if (sourceData.objectTypeId !== targetData.objectTypeId) {
    return {
      valid: false,
      error: `Cross-object transitions not supported. Source is "${sourceData.objectTypeName}", target is "${targetData.objectTypeName}"`,
    };
  }

  // Check same state property
  if (sourceData.stateProperty !== targetData.stateProperty) {
    return {
      valid: false,
      error: `Cannot transition between different properties. Source uses "${sourceData.stateProperty}", target uses "${targetData.stateProperty}"`,
    };
  }

  // Check not same state value
  if (sourceData.stateValue === targetData.stateValue) {
    return {
      valid: false,
      error: `Cannot transition from a state to itself ("${sourceData.stateValue}")`,
    };
  }

  return { valid: true };
}

/**
 * Converts a string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}
