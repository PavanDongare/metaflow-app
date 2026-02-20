// Metaflow Ontology Types

export interface ObjectType {
  id: string;
  tenantId: string;
  displayName: string;
  config: ObjectTypeConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObjectTypeConfig {
  properties: Record<string, PropertyDef>;
  primaryKey?: string;
  titleKey: string;
  isJunction?: boolean;
  junctionMetadata?: JunctionMetadata;
}

export interface JunctionMetadata {
  relationshipId: string;
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
}

export type BaseType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'object-reference'
  | 'array';

export type PropertyType = BaseType;

export interface PropertyDef {
  displayName: string;
  type: PropertyType;
  isPrimaryKey?: boolean;
  isTitleKey?: boolean;
  required?: boolean;
  referenceConfig?: ReferenceConfig;
  picklistConfig?: PicklistConfig;
  validation?: ValidationRules;
}

export interface ReferenceConfig {
  targetObjectTypeId: string;
  displayField?: string;
  cascadeDelete?: boolean;
}

export interface PicklistConfig {
  options: string[];
  allowMultiple: boolean;
  defaultValue?: string | string[];
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface ObjectInstance {
  id: string;
  tenantId: string;
  objectTypeId: string;
  semanticId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Relationships
export type RelationshipCardinality = 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';

export interface Relationship {
  id: string;
  tenantId: string;
  displayName: string;
  cardinality: RelationshipCardinality;
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
  sourceDisplayName: string;
  targetDisplayName: string;
  junctionObjectTypeId?: string;
  sourceFkPropertyName?: string;
  targetFkPropertyName?: string;
  propertyName?: string;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// API Input Types
export interface CreateObjectTypeInput {
  tenantId: string;
  displayName: string;
  config: ObjectTypeConfig;
}

export interface UpdateObjectTypeInput {
  displayName?: string;
  config?: ObjectTypeConfig;
}

export interface CreateObjectInput {
  tenantId: string;
  objectTypeId: string;
  data: Record<string, unknown>;
}

export interface UpdateObjectInput {
  data: Record<string, unknown>;
}

export interface CreateRelationshipInput {
  tenantId: string;
  displayName: string;
  cardinality: RelationshipCardinality;
  sourceObjectTypeId: string;
  targetObjectTypeId: string;
  sourceDisplayName: string;
  targetDisplayName: string;
  junctionDisplayName?: string;
  junctionProperties?: Record<string, PropertyDef>;
  propertyName?: string;
  config?: Record<string, unknown>;
}

export interface UpdateRelationshipInput {
  displayName?: string;
  sourceDisplayName?: string;
  targetDisplayName?: string;
  config?: Record<string, unknown>;
}

