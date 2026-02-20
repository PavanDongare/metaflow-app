// Object Types Queries

import { getSupabase } from '@/lib/supabase';
import type { ObjectType, ObjectTypeConfig } from '../types';

// Row mapper
function mapObjectType(row: Record<string, unknown>): ObjectType {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    displayName: row.display_name as string,
    config: row.config as ObjectTypeConfig,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// List all object types
export async function getObjectTypes(tenantId: string): Promise<ObjectType[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('object_types')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapObjectType);
}

// Get single object type
export async function getObjectType(id: string, tenantId: string): Promise<ObjectType | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('object_types')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapObjectType(data);
}

// Create object type
export async function createObjectType(
  tenantId: string,
  input: {
    displayName: string;
    config: ObjectTypeConfig;
  }
): Promise<ObjectType> {
  if (!input.displayName?.trim()) {
    throw new Error('Display name is required');
  }

  if (!input.config?.properties || Object.keys(input.config.properties).length === 0) {
    throw new Error('At least one property is required');
  }

  if (!input.config.titleKey) {
    throw new Error('Title key must be selected');
  }

  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('object_types')
    .insert({
      tenant_id: tenantId,
      display_name: input.displayName,
      config: input.config,
    })
    .select()
    .single();

  if (error) throw error;
  return mapObjectType(data);
}

// Update object type
export async function updateObjectType(
  id: string,
  tenantId: string,
  updates: { displayName?: string; config?: ObjectTypeConfig }
): Promise<ObjectType> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.displayName) {
    updateData.display_name = updates.displayName;
  }

  if (updates.config) {
    updateData.config = updates.config;
  }

  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('object_types')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return mapObjectType(data);
}

// Delete object type
export async function deleteObjectType(id: string, tenantId: string): Promise<void> {
  const supabase = getSupabase('metaflow');
  const { error } = await supabase
    .from('object_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}
