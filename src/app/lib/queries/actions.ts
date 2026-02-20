// Actions Queries

import { getSupabase } from '@/lib/supabase';
import type { ActionType, ActionTypeConfig, ActionListItem } from '../types';

// Row mapper
function mapActionType(row: Record<string, unknown>): ActionType {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    displayName: row.display_name as string,
    config: row.config as ActionTypeConfig,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// List all action types
export async function getActionTypes(tenantId: string): Promise<ActionType[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('action_types')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapActionType);
}

// Get single action type
export async function getActionType(id: string, tenantId: string): Promise<ActionType | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('action_types')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapActionType(data);
}

// Create action type
export async function createActionType(
  tenantId: string,
  input: {
    displayName: string;
    config: ActionTypeConfig;
  }
): Promise<ActionType> {
  if (!input.displayName?.trim()) {
    throw new Error('Display name is required');
  }

  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('action_types')
    .insert({
      tenant_id: tenantId,
      display_name: input.displayName,
      config: input.config,
    })
    .select()
    .single();

  if (error) throw error;
  return mapActionType(data);
}

// Update action type
export async function updateActionType(
  id: string,
  tenantId: string,
  updates: { displayName?: string; config?: ActionTypeConfig }
): Promise<ActionType> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.displayName) updateData.display_name = updates.displayName;
  if (updates.config) updateData.config = updates.config;

  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('action_types')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return mapActionType(data);
}

// Delete action type
export async function deleteActionType(id: string, tenantId: string): Promise<void> {
  const supabase = getSupabase('metaflow');
  const { error } = await supabase
    .from('action_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

// List actions via RPC (for UI)
export async function listActions(tenantId: string): Promise<ActionListItem[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase.rpc('list_actions', {
    p_tenant_id: tenantId,
  });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    displayName: row.display_name as string,
    executionType: row.execution_type as 'declarative' | 'function-backed',
    parameters: row.parameters as ActionTypeConfig['parameters'],
    description: row.description as string | undefined,
  }));
}

// Execute action
export async function executeAction(
  actionTypeId: string,
  tenantId: string,
  parameters: Record<string, unknown>,
  currentUser?: string
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase.rpc('execute_action', {
    p_action_type_id: actionTypeId,
    p_tenant_id: tenantId,
    p_parameters: parameters,
    p_current_user: currentUser,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { success: boolean; result?: unknown; errors?: unknown[] };
  if (!result.success && result.errors) {
    return { success: false, error: JSON.stringify(result.errors) };
  }

  return { success: true, result: result.result };
}

// Get available actions for a specific object
export async function getAvailableActionsForObject(
  objectId: string,
  tenantId: string
): Promise<ActionListItem[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase.rpc('get_available_actions_for_object', {
    p_object_id: objectId,
    p_tenant_id: tenantId,
  });

  if (error) {
    // Fallback for broken/legacy DB RPCs: compute a minimal availability list client-side.
    // This keeps workspace actions usable while DB functions are repaired.
    const [objectRes, actionRes] = await Promise.all([
      supabase
        .from('objects')
        .select('object_type_id, data')
        .eq('id', objectId)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('action_types')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_name', { ascending: true }),
    ]);

    if (objectRes.error) throw objectRes.error;
    if (actionRes.error) throw actionRes.error;

    const objectTypeId = objectRes.data.object_type_id as string;
    const objectData = (objectRes.data.data || {}) as Record<string, unknown>;
    const actions = (actionRes.data || []).map(mapActionType);

    const fallback = actions
      .filter((action) => referencesObjectType(action.config, objectTypeId))
      .map((action) => {
        const criteriaPassed = evaluateSimpleCriteriaForObject(action.config, objectTypeId, objectData);
        return {
          id: action.id,
          displayName: action.displayName,
          executionType: action.config.executionType,
          parameters: action.config.parameters,
          description: action.config.description,
          classification: criteriaPassed ? 'recommended' : 'other',
          criteriaPassed,
        } satisfies ActionListItem;
      })
      .filter((a) => a.criteriaPassed)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return fallback;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    displayName: row.display_name as string,
    executionType: row.execution_type as 'declarative' | 'function-backed',
    parameters: row.parameters as ActionTypeConfig['parameters'],
    description: row.description as string | undefined,
    classification: row.classification as string,
    criteriaPassed: row.criteria_passed as boolean,
    failureReason: row.failure_reason as string | undefined,
  }));
}

function referencesObjectType(config: ActionTypeConfig, objectTypeId: string): boolean {
  return (config.parameters || []).some(
    (param) => param.type === 'object-reference' && param.objectTypeId === objectTypeId
  );
}

function evaluateSimpleCriteriaForObject(
  config: ActionTypeConfig,
  objectTypeId: string,
  objectData: Record<string, unknown>
): boolean {
  const criteria = config.submissionCriteria as unknown;
  const first = Array.isArray(criteria) ? criteria[0] : criteria;
  if (!first || typeof first !== 'object') return true;

  const criterion = first as Record<string, unknown>;
  if (criterion.type !== 'comparison') return true;

  const left = criterion.left as Record<string, unknown> | undefined;
  const right = criterion.right as Record<string, unknown> | undefined;
  const operator = criterion.operator as string | undefined;
  if (!left || !right || !operator) return true;
  if (left.type !== 'property' || right.type !== 'static') return true;

  const path = left.path as Record<string, unknown> | undefined;
  if (!path) return true;
  const propertyKey = path.terminalPropertyKey as string | undefined;
  const baseParameterName = path.baseParameterName as string | undefined;
  if (!propertyKey || !baseParameterName) return true;

  const objectParam = (config.parameters || []).find(
    (p) => p.type === 'object-reference' && p.objectTypeId === objectTypeId
  );
  if (!objectParam || objectParam.name !== baseParameterName) return true;

  const actual = objectData[propertyKey];
  const expected = right.value;
  switch (operator) {
    case '=':
    case 'equals':
      return actual === expected;
    case '!=':
    case 'not_equals':
      return actual !== expected;
    default:
      return true;
  }
}
