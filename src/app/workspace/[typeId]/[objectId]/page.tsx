'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/lib/auth/tenant-context';
import { ForeignKeySelect } from '../../../components/ontology/ForeignKeySelect';
import { SmartActionDropdown } from '../../../components/workspace/SmartActionDropdown';
import { StatusBreadcrumb } from '../../../components/workspace/StatusBreadcrumb';
import { getObjectType } from '../../../lib/queries/object-types';
import { getObject, updateObject, deleteObject } from '../../../lib/queries/objects';
import type { ObjectType, ObjectInstance } from '../../../lib/types/ontology';

export default function ObjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenant();
  const typeId = params.typeId as string;
  const objectId = params.objectId as string;

  const [objectType, setObjectType] = useState<ObjectType | null>(null);
  const [object, setObject] = useState<ObjectInstance | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [typeData, objectData] = await Promise.all([
        getObjectType(typeId, tenantId),
        getObject(objectId, tenantId),
      ]);
      setObjectType(typeData);
      setObject(objectData);
      setFormData(objectData?.data || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [typeId, objectId, tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!object) return;

    setSaving(true);
    setError(null);

    try {
      await updateObject(objectId, tenantId, formData);
      router.push(`/workspace/${typeId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteObject(objectId, tenantId);
      router.push(`/workspace/${typeId}`);
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

  if (!objectType || !object) {
    return (
      <div className="p-6">
        <div className="text-destructive">Record not found</div>
        <Link href={`/workspace/${typeId}`}>
          <Button variant="outline" className="mt-4">
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  const properties = objectType.config.properties;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/workspace/${typeId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {String(object.data[objectType.config.titleKey] || object.semanticId || object.id.slice(0, 8))}
            </h1>
            <p className="text-muted-foreground">
              {objectType.displayName} - {object.semanticId}
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

      {/* Status Breadcrumb */}
      <StatusBreadcrumb objectTypeId={typeId} objectData={object.data} />

      {/* Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartActionDropdown
            objectId={objectId}
            objectTypeId={typeId}
            currentObject={object}
            onActionExecuted={loadData}
          />
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(properties).map(([key, prop]) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">
                  {prop.displayName}
                  {prop.required && <span className="text-destructive"> *</span>}
                </label>

                {/* String */}
                {prop.type === 'string' && (
                  <>
                    {prop.picklistConfig ? (
                      prop.picklistConfig.allowMultiple ? (
                        <select
                          multiple
                          value={formData[key] || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, option => option.value);
                            setFormData({ ...formData, [key]: selected });
                          }}
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                          size={Math.min(prop.picklistConfig.options.length, 5)}
                        >
                          {prop.picklistConfig.options.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={formData[key] || ''}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          className="w-full border rounded px-3 py-2 text-sm bg-background"
                        >
                          <option value="">Select {prop.displayName}...</option>
                          {prop.picklistConfig.options.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      )
                    ) : (
                      <Input
                        value={formData[key] || ''}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                        maxLength={prop.validation?.maxLength}
                      />
                    )}
                  </>
                )}

                {/* Number */}
                {prop.type === 'number' && (
                  <Input
                    type="number"
                    step="any"
                    value={formData[key] || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value ? parseFloat(e.target.value) : undefined })}
                    min={prop.validation?.min}
                    max={prop.validation?.max}
                  />
                )}

                {/* Boolean */}
                {prop.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={formData[key] || false}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                    className="w-4 h-4"
                  />
                )}

                {/* Timestamp */}
                {prop.type === 'timestamp' && (
                  <Input
                    type="datetime-local"
                    value={formData[key] || ''}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  />
                )}

                {/* Array */}
                {prop.type === 'array' && (
                  <textarea
                    value={formData[key] ? JSON.stringify(formData[key]) : ''}
                    onChange={(e) => {
                      try {
                        setFormData({ ...formData, [key]: JSON.parse(e.target.value) });
                      } catch {
                        // Invalid JSON
                      }
                    }}
                    placeholder="Enter JSON array"
                    className="w-full border rounded px-2 py-1 text-sm font-mono bg-background"
                    rows={3}
                  />
                )}

                {/* Foreign Key */}
                {prop.type === 'object-reference' && prop.referenceConfig?.targetObjectTypeId && (
                  <ForeignKeySelect
                    targetTypeId={prop.referenceConfig.targetObjectTypeId}
                    value={formData[key] || ''}
                    onChange={(value) => setFormData({ ...formData, [key]: value })}
                    displayName={prop.displayName}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">ID</span>
            <span className="font-mono">{object.id}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Semantic ID</span>
            <span className="font-mono">{object.semanticId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(object.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Updated</span>
            <span>{new Date(object.updatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
