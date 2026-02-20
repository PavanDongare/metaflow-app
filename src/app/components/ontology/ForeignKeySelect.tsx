'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useTenant } from '@/lib/auth/tenant-context';
import type { ObjectType, ObjectInstance } from '../../lib/types/ontology';

interface Props {
  targetTypeId: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  displayName?: string;
  disabled?: boolean;
}

interface FKOption {
  id: string;
  label: string;
}

export function ForeignKeySelect({ targetTypeId, value, onChange, required, displayName, disabled }: Props) {
  const { tenantId } = useTenant();
  const [options, setOptions] = useState<FKOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      if (!targetTypeId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const supabase = getSupabase('metaflow');

        // Get the object type to know which field to use for labels
        const { data: typeData, error: typeError } = await supabase
          .from('object_types')
          .select('*')
          .eq('id', targetTypeId)
          .eq('tenant_id', tenantId)
          .single();

        if (typeError) throw typeError;

        const objectType: ObjectType = {
          id: typeData.id,
          tenantId: typeData.tenant_id,
          displayName: typeData.display_name,
          config: typeData.config,
          createdAt: typeData.created_at,
          updatedAt: typeData.updated_at,
        };

        // Get all objects of this type
        const { data: objectsData, error: objectsError } = await supabase
          .from('objects')
          .select('*')
          .eq('object_type_id', targetTypeId)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1000);

        if (objectsError) throw objectsError;

        // Map to options
        const titleKey = objectType.config.titleKey;
        const opts = (objectsData || []).map(row => {
          return {
            id: row.id,
            label: row.data[titleKey] || row.semantic_id || row.id,
          };
        });

        setOptions(opts);
      } catch (err: any) {
        console.error('ForeignKeySelect: Fetch error', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [targetTypeId, tenantId]);

  if (loading) {
    return (
      <select className="w-full h-8 border rounded px-2 text-sm bg-muted" disabled>
        <option>Loading options...</option>
      </select>
    );
  }

  if (error) {
    return (
      <div>
        <select className="w-full h-8 border border-destructive rounded px-2 text-sm bg-destructive/10" disabled>
          <option>Error loading options</option>
        </select>
        <p className="text-xs text-destructive mt-1">{error}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div>
        <select className="w-full h-8 border rounded px-2 text-sm bg-yellow-50 dark:bg-yellow-900/20" disabled>
          <option>No {displayName || 'options'} available</option>
        </select>
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Create some {displayName || 'records'} first</p>
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-8 border rounded px-2 text-sm bg-background disabled:opacity-50 disabled:cursor-not-allowed"
      required={required}
      disabled={disabled}
    >
      <option value="">Select {displayName || 'option'}...</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
