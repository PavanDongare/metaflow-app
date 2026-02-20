// Property Validation Functions

import type { PropertyDef } from '../types/ontology';

/**
 * Validates a property value against its definition
 * Returns error message if invalid, null if valid
 */
export function validateProperty(
  value: any,
  prop: PropertyDef
): string | null {
  // Required check
  if (prop.required || prop.isPrimaryKey) {
    if (value === null || value === undefined || value === '') {
      return `${prop.displayName} is required`;
    }
  }

  // Skip other checks if value is empty/optional
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Type-specific validation (using base types)
  switch (prop.type) {
    case 'string':
      return validateString(value, prop);

    case 'number':
      return validateNumber(value, prop);

    case 'boolean':
      return validateBoolean(value, prop);

    case 'timestamp':
      return validateTimestamp(value, prop);

    case 'object-reference':
      return validateObjectReference(value, prop);

    case 'array':
      // Basic array validation
      if (!Array.isArray(value)) {
        return `${prop.displayName} must be an array`;
      }
      return null;

    default:
      return null;
  }
}

/**
 * Validates all properties in an object's data
 * Returns object with field errors
 */
export function validateObject(
  data: Record<string, any>,
  properties: Record<string, PropertyDef>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [key, prop] of Object.entries(properties)) {
    const error = validateProperty(data[key], prop);
    if (error) {
      errors[key] = error;
    }
  }

  return errors;
}

// Type-specific validation functions

function validateString(value: string | string[], prop: PropertyDef): string | null {
  // Handle picklist validation first
  if (prop.picklistConfig) {
    return validatePicklist(value, prop);
  }

  // Existing string validation for non-picklist strings
  if (typeof value !== 'string') {
    return `${prop.displayName} must be a string`;
  }

  const rules = prop.validation;
  if (!rules) return null;

  if (rules.minLength !== undefined && value.length < rules.minLength) {
    return `${prop.displayName} must be at least ${rules.minLength} characters`;
  }

  if (rules.maxLength !== undefined && value.length > rules.maxLength) {
    return `${prop.displayName} must be at most ${rules.maxLength} characters`;
  }

  if (rules.pattern) {
    try {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        return `${prop.displayName} has invalid format`;
      }
    } catch {
      // Invalid regex pattern - skip validation
    }
  }

  return null;
}

function validatePicklist(value: string | string[], prop: PropertyDef): string | null {
  const config = prop.picklistConfig!;

  if (config.allowMultiple) {
    // Multi-select: expect array
    if (!Array.isArray(value)) {
      return `${prop.displayName} must be an array of values`;
    }

    // Check all values are in options
    const invalidValues = value.filter(v => !config.options.includes(v));
    if (invalidValues.length > 0) {
      return `${prop.displayName} contains invalid options: ${invalidValues.join(', ')}`;
    }
  } else {
    // Single-select: expect string
    if (typeof value !== 'string') {
      return `${prop.displayName} must be a string`;
    }

    if (!config.options.includes(value)) {
      return `${prop.displayName} must be one of: ${config.options.join(', ')}`;
    }
  }

  return null;
}

function validateNumber(value: any, prop: PropertyDef): string | null {
  const num = Number(value);

  if (isNaN(num)) {
    return `${prop.displayName} must be a number`;
  }

  const rules = prop.validation;
  if (!rules) return null;

  if (rules.min !== undefined && num < rules.min) {
    return `${prop.displayName} must be at least ${rules.min}`;
  }

  if (rules.max !== undefined && num > rules.max) {
    return `${prop.displayName} must be at most ${rules.max}`;
  }

  return null;
}

function validateBoolean(value: any, prop: PropertyDef): string | null {
  if (typeof value !== 'boolean') {
    return `${prop.displayName} must be true or false`;
  }
  return null;
}

function validateTimestamp(value: any, prop: PropertyDef): string | null {
  if (typeof value !== 'string') {
    return `${prop.displayName} must be a valid timestamp`;
  }

  // Check if it's a valid timestamp string
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return `${prop.displayName} must be a valid timestamp`;
  }

  return null;
}

function validateObjectReference(value: any, prop: PropertyDef): string | null {
  if (typeof value !== 'string') {
    return `${prop.displayName} must be a valid reference`;
  }

  // Basic format check (UUID-like)
  if (value.length === 0) {
    return `${prop.displayName} is required`;
  }

  // Further validation (checking if reference exists) should be done server-side
  return null;
}
