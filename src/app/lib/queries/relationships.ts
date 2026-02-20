// Relationships Queries

import { getSupabase } from '@/lib/supabase';
import type { Relationship, RelationshipCardinality } from '../types';

// Row mapper
function mapRelationship(row: Record<string, unknown>): Relationship {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    displayName: row.display_name as string,
    cardinality: row.cardinality as RelationshipCardinality,
    sourceObjectTypeId: row.source_object_type_id as string,
    targetObjectTypeId: row.target_object_type_id as string,
    sourceDisplayName: row.source_display_name as string,
    targetDisplayName: row.target_display_name as string,
    junctionObjectTypeId: row.junction_object_type_id as string | undefined,
    sourceFkPropertyName: row.source_fk_property_name as string | undefined,
    targetFkPropertyName: row.target_fk_property_name as string | undefined,
    propertyName: row.property_name as string | undefined,
    config: row.config as Record<string, unknown> | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// List all relationships
export async function getRelationships(tenantId: string): Promise<Relationship[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRelationship);
}

// Get single relationship
export async function getRelationship(id: string, tenantId: string): Promise<Relationship | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapRelationship(data);
}

// Get relationships by object type (source or target)
export async function getRelationshipsByObjectType(
  objectTypeId: string,
  tenantId: string
): Promise<Relationship[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('relationships')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`source_object_type_id.eq.${objectTypeId},target_object_type_id.eq.${objectTypeId}`);

  if (error) throw error;
  return (data || []).map(mapRelationship);
}

// Create relationship
export async function createRelationship(
  tenantId: string,
  input: {
    displayName: string;
    cardinality: RelationshipCardinality;
    sourceObjectTypeId: string;
    targetObjectTypeId: string;
    sourceDisplayName: string;
    targetDisplayName: string;
    propertyName?: string;
    junctionObjectTypeId?: string;
    sourceFkPropertyName?: string;
    targetFkPropertyName?: string;
    config?: Record<string, unknown>;
  }
): Promise<Relationship> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('relationships')
    .insert({
      tenant_id: tenantId,
      display_name: input.displayName,
      cardinality: input.cardinality,
      source_object_type_id: input.sourceObjectTypeId,
      target_object_type_id: input.targetObjectTypeId,
      source_display_name: input.sourceDisplayName,
      target_display_name: input.targetDisplayName,
      property_name: input.propertyName,
      junction_object_type_id: input.junctionObjectTypeId,
      source_fk_property_name: input.sourceFkPropertyName,
      target_fk_property_name: input.targetFkPropertyName,
      config: input.config || {},
    })
    .select()
    .single();

  if (error) throw error;
  return mapRelationship(data);
}

// Update relationship
export async function updateRelationship(
  id: string,
  tenantId: string,
  updates: {
    displayName?: string;
    sourceDisplayName?: string;
    targetDisplayName?: string;
    config?: Record<string, unknown>;
  }
): Promise<Relationship> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.displayName) updateData.display_name = updates.displayName;
  if (updates.sourceDisplayName) updateData.source_display_name = updates.sourceDisplayName;
  if (updates.targetDisplayName) updateData.target_display_name = updates.targetDisplayName;
  if (updates.config) updateData.config = updates.config;

  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('relationships')
    .update(updateData)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;
  return mapRelationship(data);
}

// Delete relationship
export async function deleteRelationship(id: string, tenantId: string): Promise<void> {
  const supabase = getSupabase('metaflow');
  const { error } = await supabase
    .from('relationships')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}
