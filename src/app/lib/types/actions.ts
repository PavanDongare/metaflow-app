// Metaflow Action Types

import type { BaseType, PicklistConfig } from './ontology';

export type ActionExecutionType = 'declarative' | 'function-backed';
export type ActionRuleType = 'modify_object' | 'create_object' | 'delete_object' | 'link_objects' | 'function';
export type PropertyValueSource = 'static' | 'parameter' | 'current_user' | 'current_timestamp' | 'object_property';

// ==========================================
// Action Parameter Definitions
// ==========================================

export interface ActionParameter {
  name: string;
  type: BaseType;
  displayName: string;
  required: boolean;
  objectTypeId?: string;
  picklistConfig?: PicklistConfig;
  description?: string;
}

// ==========================================
// Property Value Config
// ==========================================

export interface PropertyValueConfig {
  source: PropertyValueSource;
  value?: unknown;
  parameterName?: string;
  objectParameter?: string;
  propertyPath?: string;
}

// ==========================================
// Action Rules
// ==========================================

export interface ModifyObjectRule {
  type: 'modify_object';
  objectParameter: string;
  properties: Record<string, PropertyValueConfig>;
}

export interface CreateObjectRule {
  type: 'create_object';
  objectTypeId: string;
  properties: Record<string, PropertyValueConfig>;
}

export interface DeleteObjectRule {
  type: 'delete_object';
  objectParameter: string;
}

export interface LinkObjectsRule {
  type: 'link_objects';
  sourceParameter: string;
  targetParameter: string;
  relationshipName: string;
}

export interface FunctionRule {
  type: 'function';
  functionName: string;
  parameters: Record<string, PropertyValueConfig>;
}

export type ActionRule =
  | ModifyObjectRule
  | CreateObjectRule
  | DeleteObjectRule
  | LinkObjectsRule
  | FunctionRule;

// ==========================================
// Submission Criteria
// ==========================================

export type CriteriaOperator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'STARTS'
  | 'ENDS'
  | 'NULL'
  | 'NOT NULL';

export interface PropertyPathSegment {
  prop: string;
  type: string;
  rel: 'M:1' | 'M:N';
  q?: 'ALL' | 'ANY';
}

export interface PropertyPath {
  param: string;
  path: PropertyPathSegment[];
  prop: string;
}

export type Left =
  | { t: 'prop'; p: PropertyPath }
  | { t: 'param'; p: string }
  | { t: 'sys'; v: 'user' | 'now' }
  | { t: 'val'; v: unknown };

export type Right =
  | { t: 'val'; v: unknown }
  | { t: 'param'; p: string };

export interface ComparisonExpression {
  type: 'cmp';
  left: Left;
  op: CriteriaOperator;
  right: Right;
}

export interface LogicalExpression {
  type: 'logic';
  op: 'AND' | 'OR' | 'NOT';
  exprs: Expression[];
}

export type Expression = ComparisonExpression | LogicalExpression;

export interface EvaluationResult {
  pass: boolean;
  err?: string;
  trace: {
    expr: Expression;
    pass: boolean;
    info: string;
    val?: unknown;
    exp?: unknown;
  };
}

export type SubmissionCriteria = Expression[];

// ==========================================
// Side Effects
// ==========================================

export interface NotificationSideEffect {
  type: 'notification';
  recipient: string;
  message: string;
}

export interface WebhookSideEffect {
  type: 'webhook';
  url: string;
  method: 'POST' | 'PUT';
  payload: Record<string, PropertyValueConfig>;
}

export type SideEffect = NotificationSideEffect | WebhookSideEffect;

// ==========================================
// Action Type Config
// ==========================================

export interface ActionTypeConfig {
  executionType: ActionExecutionType;
  parameters: ActionParameter[];
  rules?: ActionRule[];
  functionName?: string;
  submissionCriteria?: SubmissionCriteria;
  sideEffects?: SideEffect[];
  description?: string;
}

// ==========================================
// Action Type Entity
// ==========================================

export interface ActionType {
  id: string;
  tenantId: string;
  displayName: string;
  config: ActionTypeConfig;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Action Execution Request/Response
// ==========================================

export interface ExecuteActionRequest {
  actionTypeId: string;
  parameters: Record<string, unknown>;
  currentUser?: string;
}

export interface ExecuteActionResponse {
  success: boolean;
  executionId?: string;
  results?: unknown[];
  error?: string;
  details?: unknown;
}

// ==========================================
// Action List Item (for UI)
// ==========================================

export interface ActionListItem {
  id: string;
  displayName: string;
  executionType: ActionExecutionType;
  parameters: ActionParameter[];
  description?: string;
  classification?: string;
  criteriaPassed?: boolean;
  isRecommended?: boolean;
  priorityScore?: number;
}
