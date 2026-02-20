'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/lib/auth/tenant-context';
import { ObjectTypeConfigForm } from '../../components/ontology/ObjectTypeConfigForm';
import { getObjectType, updateObjectType, deleteObjectType } from '../../lib/queries/object-types';
import type { ObjectType } from '../../lib/types/ontology';

export default function ObjectTypeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenant();
  const id = params.id as string;

  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getObjectType(id, tenantId);
        setObjectType(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, tenantId]);

  const handleSave = async () => {
    if (!objectType) return;

    if (!objectType.displayName?.trim()) {
      setError('Display name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateObjectType(id, tenantId, {
        displayName: objectType.displayName,
        config: objectType.config,
      });
      router.push('/ontology');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this object type? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteObjectType(id, tenantId);
      router.push('/ontology');
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/ontology">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{objectType.displayName}</h1>
            <p className="text-muted-foreground">
              Edit object type configuration
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <ObjectTypeConfigForm value={objectType} onChange={(updated) => setObjectType(prev => prev ? { ...prev, ...updated } : null)} />
    </div>
  );
}
