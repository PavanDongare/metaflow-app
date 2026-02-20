'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenant } from '@/lib/auth/tenant-context';
import { getProcessLayoutForObjectType, type ProcessLayout } from '../queries/layouts';

export interface ProcessStateResult {
  process: ProcessLayout | null;
  currentState: string | null;
  stateProperty: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for getting the current process state of an object
 * based on its type and data
 */
export function useObjectProcessState(
  objectTypeId: string | null,
  objectData: Record<string, unknown> | null
): ProcessStateResult {
  const { tenantId } = useTenant();
  const [process, setProcess] = useState<ProcessLayout | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [stateProperty, setStateProperty] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProcessState = useCallback(async () => {
    if (!objectTypeId) {
      setProcess(null);
      setCurrentState(null);
      setStateProperty(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get process layout for this object type
      const processLayout = await getProcessLayoutForObjectType(objectTypeId, tenantId);

      if (!processLayout) {
        setProcess(null);
        setCurrentState(null);
        setStateProperty(null);
        return;
      }

      setProcess(processLayout);

      // Get current state from object data using tracked picklists
      if (objectData && processLayout.trackedPicklists && processLayout.trackedPicklists.length > 0) {
        // trackedPicklists is an array of property keys to track
        const primaryProp = processLayout.trackedPicklists[0];
        const stateValue = objectData[primaryProp];
        setCurrentState(stateValue as string || null);
        setStateProperty(primaryProp);
      } else {
        setCurrentState(null);
        setStateProperty(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load process state');
    } finally {
      setLoading(false);
    }
  }, [objectTypeId, objectData, tenantId]);

  useEffect(() => {
    loadProcessState();
  }, [loadProcessState]);

  return {
    process,
    currentState,
    stateProperty,
    loading,
    error,
    refresh: loadProcessState,
  };
}

/**
 * Hook for managing process layouts (list, create, delete)
 */
export function useProcessLayouts() {
  const { tenantId } = useTenant();
  const [layouts, setLayouts] = useState<ProcessLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLayouts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { getProcessLayouts } = await import('../queries/layouts');
      const data = await getProcessLayouts(tenantId);
      setLayouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load process layouts');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadLayouts();
  }, [loadLayouts]);

  const createLayout = useCallback(async (
    processName: string,
    objectTypeIds: string[],
    trackedPicklists: string[] = []
  ) => {
    const { saveProcessLayout } = await import('../queries/layouts');
    const layout = await saveProcessLayout(tenantId, {
      processName,
      objectTypeIds,
      trackedPicklists,
      layoutData: {},
    });
    await loadLayouts();
    return layout;
  }, [tenantId, loadLayouts]);

  const deleteLayout = useCallback(async (processName: string) => {
    const { deleteProcessLayout } = await import('../queries/layouts');
    await deleteProcessLayout(processName, tenantId);
    await loadLayouts();
  }, [tenantId, loadLayouts]);

  return {
    layouts,
    loading,
    error,
    refresh: loadLayouts,
    createLayout,
    deleteLayout,
  };
}

/**
 * Hook for managing a single process layout
 */
export function useProcessLayout(processId: string | null) {
  const { tenantId } = useTenant();
  const [layout, setLayout] = useState<ProcessLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLayout = useCallback(async () => {
    if (!processId) {
      setLayout(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { getProcessLayout } = await import('../queries/layouts');
      // Query by ID instead of processName
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase('metaflow');
      const { data, error: fetchError } = await supabase
        .from('process_layouts')
        .select('*')
        .eq('id', processId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setLayout(null);
          return;
        }
        throw fetchError;
      }

      // Map the data
      setLayout({
        id: data.id,
        tenantId: data.tenant_id,
        processName: data.process_name,
        objectTypeIds: data.object_type_ids || [],
        trackedPicklists: data.tracked_picklists || [],
        layoutData: data.layout_data || {},
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load process layout');
    } finally {
      setLoading(false);
    }
  }, [processId, tenantId]);

  useEffect(() => {
    loadLayout();
  }, [loadLayout]);

  // Save layout data (node positions)
  const save = useCallback(async (layoutData: Record<string, { x: number; y: number }>) => {
    if (!processId || !layout) return;

    try {
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase('metaflow');

      const { error: updateError } = await supabase
        .from('process_layouts')
        .update({
          layout_data: layoutData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', processId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      setLayout(prev => prev ? { ...prev, layoutData, updatedAt: new Date() } : null);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to save layout');
    }
  }, [processId, tenantId, layout]);

  // Add tracked picklist
  const addTrackedPicklist = useCallback(async (objectTypeId: string, propertyKey: string) => {
    if (!processId || !layout) return;

    try {
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase('metaflow');

      // trackedPicklists is stored as Record<string, string[]> in reference but as string[] in platform
      // We'll adapt to the platform's simpler format
      const current = layout.trackedPicklists || [];
      if (current.includes(propertyKey)) return;

      const updated = [...current, propertyKey];

      const { error: updateError } = await supabase
        .from('process_layouts')
        .update({
          tracked_picklists: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', processId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      setLayout(prev => prev ? { ...prev, trackedPicklists: updated, updatedAt: new Date() } : null);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add tracked picklist');
    }
  }, [processId, tenantId, layout]);

  // Remove tracked picklist
  const removeTrackedPicklist = useCallback(async (objectTypeId: string, propertyKey: string) => {
    if (!processId || !layout) return;

    try {
      const { getSupabase } = await import('@/lib/supabase');
      const supabase = getSupabase('metaflow');

      const current = layout.trackedPicklists || [];
      const updated = current.filter(k => k !== propertyKey);

      const { error: updateError } = await supabase
        .from('process_layouts')
        .update({
          tracked_picklists: updated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', processId)
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      setLayout(prev => prev ? { ...prev, trackedPicklists: updated, updatedAt: new Date() } : null);
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to remove tracked picklist');
    }
  }, [processId, tenantId, layout]);

  return {
    layout,
    loading,
    error,
    save,
    addTrackedPicklist,
    removeTrackedPicklist,
    refresh: loadLayout,
  };
}
