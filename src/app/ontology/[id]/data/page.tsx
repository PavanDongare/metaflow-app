'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/lib/auth/tenant-context';
import { ObjectsTable } from '../../../components/ontology/ObjectsTable';
import { ObjectForm } from '../../../components/ontology/ObjectForm';
import { getObjectType } from '../../../lib/queries/object-types';
import { getObjects, createObject } from '../../../lib/queries/objects';
import type { ObjectType, ObjectInstance } from '../../../lib/types/ontology';

export default function ObjectTypeDataPage() {
  const params = useParams();
  const { tenantId } = useTenant();
  const id = params.id as string;

  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [objects, setObjects] = useState<ObjectInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [typeData, objectsData] = await Promise.all([
        getObjectType(id, tenantId),
        getObjects(tenantId, id),
      ]);
      setObjectType(typeData);
      setObjects(objectsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (data: Record<string, any>) => {
    if (!objectType) return;
    await createObject(tenantId, id, data, objectType.config, objectType.displayName);
    setShowForm(false);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!objectType) {
    return (
      <div className="p-6">
        <div className="text-destructive">Object type not found</div>
        <Link href="/ontology">
          <Button variant="outline" className="mt-4">
            Back to Ontology
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/ontology">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{objectType.displayName} Data</h1>
            <p className="text-muted-foreground">
              {objects.length} record{objects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Record
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <ObjectForm
          objectType={objectType}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Data Table */}
      <ObjectsTable objectType={objectType} objects={objects} />
    </div>
  );
}
