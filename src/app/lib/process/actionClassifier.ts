// Action Classifier - Detects if actions are state transitions

import type { ActionType, ObjectType } from '../types';

export interface StateTransitionClassification {
  type: 'state_transition';
  sourceObjectTypeId?: string;
  sourceObjectTypeName?: string;
  sourceStateProperty?: string;
  sourceStateValue?: string;
  sourceNodeId?: string;
  targetObjectTypeId?: string;
  targetObjectTypeName?: string;
  targetStateProperty?: string;
  targetStateValue?: string;
  targetNodeId?: string;
  isCrossObject: boolean;
  hasExtras?: boolean;
  hasSourceOnly?: boolean;
  hasTargetOnly?: boolean;
}

export interface OrphanedClassification {
  type: 'orphaned';
  reason: string;
  missingStateValue?: string;
}

export interface RegularClassification {
  type: 'regular';
}

export type ActionClassification =
  | StateTransitionClassification
  | OrphanedClassification
  | RegularClassification;

/**
 * Classifies an action to determine its visual representation
 */
export function classifyAction(
  action: ActionType,
  objectTypes: ObjectType[]
): ActionClassification {
  const config = action.config;

  // Check for state condition in submission criteria
  const stateCondition = findStateCondition(config.submissionCriteria, objectTypes);

  // Check for state modification in rules
  const stateRule = findStateRule(config.rules || [], objectTypes);

  // If neither state condition nor state rule, it's a regular action
  if (!stateCondition && !stateRule) {
    return { type: 'regular' };
  }

  let sourceNodeId: string | undefined;
  let targetNodeId: string | undefined;
  let sourceObjectType: ObjectType | undefined;
  let targetObjectType: ObjectType | undefined;
  let sourceExists = false;
  let targetExists = false;

  if (stateCondition) {
    sourceExists = checkStateValueExists(
      objectTypes,
      stateCondition.objectTypeId,
      stateCondition.propertyKey,
      stateCondition.value
    );
    if (sourceExists) {
      sourceObjectType = objectTypes.find((t) => t.id === stateCondition.objectTypeId);
      if (sourceObjectType) {
        sourceNodeId = `state::${sourceObjectType.displayName}::${stateCondition.value}`;
      }
    }
  }

  if (stateRule) {
    targetExists = checkStateValueExists(
      objectTypes,
      stateRule.objectTypeId,
      stateRule.propertyKey,
      stateRule.value
    );
    if (targetExists) {
      targetObjectType = objectTypes.find((t) => t.id === stateRule.objectTypeId);
      if (targetObjectType) {
        targetNodeId = `state::${targetObjectType.displayName}::${stateRule.value}`;
      }
    }
  }

  // If state values don't exist in picklists, it's orphaned
  if (stateCondition && !sourceExists) {
    return {
      type: 'orphaned',
      reason: `Source state "${stateCondition.value}" not found in ${stateCondition.propertyKey} picklist`,
      missingStateValue: stateCondition.value,
    };
  }

  if (stateRule && !targetExists) {
    return {
      type: 'orphaned',
      reason: `Target state "${stateRule.value}" not found in ${stateRule.propertyKey} picklist`,
      missingStateValue: stateRule.value,
    };
  }

  const hasSourceOnly = stateCondition && !stateRule;
  const hasTargetOnly = !stateCondition && stateRule;

  return {
    type: 'state_transition',
    sourceObjectTypeId: stateCondition?.objectTypeId,
    sourceObjectTypeName: sourceObjectType?.displayName,
    sourceStateProperty: stateCondition?.propertyKey,
    sourceStateValue: stateCondition?.value,
    sourceNodeId,
    targetObjectTypeId: stateRule?.objectTypeId,
    targetObjectTypeName: targetObjectType?.displayName,
    targetStateProperty: stateRule?.propertyKey,
    targetStateValue: stateRule?.value,
    targetNodeId,
    isCrossObject:
      stateCondition && stateRule
        ? stateCondition.objectTypeId !== stateRule.objectTypeId
        : false,
    hasExtras: false,
    hasSourceOnly: !!hasSourceOnly,
    hasTargetOnly: !!hasTargetOnly,
  };
}

/**
 * Find state condition in submission criteria
 */
function findStateCondition(
  criteria: any,
  objectTypes: ObjectType[]
): { objectTypeId: string; propertyKey: string; value: string; parameterName: string } | null {
  const criteriaArray = Array.isArray(criteria) ? criteria : criteria ? [criteria] : [];
  if (criteriaArray.length === 0) return null;

  const criterion = criteriaArray[0];

  if (!criterion || criterion.type !== 'comparison') return null;
  if (!criterion.left || criterion.left.type !== 'property') return null;
  if (!criterion.right || criterion.right.type !== 'static') return null;

  const path = criterion.left.path;
  if (!path || !path.baseParameterName || !path.terminalPropertyKey) return null;

  const propertyKey = path.terminalPropertyKey;
  const value = criterion.right.value;

  for (const objectType of objectTypes) {
    const property = objectType.config.properties?.[propertyKey];
    if (property && property.type === 'string' && property.picklistConfig) {
      return {
        objectTypeId: objectType.id,
        propertyKey,
        value,
        parameterName: path.baseParameterName,
      };
    }
  }

  return null;
}

/**
 * Find state modification rule
 */
function findStateRule(
  rules: any[],
  objectTypes: ObjectType[]
): { objectTypeId: string; propertyKey: string; value: string; objectParameter: string } | null {
  if (!rules || rules.length === 0) return null;

  for (const rule of rules) {
    if (rule.type !== 'modify_object') continue;
    if (!rule.properties) continue;

    for (const [propertyKey, propertyConfig] of Object.entries(rule.properties)) {
      const config = propertyConfig as any;
      if (config.source !== 'static') continue;

      for (const objectType of objectTypes) {
        const property = objectType.config.properties?.[propertyKey];
        if (property && property.type === 'string' && property.picklistConfig) {
          return {
            objectTypeId: objectType.id,
            propertyKey,
            value: config.value,
            objectParameter: rule.objectParameter,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Check if a state value exists in the object type's picklist
 */
function checkStateValueExists(
  objectTypes: ObjectType[],
  objectTypeId: string,
  propertyKey: string,
  value: string
): boolean {
  const objectType = objectTypes.find((t) => t.id === objectTypeId);
  if (!objectType) return false;

  const property = objectType.config.properties?.[propertyKey];
  if (!property || property.type !== 'string' || !property.picklistConfig) return false;

  const options = property.picklistConfig.options || [];
  return options.some((opt) => opt === value);
}
