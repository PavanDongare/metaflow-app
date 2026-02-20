// Layouts Queries (ontology visualization + process layouts)

import { getSupabase } from '@/lib/supabase';

// ==========================================
// Ontology Layout (node positions for visualization)
// ==========================================

export interface OntologyLayout {
  id: string;
  tenantId: string;
  nodePositions: Record<string, { x: number; y: number }>;
  createdAt: Date;
  updatedAt: Date;
}

function mapOntologyLayout(row: Record<string, unknown>): OntologyLayout {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    nodePositions: row.node_positions as Record<string, { x: number; y: number }>,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function getOntologyLayout(tenantId: string): Promise<OntologyLayout | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('ontology_layouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapOntologyLayout(data);
}

export async function saveOntologyLayout(
  tenantId: string,
  nodePositions: Record<string, { x: number; y: number }>
): Promise<OntologyLayout> {
  const supabase = getSupabase('metaflow');

  // Upsert (insert or update)
  const { data, error } = await supabase
    .from('ontology_layouts')
    .upsert(
      {
        tenant_id: tenantId,
        node_positions: nodePositions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return mapOntologyLayout(data);
}

// ==========================================
// Process Layout (workflow canvas)
// ==========================================

export interface ProcessLayout {
  id: string;
  tenantId: string;
  processName: string;
  objectTypeIds: string[];
  trackedPicklists: string[];
  layoutData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function mapProcessLayout(row: Record<string, unknown>): ProcessLayout {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    processName: row.process_name as string,
    objectTypeIds: row.object_type_ids as string[],
    trackedPicklists: (row.tracked_picklists as string[]) || [],
    layoutData: row.layout_data as Record<string, unknown>,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function getProcessLayouts(tenantId: string): Promise<ProcessLayout[]> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('process_layouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('process_name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapProcessLayout);
}

export async function getProcessLayout(processName: string, tenantId: string): Promise<ProcessLayout | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('process_layouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('process_name', processName)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapProcessLayout(data);
}

export async function saveProcessLayout(
  tenantId: string,
  input: {
    processName: string;
    objectTypeIds: string[];
    trackedPicklists?: string[];
    layoutData: Record<string, unknown>;
  }
): Promise<ProcessLayout> {
  const supabase = getSupabase('metaflow');

  const { data, error } = await supabase
    .from('process_layouts')
    .upsert(
      {
        tenant_id: tenantId,
        process_name: input.processName,
        object_type_ids: input.objectTypeIds,
        tracked_picklists: input.trackedPicklists || [],
        layout_data: input.layoutData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,process_name' }
    )
    .select()
    .single();

  if (error) throw error;
  return mapProcessLayout(data);
}

export async function deleteProcessLayout(processName: string, tenantId: string): Promise<void> {
  const supabase = getSupabase('metaflow');
  const { error } = await supabase
    .from('process_layouts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('process_name', processName);

  if (error) throw error;
}

// Get process layout for a specific object type
export async function getProcessLayoutForObjectType(
  objectTypeId: string,
  tenantId: string
): Promise<ProcessLayout | null> {
  const supabase = getSupabase('metaflow');
  const { data, error } = await supabase
    .from('process_layouts')
    .select('*')
    .eq('tenant_id', tenantId)
    .contains('object_type_ids', [objectTypeId])
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapProcessLayout(data);
}
